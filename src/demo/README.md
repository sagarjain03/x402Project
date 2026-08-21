# 🟧 DEMO - Sandbox, AI agent & submission

> **Mission:** own both ends of the story - the merchants that charge money and the AI agent that
> tries to spend it - then prove on camera that the Guard contained it.

| | |
|---|---|
| **Owner role** | `DEMO` (D4 Sandbox & Demo in `Docs/DEVELOPMENT_PLAN.md`) |
| **Phases** | P0b (sandbox), P4c (agent + simulator), P5 (attack drills), P6 (video + PPT) |
| **Critical path** | ⚠️ Owns the submission. Nothing ships without this division. |
| **Blocked by** | Nobody. The sandbox is standalone x402; the agent talks HTTP only. |

> 👉 **Start here: [BUILD.md](./BUILD.md)** — checkpoints C1–C7, commit messages and the frozen
> gateway contract you code against without waiting for PAY. This README is the context; that file is
> the order of work.

---

## 1. What this division is about

Three jobs:

1. **Merchant sandbox** - six real x402 sellers. Real `402`, real `PAYMENT-REQUIRED`, real settlement
   through the public facilitator. We own them so the demo never depends on a third-party API being
   up while a judge is watching.
2. **The AI agent** - the thing under guard. A thin tool-calling agent that pays for what it uses.
3. **Proof** - the simulator, the attack drills, the README, the video and the PPT.

---

## 2. Folder map

| Path | What it does |
|---|---|
| `sandbox/pricing.ts` | One table of endpoint -> price. The single source of truth for demo prices. |
| `sandbox/middleware.ts` | `@x402/next` payment middleware config: network, payTo, facilitator. |
| `sandbox/data.ts` | Canned responses, so a seller never depends on a real upstream service. |
| `handlers/sandbox-*.ts` | The six seller route bodies. |
| `handlers/simulator-run.ts` | `POST /api/v1/simulator/run`. |
| `agent/guardedFetch.ts` | ⭐ The agent's ONLY way to reach the outside world: `POST /api/gw/request`. |
| `agent/tools.ts` | The five paid tools. Shared by both drivers. |
| `agent/prompts.ts` | System prompt, including the budget-awareness line. |
| `agent/run.ts` | The LLM driver: `generateText` + tools + `maxSteps`. ~40 lines. |
| `simulator/index.ts` | The deterministic driver. Same tools, no LLM, repeatable. |
| `simulator/scenarios/*` | One file per demo scenario, D1 to D7. |
| `drills/*` | The ten attack drills from `DEVELOPMENT_PLAN.md` section Phase 5. |
| `fixtures/poisoned.ts` | The prompt-injection payload embedded in a search result. |

---

## 3. Two drivers, one tool layer

| Driver | Used for | Why |
|---|---|---|
| `simulator/` (deterministic) | D1-D5, D7, drills, e2e tests | Identical result every run. Safe in front of judges. |
| `agent/run.ts` (real LLM) | **D6 prompt injection** | The injection must genuinely work on a model, or we are faking the threat |

Both call the same `guardedFetch`. The Guard cannot tell them apart - which is itself a point worth
making on camera.

---

## 4. Agent architecture

```
agent/run.ts  (LLM decides WHICH tool)
      |
agent/tools.ts  search · extract · factCheck · summarize · premiumReport
      |
agent/guardedFetch.ts  ->  POST /api/gw/request   [X-Guard-Key only]
                                  |
                                  -> the Guard does 402 -> evaluate -> sign -> settle
```

**The agent holds no private key, no RPC URL and no signer.** It has one credential and one endpoint.
That is the product thesis expressed as an architecture.

A `402` response is returned to the agent as data, not thrown as an error, so the agent can adapt -
pick a cheaper tool, skip a step, report the block. That is the PS phrase *"maintaining a seamless
autonomous payment experience"*.

⚠️ The system prompt tells the agent its remaining budget. **That is UX, not enforcement.** An injected
agent ignores the prompt entirely and the Guard still stops it. Say this explicitly in the video.

---

## 5. Dependencies

| Direction | Detail |
|---|---|
| **Imports** | `@/shared/*` only |
| **Talks to the Guard** | Over HTTP (`/api/gw/request`). Never by importing `@/payments`. |
| **Needs from PAY** | The real `PAYMENT-REQUIRED` shape after Phase 0 |
| **Needs from CORE** | Nothing at build time |
| **Day-0 unblock** | The sandbox is a standalone x402 seller. Build it before the Guard exists. |

---

## 6. Demo scenarios

| ID | Scenario | Expected | Judge sees |
|---|---|---|---|
| D1 | Normal $0.01 search | 🟢 ALLOW | tx hash on BaseScan |
| D2 | $2.00 premium report | 🔴 BLOCK | reason chip, **no tx hash** |
| D3 | VelocityBot: 20 searches in one burst | 🟢 x5 then 🔴 | velocity meter maxes out |
| D4 | Unallowlisted merchant | 🔴 BLOCK | merchant allowlist reason |
| D5 | BudgetBot: one call, allowance already spent | 🔴 BLOCK | budget gauge already at 100 % |
| D6 | **Prompt injection, 1000 x $2 ordered** | contained | attempted $2,000, spent $0.03 |
| D7 | $0.50 payment | 🟡 HOLD -> approve | payment resumes and settles |

---

## 7. Demo safety

Live LLM in front of judges is a risk. Three layers:

1. `temperature: 0` and `maxSteps: 25` - a hard ceiling regardless of what the model does.
2. **Record D6 the moment it works.** The video is a required deliverable anyway.
3. If Groq is unavailable, the deterministic driver replays the same scenario against the same tools.
   Only the decider changes.

---

## 8. Definition of done

- [ ] All six sellers return a real `402` with a decodable `PAYMENT-REQUIRED`.
- [ ] 7/7 scenarios pass on the **deployed** URL from one button click each.
- [ ] `Docs/ATTACK_DRILLS.md` records attempted spend vs actual spend for all ten drills.
- [ ] `db:reset` returns the demo to a clean state in one click.
- [ ] README, PPT, video and demo links are live and open in incognito.

