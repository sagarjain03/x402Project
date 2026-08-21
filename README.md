# Agent Spend Policy Guard (ASPG)

A policy-enforcement gateway for **x402** autonomous agent payments.
Built for ACTS EDC **Brainwave 2026**, Problem Statement Set-2, **PS-1**.

> ASPG evaluates every autonomous agent payment against configurable financial, merchant, velocity,
> network and risk policies **before** the payment payload is signed or settled - auto-approving
> low-risk payments, blocking violations, escalating ambiguous ones for human review, and keeping a
> complete audit trail.

**The one sentence this project is judged on:**
*"The agent tried to spend $2. The Guard refused. The blockchain has no record of the attempt."*

---

## Where things live

```
x402-Brainwaves Project/          <- outer working folder
├─ Docs/                          <- PRD, Architecture, API docs, plans (+ PDF twins)
├─ Initial-Docs/                  <- the problem statement and reference PDFs
└─ x402project/                   <- THIS Next.js app = the git repository
```

`Docs/` and `Initial-Docs/` sit outside the git repository. Paths below are relative to
`x402project/`, so the docs are at `../Docs/`.

## Repository map

| Path | Owner | What lives here |
|---|---|---|
| `app/` | shared shell | Thin Next.js routing. Every file is a 2-line re-export. Frozen after hour 0. |
| `src/shared/` | frozen contracts | Types, error codes, money helpers. The only cross-owner import. |
| `src/payments/` | **PAY** | x402 adapter, intent builder, wallet + signer, gateway orchestrator |
| `src/core/` | **CORE** | DB schema, policy engine, budget ledger, velocity, risk, audit, control API |
| `src/dashboard/` | **UI** | Every page and component. Talks to the server over HTTP only. |
| `src/demo/` | **DEMO** | x402 merchant sandbox, AI agent, simulator, attack drills |
| `../Docs/` | DEMO | PRD, Architecture, API docs, dev plan, repo structure (+ PDF twins) |

Each `src/<division>/README.md` explains that division in full: mission, files, public API,
dependencies, day-0 tasks, definition of done.

## Your checklist

Every division has a `BUILD.md` next to its README with numbered checkpoints, the exact commit
message for each, and a runnable check that proves it is done.

| Owner | Checklist | Checkpoints | Blocks |
|---|---|---|---|
| **CORE** | [src/core/BUILD.md](src/core/BUILD.md) | C1–C8 | PAY at C6, UI at C8 |
| **PAY** | [src/payments/BUILD.md](src/payments/BUILD.md) | C1–C7 | DEMO at C7 |
| **UI** | [src/dashboard/BUILD.md](src/dashboard/BUILD.md) | C1–C7 | nobody |
| **DEMO** | [src/demo/BUILD.md](src/demo/BUILD.md) | C1–C7 | PAY at C1 |

Commit messages carry the checkpoint, so one command shows where the whole team stands:

```bash
git log --all --oneline | grep -oE "\((core|pay|ui|demo)\): C[0-9]+" | sort -u
```

Nobody is ever blocked while building — every division has a mock of what it needs. Integration is
a one-line import swap, four times, at the checkpoints marked 🚨.

## Read before your first commit

1. [../Docs/PRD.md](../Docs/PRD.md) - what we build and why
2. [../Docs/ARCHITECTURE.md](../Docs/ARCHITECTURE.md) - how it works, all diagrams
3. [../Docs/API_DOCS.md](../Docs/API_DOCS.md) - every endpoint contract
4. [../Docs/DEVELOPMENT_PLAN.md](../Docs/DEVELOPMENT_PLAN.md) - phases, hours, owners
5. [../Docs/REPO_STRUCTURE.md](../Docs/REPO_STRUCTURE.md) - who owns which file
6. Your own `src/<division>/README.md`

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · **Tailwind v4** (CSS config in `app/globals.css`,
there is no `tailwind.config.ts`) · PostgreSQL + Drizzle · `@x402/*` + algosdk · Algorand TestNet.

> ⚠️ This is Next.js 16. See [`AGENTS.md`](AGENTS.md) - APIs and conventions differ from older
> versions. Check `node_modules/next/dist/docs/` before writing routing or data-fetching code.

## Setup

```bash
npm install
cp .env.example .env.local     # fill from the group chat
npm run db:push && npm run db:seed
npm run dev
```

Two dependency groups are **not** installed yet, on purpose:

| Group | Installed by | When |
|---|---|---|
| `@x402/fetch @x402/avm @x402/next` | PAY | Phase 0, after pinning the real versions |
| `ai @ai-sdk/groq` | DEMO | Phase 4c, only for the prompt-injection demo |

## Non-negotiable rules

1. The policy decision is **deterministic**. No LLM ever decides whether money may leave a wallet.
2. **Deny by default.** Unknown merchant, unknown network, missing policy or an engine error all
   resolve to `BLOCK`.
3. The agent **never holds a private key**. The signer lives behind the Guard.
4. Every decision is written to the audit log **before** the payment is signed.
5. Testnet payments are **real payments**. Never call them "simulated".
6. Money is stored as integer minor units (`bigint`), never as a float.

