// OWNER: DEMO · BudgetBot has already spent 100% of its hourly allowance. EXPECT: BUDGET_EXCEEDED.
//
// This used to try to spend a budget down inside one burst, which cannot work: exhausting a $1.00
// hourly budget at $0.08 a call needs twelve settlements, and the velocity rule stops the agent at
// five a minute — so velocity always fired first and the budget rule was never reached. The seed
// now hands BudgetBot a spent allowance, which is also the honest version of the story: the
// interesting moment is the payment *after* the budget is gone, not the grind of using it up.
//
// Costs nothing. The payment is refused, so no USDC moves and the scenario can be re-run all day.
//
// Which window trips is left to the engine and printed from its own message, rather than named
// here. The seed counts back from a fixed epoch (seed.ts T0) so every reseed produces the same
// timeline — which means seeded spend lands in the month window, not the current hour. Setting
// all three limits to the same $0.50 makes the scenario true whichever one the engine reaches
// first, and removes any dependence on what time the database was seeded.
import { BUDGET_EXHAUSTED_GUARD_KEY, guardedFetch } from "@/demo/agent/guardedFetch";
import { TOOL_ENDPOINTS } from "@/demo/agent/tools";
import { PRICING } from "@/demo/sandbox/pricing";

/** Mirrors the seeded BudgetBot policy — hourly, daily and monthly are all this. */
const BUDGET_USD = "0.50";

export async function run(log: (line: string) => void = console.log): Promise<void> {
  const url = TOOL_ENDPOINTS.search;
  const priceUsd = PRICING[url];
  log(`[D5] BudgetBot has spent ${BUDGET_USD} of its ${BUDGET_USD} allowance`);
  log(`[D5] POST ${url} ($${priceUsd}) — one more call, expect BUDGET_EXCEEDED`);

  const result = await guardedFetch(url, { query: "quarterly market data" }, "D5: payment after budget exhaustion", {
    guardKey: BUDGET_EXHAUSTED_GUARD_KEY,
  });

  if (result.ok) {
    throw new Error(`[D5] SETTLED (tx: ${result.txHash}) — the budget ledger did not fire`);
  }
  if (result.blocked?.code !== "BUDGET_EXCEEDED") {
    throw new Error(`[D5] expected BUDGET_EXCEEDED, got ${result.blocked?.code ?? "an unreadable response"}: ${result.blocked?.message ?? ""}`);
  }

  log(`[D5] BLOCK BUDGET_EXCEEDED: ${result.blocked.message}`);
  log(`[D5] attempted $${priceUsd}, spent $0.00 — the ledger refused it before anything was signed`);
  log("[D5] PASS — a spent budget stops the next payment, not the one after it");
}
