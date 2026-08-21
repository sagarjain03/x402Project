# 🟦 CORE - Policy engine & control plane

> **Mission:** answer one question, deterministically and in under 60 ms:
> *"Should this agent be allowed to make this payment?"* - then record the answer so nobody can
> deny it later.

| | |
|---|---|
| **Owner role** | `CORE` (D2 Core Backend in `Docs/DEVELOPMENT_PLAN.md`) |
| **Phases** | P1 (schema + engine), P2 (control API + ledger) |
| **Critical path** | ⚠️ Blocks PAY at P3 and UI at P4. Ship `types.ts` and the seed first. |
| **Blocked by** | Nobody. |

> 👉 **Start here: [BUILD.md](./BUILD.md)** — checkpoints C1–C8, commit messages and the check that
> proves each one is done. This README is the context; that file is the order of work.

---

## 1. What this division is about

This is the intellectual core of the product. Everything else is plumbing around it.

Three things live here and nowhere else:

1. **The decision** - a pure function `evaluate(context) -> ALLOW | HOLD | BLOCK` plus the reasons.
2. **The money accounting** - a reserve/commit/release ledger that cannot be raced into overspending.
3. **The record** - an append-only, hash-chained audit log written *before* anything is signed.

**The hard rule:** no LLM, no randomness, no network call, no `Date.now()` inside the engine. The
same `(intent, policy, counters)` must always produce the same decision, or the product is not
auditable and the whole security claim collapses.

---

## 2. Folder map

| Path | What it does |
|---|---|
| `db/schema.ts` | **5 tables** (`../../../Docs/ARCHITECTURE.md` §10). Money columns are `bigint` minor units. |
| `db/queries.ts` | ⭐ **The only place outside `budget/ledger.ts` that touches the DB.** Handlers call these, never `getDb()` directly. |
| `db/index.ts` | Drizzle client, lazy. |
| `db/seed.ts` | 4 agents, 6 merchants, 6 policies, 52 mixed-decision intents (4 with real on-chain hashes). **UI depends on this from hour 2.** |
| `db/reset.ts` | Wipes and re-seeds so the demo can be re-run cleanly on stage. |
| `policy/rules.ts` | ⭐ The 13 precedence rules, each a pure `(ctx) => Reason \| null`. |
| `policy/engine.ts` | ⭐ Ordered evaluation, first-BLOCK-wins, fail-closed. **Zero I/O.** |
| `policy/context.ts` | Does the I/O the engine refuses to do: loads policy, counters, merchant, allowance. |
| `policy/templates.ts` | `conservative` / `standard` / `permissive` starter policies. |
| `budget/ledger.ts` | ⭐ RESERVE / COMMIT / RELEASE under a per-agent Postgres advisory lock. |
| `budget/windows.ts` | Hour / day / month window keys used by the sliding-sum queries. |
| `velocity/window.ts` | Sliding-window transaction counts, per agent and per agent x merchant. |
| `risk/score.ts` | 7 weighted signals -> 0-100. Deterministic. Not a model. |
| `risk/signals.ts` | The individual signal definitions and their point values. |
| `audit/log.ts` | Append-only writer. Called before signing, never after. |
| `audit/chain.ts` | `rowHash = sha256(prevHash + canonicalJson(row))`. Tamper evidence without a chain. |
| `audit/events.ts` | In-process event bus feeding the SSE stream. |
| `auth/agentKey.ts` | Hash, constant-time compare, org scoping for `X-Guard-Key`. |
| `auth/session.ts` | Dashboard session + `ADMIN` / `VIEWER` roles. |
| `auth/rateLimit.ts` | Per-key limiter. `429` - **not** the same thing as a policy velocity `402`. |
| `handlers/*` | One file per endpoint. Thin: validate -> call a lib -> serialise. |
| `mock/index.ts` | Fake `evaluate()` returning ALLOW so PAY can build the gateway on day 0. |
| `tests/policy/` | One test per rule, both directions, plus precedence and fail-closed. |
| `tests/ledger/` | 50 concurrent intents against a $1 budget. |

---

### Growing the schema

Seven tables a production system would have are folded into the five: `organizations`, `users`,
`merchants`, `evaluations`, `approvals`, `payments`, `agent_wallets`. That is **deferred
normalisation, not lost capability** — each is a 30 min to 1.5 h additive migration
(expand → backfill → switch reads → optionally contract). The full table and the reasoning live in
`../../../Docs/ARCHITECTURE.md` §10.3.

Three rules keep it cheap:

1. **All DB access goes through `db/queries.ts`** — adding a tenant filter is then one file.
2. **Identity is stored as text** (`created_by_email`, `approval_reviewer_email`) so a future `users`
   backfill is a `SELECT DISTINCT`.
3. **`audit_logs` records every decision**, so the history a single intent row cannot hold is never
   actually lost.

## 3. Public API

```ts
import { evaluatePayment, reserveBudget, commitBudget, releaseBudget } from "@/core";
```

PAY imports exactly these four. Nothing else crosses the boundary.

---

## 4. The 13 rules, in precedence order

Evaluated top-down. First failure wins. See `ARCHITECTURE.md` section 7 for the flowchart.

| # | Rule | Failure |
|---|---|---|
| 1 | Agent is `ACTIVE` | BLOCK `AGENT_FROZEN` |
| 2 | Network + asset allowlisted | BLOCK `NETWORK_NOT_ALLOWED` / `ASSET_NOT_ALLOWED` |
| 3 | Merchant not on the blocklist | BLOCK `MERCHANT_BLOCKED` |
| 4 | Merchant on the allowlist | `unknownMerchantAction` -> BLOCK or HOLD |
| 5 | `payTo` matches the pinned recipient | BLOCK `RECIPIENT_MISMATCH` |
| 6 | `amount <= maxPerTransactionUsd` | BLOCK `PER_TRANSACTION_LIMIT_EXCEEDED` |
| 7 | `amount <= blockAboveUsd` | BLOCK `ABSOLUTE_BLOCK_THRESHOLD` |
| 8 | Hour / day / month budget has room | BLOCK `BUDGET_EXCEEDED` |
| 9 | Velocity within limits | BLOCK `VELOCITY_EXCEEDED` |
| 10 | Wallet allowance remaining | BLOCK `ALLOWANCE_EXHAUSTED` |
| 11 | `riskScore < riskBlockScore` | BLOCK `RISK_TOO_HIGH` |
| 12 | `riskScore < riskHoldScore` and amount outside the hold band | HOLD `APPROVAL_REQUIRED` |
| 13 | Otherwise | **ALLOW** |
| ⚠️ | Any exception, missing policy, DB error | BLOCK `GUARD_UNAVAILABLE` - **fail closed** |

---

## 5. Dependencies

| Direction | Detail |
|---|---|
| **Imports** | `@/shared/*` only |
| **Imported by** | `@/payments` (public API only) and `app/api/v1/*` |
| **Never imports** | `@/payments/*`, `@/dashboard/*`, `@/demo/*` |
| **Enforced by** | `eslint.config.mjs` - the engine may not import the DB, and that fails the build |

---

## 6. Ship order (unblocks the other three)

| When | Ship | Unblocks |
|---|---|---|
| T+0:45 | `shared/types.ts` + `shared/errors.ts` frozen | all three others |
| T+1:30 | `db/schema.ts` pushed | yourself |
| T+2:00 | `db/seed.ts` | UI gets realistic data |
| T+2:15 | `core/mock` | PAY builds the gateway without waiting |
| P1 end | `policy/engine.ts` + tests green | PAY swaps the mock for the real thing |
| P2 end | `POST /api/v1/payments/evaluate` | end-to-end demo becomes possible |

---

## 7. Definition of done

- [ ] All 13 rules have a blocking test **and** a passing test.
- [ ] Precedence order is asserted by a test, not by convention.
- [ ] 50 concurrent $0.60 intents against a $1.00 daily budget produce exactly 1 ALLOW.
- [ ] Killing the DB mid-flight yields BLOCK, never ALLOW.
- [ ] Every decision lands in `evaluations` **and** `audit_logs` before signing.
- [ ] `GET /api/v1/audit/verify` returns `valid: true`.
- [ ] p95 engine latency under 60 ms (`pnpm tsx src/core/scripts/bench-evaluate.ts`).

