<div align="center">

# 🛡️ WARDEN
### Agent Spend Policy Guard (ASPG)

**A policy-enforcement gateway for x402 autonomous agent payments**

Built for ACTS EDC **Brainwave 2026** · Problem Statement Set-2 · **PS-1**

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-Drizzle-336791?logo=postgresql&logoColor=white)
![Algorand](https://img.shields.io/badge/Algorand-TestNet-00D4AA?logo=algorand&logoColor=white)
![x402](https://img.shields.io/badge/x402-v2.22.0-purple)
![Deterministic](https://img.shields.io/badge/decisions-deterministic%20%7C%20no%20LLM-critical)

</div>

<br/>

> ### 💬 The one sentence this project is judged on
> ### *"The agent tried to spend $2. The Guard refused. The blockchain has no record of the attempt."*

<br/>

## ⚡ At a Glance

| | |
|---|---|
| 🧠 **Policy Engine** | 10 rules + 7-signal risk score · **deterministic, zero LLM** |
| 🔑 **Key Custody** | Agent never touches a private key — signer lives behind the Guard |
| ⛓️ **Settlement** | Real USDC on Algorand TestNet (ASA `10458941`) — never "simulated" |
| 📋 **Audit Trail** | SHA-256 hash-chained, written **before** signing, tamper-evident |
| 🚫 **Default Posture** | Deny-by-default — unknown merchant/network/asset → `BLOCK` |
| 💰 **Money Type** | Always `bigint` minor units — never a float |

<br/>

---

## 🌊 How It Works

```mermaid
flowchart LR
    AG(["🤖 <b>Agent</b>"])
    GW{{"🛡️ <b>Guard</b>"}}
    CORE[["🧠 <b>Policy Engine</b>"]]
    SIGN(("🔑 <b>Signer</b>"))
    SELL[/"🏪 <b>Merchant</b>"/]
    CHAIN(("🌐 <b>Algorand</b>"))
    AUDIT[("📋 <b>Audit</b>")]

    AG -- "request" --> GW
    GW -- "quote" --> SELL
    SELL -- "402" --> GW
    GW --> CORE
    CORE -.-> AUDIT

    CORE == "🔴 BLOCK" ==> X["❌ nothing signed"]
    CORE == "🟡 HOLD" ==> H["⏸️ human review"]
    CORE == "🟢 ALLOW" ==> SIGN
    SIGN -- "signed" --> SELL
    SELL --> CHAIN
    SELL -- "✅ txHash" --> AG

    classDef agent fill:#292524,stroke:#a8a29e,color:#fff
    classDef guard fill:#1e1b4b,stroke:#818cf8,color:#fff,stroke-width:2px
    classDef core fill:#7f1d1d,stroke:#f87171,color:#fff,stroke-width:2px
    classDef ok fill:#14532d,stroke:#4ade80,color:#fff
    classDef bad fill:#450a0a,stroke:#f87171,color:#fff
    classDef warn fill:#451a03,stroke:#fbbf24,color:#fff
    classDef store fill:#1e3a8a,stroke:#60a5fa,color:#fff

    class AG agent
    class GW guard
    class CORE core
    class SIGN,SELL,CHAIN ok
    class X bad
    class H warn
    class AUDIT store
```

<br/>

## 🧩 Module Map

```mermaid
graph TD
    SHARED(["❄️ <b>shared</b><br/>types · errors · money"])
    CORE(["🧠 <b>core</b><br/>engine · ledger · audit"])
    PAY(["🔴 <b>payments</b><br/>x402 · signer · gateway"])
    UI(["🟢 <b>dashboard</b><br/>pages · components"])
    DEMO(["🟠 <b>demo</b><br/>sandbox · agent · drills"])

    SHARED -.-> CORE & PAY & UI & DEMO
    CORE == "evaluate · reserve" ==> PAY
    PAY == "HTTP" ==> DEMO
    CORE == "HTTP" ==> UI
    PAY == "HTTP" ==> UI

    classDef shared fill:#1e3a5f,stroke:#3b82f6,color:#fff,stroke-width:2px
    classDef core fill:#1e1b4b,stroke:#818cf8,color:#fff,stroke-width:2px
    classDef pay fill:#450a0a,stroke:#f87171,color:#fff,stroke-width:2px
    classDef ui fill:#052e16,stroke:#4ade80,color:#fff,stroke-width:2px
    classDef demo fill:#431407,stroke:#fb923c,color:#fff,stroke-width:2px

    class SHARED shared
    class CORE core
    class PAY pay
    class UI ui
    class DEMO demo
```

<br/>

## 🔁 Payment Flow

```mermaid
sequenceDiagram
    autonumber
    actor Agent as 🤖 Agent
    participant Guard as 🛡️ Guard
    participant Core as 🧠 Engine
    participant Seller as 🏪 Merchant
    participant Chain as 🌐 Algorand

    Agent->>Guard: request
    Guard->>Seller: forward
    Seller-->>Guard: 402 payment required
    Guard->>Core: evaluate()
    Core-->>Core: 📋 write audit row

    rect rgb(69, 10, 10)
    Core-->>Guard: 🔴 BLOCK
    Guard-->>Agent: 402 · nothing signed
    end

    rect rgb(69, 26, 3)
    Core-->>Guard: 🟡 HOLD
    Guard-->>Agent: 202 · awaiting human
    end

    rect rgb(20, 83, 45)
    Core-->>Guard: 🟢 ALLOW
    Guard->>Guard: 🔑 sign payload
    Guard->>Seller: retry + signature
    Seller->>Chain: settle USDC
    Chain-->>Seller: txHash
    Seller-->>Agent: 200 · txHash
    end
```

<br/>

## 🌳 Policy Engine — 10 Gates, First Block Wins

```mermaid
flowchart TD
    START(["📥 New Payment"])
    GATES{{"🚧 <b>10 Sequential Gates</b><br/><br/>1️⃣ agent active<br/>2️⃣ network + asset allowed<br/>3️⃣ merchant not blocked<br/>4️⃣ merchant allowlisted<br/>5️⃣ recipient pinned<br/>6️⃣ per-tx limit<br/>7️⃣ absolute ceiling<br/>8️⃣ budget window<br/>9️⃣ velocity<br/>🔟 wallet allowance"})
    RISK{{"🎯 <b>Risk Score 0-100</b>"}}
    ALLOW(["🟢 ALLOW"])
    HOLD(["🟡 HOLD"])
    BLOCK(["🔴 BLOCK"])

    START --> GATES
    GATES -- "❌ any gate fails" --> BLOCK
    GATES -- "✅ all pass" --> RISK
    RISK -- "≥ 60" --> BLOCK
    RISK -- "30 – 59" --> HOLD
    RISK -- "< 30" --> ALLOW
    START -.->|"⚠️ exception / no policy"| BLOCK

    classDef start fill:#1e3a8a,stroke:#60a5fa,color:#fff
    classDef gate fill:#1c1917,stroke:#a8a29e,color:#fff,text-align:left
    classDef risk fill:#7f1d1d,stroke:#f87171,color:#fff
    classDef allow fill:#14532d,stroke:#4ade80,color:#fff,stroke-width:3px
    classDef hold fill:#451a03,stroke:#fbbf24,color:#fff,stroke-width:3px
    classDef block fill:#450a0a,stroke:#f87171,color:#fff,stroke-width:3px

    class START start
    class GATES gate
    class RISK risk
    class ALLOW allow
    class HOLD hold
    class BLOCK block
```

<br/>

## 🎯 Risk Scoring — 7 Signals

```mermaid
pie showData
    title Risk score contribution (max points per signal)
    "Blocked attempts recently (+25)" : 25
    "Near daily limit ≥80% (+20)" : 20
    "Velocity near limit ≥80% (+15)" : 15
    "New / unfamiliar merchant (+15)" : 15
    "First payment by agent (+10)" : 10
    "Off-hours payment (+10)" : 10
    "Round-number amount (+5)" : 5
```

```mermaid
flowchart LR
    S(["🎯 Score 0–100"])
    A["🟢 < 30<br/>ALLOW"]
    B["🟡 30–59<br/>HOLD"]
    C["🔴 ≥ 60<br/>BLOCK"]
    S --> A
    S --> B
    S --> C
    classDef a fill:#14532d,stroke:#4ade80,color:#fff
    classDef b fill:#451a03,stroke:#fbbf24,color:#fff
    classDef c fill:#450a0a,stroke:#f87171,color:#fff
    class A a
    class B b
    class C c
```

<br/>

## 💰 Budget Ledger — Race-Safe Accounting

```mermaid
sequenceDiagram
    autonumber
    participant Engine as 🧠 Engine
    participant Ledger as 💰 Ledger
    participant DB as 🗄️ Postgres

    Engine->>Ledger: reserve(agent, amount)
    Note over Ledger,DB: 🔒 advisory lock — other<br/>reservations for this agent WAIT
    Ledger->>DB: sum reserved + committed
    alt 🔴 over budget
        Ledger-->>Engine: BLOCK
    else 🟢 room available
        DB-->>Ledger: row RESERVED
        Ledger-->>Engine: token
    end
    Note over Engine: payment settles on-chain
    Engine->>Ledger: commit()
    Ledger->>DB: row → COMMITTED
    Note over Engine: on any failure
    Engine->>Ledger: release()
    Ledger->>DB: row → RELEASED 💸 refunded
```

<br/>

## 🔗 Audit Log — Tamper-Evident Hash Chain

```mermaid
flowchart LR
    G(("🌱 Genesis"))
    R1["📝 Row 1<br/>BLOCK"]
    R2["📝 Row 2<br/>ALLOW"]
    R3["📝 Row 3<br/>SETTLED"]
    RN["📝 Row N…"]
    V{{"🔍 /audit/verify<br/>recompute all hashes"}}
    OK(["✅ valid: true"])

    G -- "hash" --> R1 -- "hash" --> R2 -- "hash" --> R3 -- "hash" --> RN --> V --> OK

    classDef row fill:#1e3a8a,stroke:#60a5fa,color:#fff
    classDef ends fill:#052e16,stroke:#4ade80,color:#fff
    class G,R1,R2,R3,RN row
    class V,OK ends
```

> 🔒 **Rule:** every decision is written **before** the payment is signed — never after. Tamper with one row and the chain breaks visibly from that point on.

<br/>

## 🎬 Demo Scenarios

| # | Scenario | Result |
|:-:|---|---|
| **D1** | Normal $0.01 search | 🟢 **ALLOW** → tx hash on Lora |
| **D2** | $2.00 premium report | 🔴 **BLOCK** · `PER_TRANSACTION_LIMIT` |
| **D3** | VelocityBot — 20 burst searches | 🟢×5 → 🔴 `VELOCITY_EXCEEDED` |
| **D4** | Unallowlisted merchant | 🔴 **BLOCK** · `MERCHANT_NOT_ALLOWED` |
| **D5** | BudgetBot — allowance spent | 🔴 **BLOCK** · `BUDGET_EXCEEDED` |
| **D6** | 🧪 Prompt injection — 1000×$2 ordered | 🔴 contained — attempted **$2,000**, spent **$0.03** |
| **D7** | $0.50 analyst report | 🟡 **HOLD** → human approves → settles |

<br/>

## 🤖 Agent Boundary — No Private Key, Ever

```mermaid
flowchart TD
    subgraph AGENT["🤖 AGENT — no key, no RPC URL"]
        direction LR
        LLM(["🧠 LLM driver"]) --> TOOLS(["🛠️ 5 paid tools"]) --> FETCH(["📡 guardedFetch()"])
    end

    subgraph GUARD["🛡️ GUARD — owns the key"]
        direction LR
        AUTH(["🔐 auth"]) --> EVAL(["🧠 evaluate"]) --> SIGN(["🔑 sign"])
    end

    FETCH == "HTTP only" ==> AUTH
    SIGN == "payment" ==> SELLER(["🏪 Merchant"])
    SELLER == "txHash" ==> FETCH

    classDef agent fill:#1c1917,stroke:#78716c,color:#fff
    classDef guard fill:#1e1b4b,stroke:#818cf8,color:#fff
    classDef sign fill:#14532d,stroke:#4ade80,color:#fff
    class LLM,TOOLS,FETCH agent
    class AUTH,EVAL guard
    class SIGN sign
```

<br/>

## 🗄️ Data Model

```mermaid
erDiagram
    AGENTS ||--o{ POLICIES : has
    AGENTS ||--o{ PAYMENT_INTENTS : initiates
    AGENTS ||--o{ BUDGET_LEDGER : "tracked by"
    PAYMENT_INTENTS ||--o{ BUDGET_LEDGER : reserves
    PAYMENT_INTENTS ||--o{ AUDIT_LOGS : logs

    AGENTS {
        text status "ACTIVE | FROZEN"
        text wallet_address
    }
    POLICIES {
        text version
        jsonb rules
    }
    PAYMENT_INTENTS {
        bigint amount_minor
        text verdict "ALLOW|HOLD|BLOCK"
        text tx_hash
    }
    BUDGET_LEDGER {
        bigint amount_minor
        text status "RESERVED|COMMITTED|RELEASED"
    }
    AUDIT_LOGS {
        text prev_hash
        text row_hash
    }
```

<br/>

## 🏗️ Build Sequence

```mermaid
gantt
    title 8-hour build sprint by division
    dateFormat HH:mm
    axisFormat %H:%M

    section 🧠 CORE
    types frozen → schema → seed   :done, c0, 00:00, 90m
    policy engine + tests          :done, c1, 02:15, 120m
    /evaluate live                 :done, c2, 04:15, 60m

    section 🔴 PAY
    x402 spike                     :done, p0, 00:00, 240m
    orchestrator                   :done, p1, 02:15, 120m
    signer + allowToken            :done, p2, 04:15, 60m

    section 🟢 UI
    shell + overview               :done, u1, 02:00, 60m
    decision feed                  :done, u2, 03:00, 90m
    transactions + policy editor   :done, u3, 04:30, 150m

    section 🟠 DEMO
    merchant sandbox                :done, d1, 00:00, 120m
    attack drills D1–D7             :done, d2, 05:00, 120m
    agent console                   :done, d3, 07:00, 90m
```

<br/>

## 📜 x402 Handshake

```mermaid
sequenceDiagram
    autonumber
    participant C as 🤖 Client (via Guard)
    participant S as 🏪 Merchant
    participant F as ⚖️ Facilitator

    C->>S: GET resource
    S-->>C: 🔴 402 Payment Required
    Note over C: 🛡️ Guard evaluates policy here
    C->>S: GET resource + PAYMENT-SIGNATURE
    S->>F: /verify
    F-->>S: ✅ isValid
    S->>F: /settle
    F-->>S: 🔗 txHash
    Note over F,S: 💵 real USDC moves on-chain
    S-->>C: 200 OK + resource
```

<br/>

---

## 📁 Where Things Live

```
x402-Brainwaves Project/
├─ Docs/            📄 PRD · architecture · API docs
├─ Initial-Docs/    📋 problem statement + reference PDFs
└─ x402project/     🚀 THIS Next.js app (the git repo)
```

| Path | Owner | Contents |
|---|:-:|---|
| `app/` | 🌐 shared | thin routing, frozen after hour 0 |
| `src/shared/` | ❄️ frozen | types · errors · money helpers |
| `src/payments/` | 🔴 PAY | x402 adapter · signer · gateway |
| `src/core/` | 🧠 CORE | engine · ledger · audit · schema |
| `src/dashboard/` | 🟢 UI | pages & components |
| `src/demo/` | 🟠 DEMO | sandbox · agent · attack drills |

**Build checkpoints:** CORE `C1–C8` blocks PAY@C6 & UI@C8 · PAY `C1–C7` blocks DEMO@C7 · UI `C1–C7` blocks nobody · DEMO `C1–C7` blocks PAY@C1.

```bash
git log --all --oneline | grep -oE "\((core|pay|ui|demo)\): C[0-9]+" | sort -u
```

<br/>

## 🛠️ Stack

`Next.js 16` · `React 19` · `TypeScript` · `Tailwind v4` · `PostgreSQL + Drizzle` · `@x402/* v2.22.0` · `algosdk` · `Algorand TestNet` · `USDC ASA 10458941`

> ⚠️ This is Next.js 16 — see [`AGENTS.md`](AGENTS.md); APIs differ from older versions.

## 🚀 Setup

```bash
npm install
cp .env.example .env.local     # fill from the group chat
npm run db:push && npm run db:seed
npm run dev
```

<br/>

## ⛔ Non-Negotiable Rules

| # | Rule |
|:-:|---|
| 1 | 🧠 Decisions are **deterministic** — no LLM ever decides whether money leaves a wallet |
| 2 | 🚫 **Deny by default** — unknown merchant, network, asset, missing policy, or engine error → `BLOCK` |
| 3 | 🔑 The agent **never** holds a private key — the signer lives behind the Guard |
| 4 | 📋 Every decision is audit-logged **before** signing |
| 5 | 💵 TestNet payments are **real payments** — never call them "simulated" |
| 6 | 🔢 Money is `bigint` minor units — never a float |