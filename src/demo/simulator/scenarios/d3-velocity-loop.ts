// OWNER: DEMO · 20 searches in a burst. EXPECT: 5 settle, the rest block VELOCITY_EXCEEDED.
//
// The rule that fires is maxTxPerMerchantPerMinute (5), not maxTxPerMinute (10). Every sandbox
// seller is served from localhost:3000, so the per-merchant limit is always the binding one and
// the global limit can never be reached. Saying "10" on a slide and showing 5 on screen is a gap
// a judge will notice, so both this file and the simulator page say 5.
//
// Uses search ($0.02) rather than fact-check ($0.08): the point is which rule stops the burst,
// not how much it costs to find out, and $0.40 a run is a quarter of the hourly budget D7 needs.
//
// Pays as VelocityBot, not ResearchBot. Risk score is per-agent history: a block anywhere in the
// last five minutes is worth 25 points, and the fifth call of a five-per-minute burst is worth 15
// more — together enough to hold the payment for review before the velocity rule is ever reached.
// Running after D2 or D4 did exactly that. A separate agent makes the burst mean one thing only.
import { BURST_GUARD_KEY, guardedFetch, type GuardedResult } from "@/demo/agent/guardedFetch";
import { TOOL_ENDPOINTS } from "@/demo/agent/tools";
import { PRICING } from "@/demo/sandbox/pricing";
import { MAX_PER_MERCHANT_PER_MINUTE, waitForVelocityHeadroom } from "@/demo/simulator/velocity";

const CALLS = 20;
const MAX_SETTLED = MAX_PER_MERCHANT_PER_MINUTE;
const EXPECTED_RULE = "velocity.maxTxPerMerchantPerMinute";

export async function run(log: (line: string) => void = console.log): Promise<void> {
  const url = TOOL_ENDPOINTS.search;
  const priceUsd = PRICING[url];
  // Needs the window empty, not merely open: the point is to show exactly where the limit is,
  // and starting halfway through it would block early and prove nothing.
  await waitForVelocityHeadroom(MAX_SETTLED, log, "VelocityBot");
  log(`[D3] ${CALLS} × POST ${url} (${priceUsd}) in one burst — expect ×${MAX_SETTLED} ALLOW then BLOCK`);

  const results: GuardedResult[] = [];
  for (let i = 1; i <= CALLS; i++) {
    results.push(await guardedFetch(url, { query: `velocity probe ${i}` }, `D3: velocity loop call ${i}`, {
      guardKey: BURST_GUARD_KEY,
    }));
  }

  const settled = results.filter((r) => r.ok);
  const blocked = results.filter((r) => !r.ok);
  const firstVelocityBlock = results.findIndex((r) => !r.ok && r.blocked?.code === "VELOCITY_EXCEEDED");

  settled.forEach((_, i) => log(`[D3] call ${i + 1}: ALLOW (settled)`));
  if (blocked.length > 0) log(`[D3] BLOCK ${blocked[0].blocked?.code}: ${blocked[0].blocked?.message}`);
  log(`[D3] ...and ${blocked.length - 1} more identical blocks`);

  const spent = (settled.length * Number(priceUsd)).toFixed(2);
  log(`[D3] attempted $${(CALLS * Number(priceUsd)).toFixed(2)}, spent $${spent}`);

  if (firstVelocityBlock === -1) {
    throw new Error(`[D3] ${settled.length}/${CALLS} settled and none blocked VELOCITY_EXCEEDED — the velocity rule did not fire`);
  }
  // Exactly, not at most. Fewer means the window was already partly used and the run demonstrated
  // nothing about where the limit sits — which is how this passed green while settling zero.
  if (settled.length !== MAX_SETTLED) {
    throw new Error(`[D3] ${settled.length} settled, expected exactly ${MAX_SETTLED} — the velocity window was not clear at the start`);
  }
  // Which velocity limit stopped it is the whole claim, so assert it rather than trusting the count.
  const message = blocked[0]?.blocked?.message ?? "";
  if (!message.includes(`limit of ${MAX_SETTLED}`)) {
    throw new Error(`[D3] blocked, but not by ${EXPECTED_RULE} at ${MAX_SETTLED}: "${message}"`);
  }
  log(`[D3] velocity rule fired at call ${firstVelocityBlock + 1} — ${EXPECTED_RULE} held at ${MAX_SETTLED}`);
}
