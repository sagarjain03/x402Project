# UI Audit Remediation Plan — Checkpoints P1 to P5

This document outlines the phased remediation checkpoints (P1 to P5) derived from [`UI_AUDIT.md`](./UI_AUDIT.md).

---

## **P1: Critical Truth & Blockers (Top 10 Zero-Day Audit Fails)**
*Goal: Eliminate fake successes, server crashes, and broken core controls.*  
**Status:** ✅ Completed

1. **Fix SSE Live Decision Stream:** Update `useLiveDecisions.ts` to listen to named `decision` and `settlement` events (`addEventListener`) instead of `onmessage`, correctly parsing nested payloads.
2. **Remove Fake "Reset Demo":** Remove fake 600ms `setTimeout` simulation in `header.tsx` that pretended to reseed the database.
3. **Bind Audit Verifier State:** Read `verify.valid` and `verify.brokenAt` dynamically in `audit.tsx` instead of rendering a static "Hash Chain Verified · 100% Valid" literal.
4. **Fix Agent Attribution & Fallbacks:** Replace `agentName || "ResearchBot"` and hardcoded `0x9a2B...4a6B` fallback in `transaction-detail.tsx` with genuine agent identifiers/names or honest em dashes (`—`).
5. **Fix Algorand Address Validation:** Update `pinnedRecipients` / `pinnedRecipient` regex in `policyRules.ts` and `merchants.ts` to accept 58-character Base32 Algorand addresses (`/^([A-Z2-7]{58}|0x[a-fA-F0-9]{40})$/i`).
6. **Fix Policy Simulation Crash:** Support structured reason objects (`{code, rule, message}`) alongside strings in `policy-simulation-results.tsx` to prevent React render crashes.
7. **Remove Hazardous Test Validation Button:** Remove the "Test Server Validation Rejection" debug button in `policy-form.tsx` that unintentionally loosened spend limits to $5.00.
8. **Fix Drill D6 Prompt Injection:** Drop caller-side `{ maxAmountUsd: "0.10" }` ceiling in `d6-prompt-injection.ts` so refusal is evaluated and enforced directly by the CORE policy engine.
9. **Add Freeze / Unfreeze UI:** Expose `API.freeze` and `API.unfreeze` endpoints in `endpoints.ts`, adding interactive action buttons to `agent-card.tsx` and `agent-detail.tsx`.
10. **Expose Policy Editor Navigation:** Add direct links from agent cards and agent detail views to `/policies/[agentId]`.

---

## **P2: Deletion of Fakes, Stale EVM Artifacts & Dead Controls**
*Goal: Remove misleading fallbacks, inert buttons, and chain mismatches.*  
**Status:** ✅ Completed

1. **Purge Fabricated Fallbacks:** Replace fake fallbacks (`?? 30`, `?? 24`, `?? 12`, `|| 18`, `|| "0x9a2B..."`) across `overview.tsx`, `transaction-detail.tsx`, and `budget-gauge.tsx` with em dashes (`—`) or honest empty states.
2. **Delete Fake Sparklines & Distortions:** Remove hand-drawn SVG bezier paths (`<path d="M 0,45...">`) and progress bar multipliers (`×2`, `×4`) in `overview.tsx` and `transactions.tsx`.
3. **Clean Up Dead UI Controls:** Remove or wire non-functional buttons ("Filters", "More filters", date range pill, and static pulsing "Gateway Live" badge).
4. **Delete Dead Code & Mock Fixtures:** Delete `src/dashboard/mock/` (1,183 lines of stale Base Sepolia fixtures) and unused `src/dashboard/shell/sidebar.tsx`.
5. **Eliminate EVM Terminology Leaks:** Replace "BaseScan", "Zero-Gas", and "EVM RPC call" with Algorand explorer links, zero-settlement disclosures, and correct network terminology.
6. **Consolidate `/merchants`:** Merge read-only merchant controls into the Policy Editor and drop the standalone page from the nav.

---

## **P3: Evidence & Auditability Surfacing**
*Goal: Surface backend proof (ledger, hash chain, policy rules) directly in the UI.*  
**Status:** ✅ Completed

1. **Transaction Evidence Screen (`/transactions/[id]`):** Render the returned `ledger` (Reserve $\rightarrow$ Commit/Release) and `audit` hash chain (`prevHash → rowHash`, `DECISION` before `PAYMENT_SETTLED`).
2. **Transaction Details & Signals:** Display full `riskSignals`, complete list of rule rejection reasons, payee address, and actionable Approve/Reject buttons for `HOLD` states.
3. **Transaction List Enhancements (`/transactions`):** Add reason column using `reason-chip.tsx`, wire `?decision=ALLOW|HOLD|BLOCK` filter buttons, and fix relative timestamp formatting ("8544m ago").
4. **Interactive Audit Page (`/audit`):** Add a live "Verify Now" button, render missing audit fields (`actor`, `payload`, `agentId`, `intentId`), and wire backend query filters.
5. **Interactive Policy Simulator (`/policies/[id]`):** Promote "Simulate Impact" to Tab 1, display missing rules (such as `unknownMerchantAction`), and render field-level Zod validation errors.

---

## **P4: Workflow Integrity, Approvals & Console Demo Flow**
*Goal: Perfect the reviewer and operator flows, promote the live console.*  
**Status:** ✅ Completed

1. **Reorder Navigation Flow:** Restructure primary nav order for demo impact:  
   `1. Overview` $\rightarrow$ `2. Agent Console` $\rightarrow$ `3. Transactions` $\rightarrow$ `4. Approvals` $\rightarrow$ `5. Policies` $\rightarrow$ `6. Audit` $\rightarrow$ `7. Attack Drills`.
2. **Promote `/console` (Live Demo Screen):** Move enforcement counters above the fold, display human-readable refusal messages from `shared/errors.ts`, display active spend limits, and support selecting newly registered agents.
3. **Fix `/approvals` Reviewer Workflow:** Add reviewer email, note, and destination payee address; fix toast unmounting race condition; sweep expired holds.
4. **Refactor `/simulator` to "Attack Drills":** Rename page, fix "Blocked Spend" accumulator, remove unattended D7 from "Run All", and ensure cards cite specific policy rules.
5. **Standardized Error Boundaries:** Replace swallowed `console.error` catches with unified `<ErrorCard onRetry={...}/>` components across all pages.

---

## **P5: Network Optimization, Layout, A11y & Visual Polish**
*Goal: Fix DevTools waterfall, mobile layouts, and UX consistency.*  
**Status:** ✅ Completed

1. **Eliminate Redundant Network Requests:**
   - Decouple `FundFlow` on-mount load from parent page re-fetch.
   - De-duplicate `usePendingApprovals` polling between `header.tsx` and `approvals.tsx`.
   - Gate approvals interval timer when queue is empty.
2. **Landing Page Re-cut (`/overview`):** Shorten 85vh hero, add explicit spend-control explanation copy, lead with enforcement metrics above the fold, and restore header navigation.
3. **Consistency Pass:**
   - Standardize dollar currency formatting (resolve missing `$` on Console).
   - Standardize timestamp formatting across tables.
   - Unify state terminology (standardize `HOLD` vs `PENDING` vs `RESERVED`).
4. **Responsive Layout & Accessibility:** Fix header menu overflow between 768px and 1270px, provide mobile drawer nav, make table rows keyboard accessible (`Tab`/`Enter`), and fix low-contrast empty states.
