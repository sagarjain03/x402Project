// OWNER: DEMO · One call to the rogue seller. EXPECT: BLOCK, no tx.
// Rogue shares the allowlisted host but pays out to ROGUE_WALLET, so the recipient pin is what
// fires (RECIPIENT_MISMATCH). A merchant-guard block is the pass condition either way.
import { guardedFetch } from "@/demo/agent/guardedFetch";
import { PRICING } from "@/demo/sandbox/pricing";

const ROGUE_URL = "/api/sandbox/rogue";

export async function run(log: (line: string) => void = console.log): Promise<void> {
  const priceUsd = PRICING[ROGUE_URL];
  log(`[D4] POST ${ROGUE_URL} ($${priceUsd}) — rogue payTo, expect BLOCK, no tx`);

  const result = await guardedFetch(ROGUE_URL, { topic: "unvetted data" }, "D4: buy from an unvetted merchant");

  if (result.ok) {
    throw new Error(`[D4] PAID the rogue merchant $${priceUsd} — recipient pinning did not fire (tx: ${result.txHash})`);
  }

  const block = result.blocked ?? { code: "UNKNOWN", message: "Guard gave no detail" };
  log(`[D4] BLOCK ${block.code}: ${block.message}`);
  log(`[D4] attempted $${priceUsd}, spent $0.00 — no transaction exists`);

  if (block.code !== "RECIPIENT_MISMATCH" && block.code !== "MERCHANT_NOT_ALLOWLISTED") {
    throw new Error(`[D4] blocked with ${block.code} — expected a merchant-guard code (RECIPIENT_MISMATCH or MERCHANT_NOT_ALLOWLISTED)`);
  }
}
