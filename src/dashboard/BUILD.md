# 🟩 UI — build checklist

Read [README.md](./README.md) once for context. **This file is your order of work.** One checkpoint =
one commit. Never start C(n+1) before C(n) is green.

| | |
|---|---|
| **Branch** | `ui/<slice>` — e.g. `ui/dashboard-shell`, `ui/decision-feed` |
| **You own** | `src/dashboard/**` and `app/(dashboard)/**` |
| **You never touch** | `src/core/**`, `src/payments/**`, `src/demo/**`, `app/api/**` |
| **You depend on** | Nobody, ever. MSW fixtures at C1, real API whenever CORE's C8 lands. |
| **People waiting on you** | Nobody — but this is what the judges actually look at. |

---

## Before you start

```bash
git pull origin main
npm install
cp .env.example .env.local        # set DATABASE_URL
npm run db:push && npm run db:seed
npm run dev
```

The seeded database is your source of truth for shapes: **30 settled, 8 blocked, 2 held**, 4 agents
(one `ACTIVE`, one `FROZEN`), 3 policy versions on ResearchBot. Build fixtures from those exact rows
and the swap to the live API changes nothing visible.

---

## Commit convention

```
<type>(ui): C<n> <what changed>
```

Examples:

```
feat(ui): C3 dashboard shell and overview page
feat(ui): C4 live decision feed with SSE reconnect
fix(ui): C5 blocked rows now state no transaction created
```

Team-wide progress:

```bash
git log --all --oneline | grep -oE "\((core|pay|ui|demo)\): C[0-9]+" | sort -u
```

---

## Progress

| | Checkpoint | Unblocks | Done |
|---|---|---|---|
| C1 | Fixtures + MSW handlers | everything below | ☐ |
| C2 | Typed API client | C3 | ☐ |
| C3 | Shell + Overview | C4 | ☐ |
| C4 | Decision feed + badges | the demo's centre | ☐ |
| C5 | Transactions + detail | the "no tx hash" proof | ☐ |
| C6 | Agents + budget gauges + charts | C7 | ☐ |
| C7 | Policy editor, approvals, simulator | submission | ☐ |

---

## C1 — Fixtures and MSW handlers

**Goal.** A complete fake API so you never wait for CORE.

**Files.** `mock/fixtures.ts`, `mock/handlers.ts`

**How to get real shapes.** Query the seeded database and copy the actual rows:

```bash
npm run dev
# once CORE ships C8 these return real data; until then, read the DB directly with pgAdmin
```

Cover at minimum: `GET /api/v1/transactions`, `/metrics/summary`, `/agents`, `/agents/:id`,
`/policies/:agentId`, `/approvals`, `/audit`.

**Contract — every fixture is wrapped in the envelope. This is the single thing that makes the
swap free later:**

```ts
{ status: true, statusCode: 200, data: { transactions: [...], total: 40 } }
```

Your components read `response.data`. They never read a top-level field other than `status` and
`message`.

**Money is a decimal string.** `"0.05"`, not `0.05`. Never `parseFloat` it in the browser — render
the string.

**Done when.** `npm run dev` renders a page from MSW with the API server stopped.

**Commit.** `feat(ui): C1 MSW fixtures mirroring the seeded database shapes`

---

## C2 — Typed API client

**Goal.** One place that talks to the server. Nothing else in the division uses `fetch`.

**Files.** `api-client/client.ts`, `api-client/endpoints.ts`

**Contract.**

```ts
// Unwraps the envelope once, so no component ever writes response.data.
async function apiGet<T>(path: string): Promise<T>
async function apiPost<T>(path: string, body: unknown): Promise<T>
```

On `status: false`, throw an error carrying `error.code` and `message` — the policy editor renders
the server's own message, so do not invent your own text.

**Hard rule.** Never import `@/core`, `@/payments`, `@/demo` or anything under `db/`. ESLint fails
the build if you try. Importing server code into a client component leaks secrets into the browser
bundle.

**Done when.** Switching MSW off and pointing at `localhost:3000` requires **zero component
changes**.

**Commit.** `feat(ui): C2 typed API client that unwraps the response envelope`

---

## C3 — Shell and Overview

**Files.** `shell/shell.tsx`, `shell/sidebar.tsx`, `shell/header.tsx`, `pages/overview.tsx`

`app/(dashboard)/layout.tsx` and the page files are 2-line re-exports — put the real markup in
`src/dashboard/`, not in `app/`.

**Overview must show four things:**

| Tile | Why |
|---|---|
| Spend today | the ordinary case |
| Decision counts (ALLOW / HOLD / BLOCK) | the mix |
| **"Money refused"** | ⭐ the number that sells the product |
| Top block reasons | proves the rules are doing work |

**Done when.** The overview renders from fixtures with the API off, and "money refused" shows a
non-zero dollar figure.

**Commit.** `feat(ui): C3 dashboard shell and overview with the money-refused tile`

---

## C4 — Decision feed ⭐ the demo's centre of gravity

**Files.** `components/decision-badge.tsx`, `reason-chip.tsx`, `decision-feed.tsx`,
`hooks/useLiveDecisions.ts`

**Visual rules — non-negotiable, a judge reads these in ten seconds:**

| Decision | Colour | Must always show |
|---|---|---|
| 🟢 `ALLOW` | green | amount, merchant, **tx hash linked to BaseScan** |
| 🟡 `HOLD` | amber | amount, merchant, countdown to expiry |
| 🔴 `BLOCK` | red | amount, merchant, **reason chip**, and the words **"no transaction created"** |

`reason-chip.tsx` maps an `ErrorCode` from `@/shared/errors` to a human sentence. Import the codes —
do not retype them as string literals, or a renamed code silently renders blank.

The feed subscribes to `GET /api/v1/events/stream` (SSE). Reconnect on drop; never let a dead socket
show a frozen list during the demo.

**Done when.** A new decision appears in the feed within 2 seconds, and a blocked row visibly states
that no transaction was created.

**Commit.** `feat(ui): C4 live decision feed with colour-coded badges and reason chips`

---

## C5 — Transactions and detail

**Files.** `pages/transactions.tsx`, `pages/transaction-detail.tsx`, `components/tx-table.tsx`,
`components/tx-timeline.tsx`

The detail page is where the argument is won. Show the full chain:

```
intent → evaluation → reasons → risk signals → tx hash → explorer link
```

For a blocked intent, the tx hash row must render an explicit **"no transaction created"**, not an
empty cell. An empty cell reads as a bug; the sentence reads as enforcement.

**Done when.** Filters work (by decision, by agent, by date) and every seeded blocked intent shows
its reason code and no hash.

**Commit.** `feat(ui): C5 transactions table and detail timeline`

---

## C6 — Agents, gauges and charts

**Files.** `pages/agents-list.tsx`, `pages/agent-detail.tsx`, `components/agent-card.tsx`,
`budget-gauge.tsx`, `velocity-meter.tsx`, `charts/spend-area.tsx`, `charts/decision-bar.tsx`

Budget gauges are reused on three pages — build them once, properly.

The seeded `DataBot` is `FROZEN` with a reason. Render frozen agents distinctly; rule 1 of the policy
engine has a live subject and the demo shows it.

Recharts only. No new chart library.

**Done when.** Both seeded agents render with correct utilisation, and D5's budget gauge visibly
reaches 100 %.

**Commit.** `feat(ui): C6 agent pages with budget gauges and spend charts`

---

## C7 — Policy editor, approvals, simulator

**Files.** `pages/policy-editor.tsx`, `components/policy-form.tsx`, `pages/approvals.tsx`,
`pages/simulator.tsx`, `pages/merchants.tsx`, `pages/audit.tsx`

**Policy editor** is the biggest single page. Form + JSON view + validation errors + version history
and diff. The form mirrors `PolicyRules` from `@/shared/types` field for field — import the type so
a schema change is a compile error, not a silent gap.

**Approvals** is the HOLD inbox: countdown to expiry, approve, reject. Two seeded rows are already
`PENDING`.

**Simulator** is the judge-facing page: one button per scenario D1–D7, calling
`POST /api/v1/simulator/run`. DEMO owns the endpoint; you own the buttons.

**Cut order if time runs short:** merchants → audit → approvals. Never cut the simulator page.

**Done when.** The policy editor rejects an invalid policy showing the **server's** error message.

**Commit.** `feat(ui): C7 policy editor with version diff and validation`

---

## The swap to the real API

When CORE announces C8, this is the entire integration:

```diff
- worker.start()   // MSW
+ // MSW off, api-client hits localhost:3000
```

If anything else needs to change, C1 or C2 was built wrong. Fix it there, not in the components.

---

## Frozen contracts — do not work around these

| What | Why |
|---|---|
| Read `response.data`, never a top-level field | envelope is `CLAUDE.md` §1 |
| Money stays a string end to end | `parseFloat` on money is the worst bug class in this project |
| Import `ErrorCode` from `@/shared/errors` | a renamed code becomes a compile error, not a blank chip |
| Never import server code | it leaks secrets into the browser bundle |

---

## Definition of done

- [ ] All six demo scenarios readable end-to-end in the browser with no terminal open
- [ ] A blocked row visibly states that no transaction was created
- [ ] A new decision appears in the live feed within 2 seconds
- [ ] The policy editor rejects an invalid policy with the server's own message
- [ ] Every page renders against `mock/handlers.ts` with the API switched off
