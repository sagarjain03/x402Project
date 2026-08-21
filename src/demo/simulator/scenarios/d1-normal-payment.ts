// OWNER: DEMO · One $0.02 search. EXPECT: ALLOW + a real transaction id on Algorand TestNet.
import { guardedFetch } from "@/demo/agent/guardedFetch";
import { TOOL_ENDPOINTS } from "@/demo/agent/tools";
import { PRICING } from "@/demo/sandbox/pricing";
import { waitForVelocityHeadroom } from "@/demo/simulator/velocity";

export async function run(log: (line: string) => void = console.log): Promise<void> {
  const url = TOOL_ENDPOINTS.search;
  const priceUsd = PRICING[url];
  // A scenario that ran seconds ago may still be holding the velocity window.
  await waitForVelocityHeadroom(1, log);
  log(`[D1] POST ${url} (${priceUsd}) — expect ALLOW + tx hash`);

  const result = await guardedFetch(url, { query: "x402 adoption data 2026" }, "D1: search for x402 adoption data");

  if (!result.ok) {
    throw new Error(`[D1] UNEXPECTED BLOCK ${result.blocked?.code}: ${result.blocked?.message}`);
  }
  if (!result.txHash) {
    throw new Error("[D1] ALLOWED but no tx hash returned — settlement proof is missing");
  }

  const data = result.data as { results?: unknown[] } | undefined;
  log(`[D1] ALLOW — received ${data?.results?.length ?? 0} search results`);
  log(`[D1] txHash: ${result.txHash}`);
  log(`[D1] proof: ${result.explorerUrl ?? "(no explorer for this rail)"}`);
  log(`[D1] attempted $${priceUsd}, spent $${priceUsd}`);
}
