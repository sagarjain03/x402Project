// OWNER: PAY. Phase A2 de-risker. Buys a $0.01 resource from a hosted x402 seller on Algorand
// TestNet using the agent key, end to end, WITHOUT touching any ASPG code.
//
//   npm i @x402/avm
//   node tools/algo-probe.mjs <AGENT_BASE64>
//
// WHY THIS LIVES OUTSIDE src/: the C3 boundary says only src/payments/x402/** may import the x402
// SDK, so that an SDK change touches exactly one file. This script imports the SDK raw on purpose —
// it has to run BEFORE adapter.ts speaks AVM, which is the whole point of it. Rather than punch a
// hole in the boundary for a temporary tool, the tool sits outside the linted app tree.
// DELETE THIS once phase A2 lands and poc-x402.ts covers the same ground through the adapter.
//
// If this prints a transaction id, then the key, the opt-in, the USDC balance, @x402/avm and the
// facilitator all work — and every remaining failure is our own wiring. Costs $0.01 of test USDC.
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { toClientAvmSigner } from "@x402/avm";
import { decodePaymentRequiredHeader, decodePaymentResponseHeader, encodePaymentSignatureHeader } from "@x402/core/http";

const TARGET = process.env.PROBE_URL ?? "https://x402.goplausible.xyz/examples/weather";

const agentKey = process.argv[2];
if (!agentKey) {
  console.error("usage: node algo-probe.mjs <AGENT_BASE64>   (the 88-char base64, not the address)");
  process.exit(2);
}

const signer = toClientAvmSigner(agentKey.trim());
console.log(`buyer   ${signer.address}`);
console.log(`target  ${TARGET}\n`);

// --- 1. ask, get told the price ------------------------------------------------------------------
const unpaid = await fetch(TARGET);
if (unpaid.status !== 402) throw new Error(`expected 402, got ${unpaid.status}`);
const paymentRequired = decodePaymentRequiredHeader(unpaid.headers.get("PAYMENT-REQUIRED"));

console.log(`seller offers ${paymentRequired.accepts.length} rails:`);
for (const offer of paymentRequired.accepts) console.log(`  ${offer.network}`);

// --- 2. pick the Algorand rail, and narrow the envelope to it -------------------------------------
// Narrowing is the same discipline as narrowToOffer() in adapter.ts: hand the SDK exactly one
// offer so its own selector cannot pick a rail the policy engine never judged (threat T9).
const offer = paymentRequired.accepts.find((candidate) => candidate.network.startsWith("algorand:"));
if (!offer) throw new Error("seller quoted no Algorand rail");
const narrowed = { ...paymentRequired, accepts: [offer] };

console.log(`\nchosen rail`);
console.log(`  network ${offer.network}   <- THIS exact string goes in policy allowedNetworks`);
console.log(`  asset   ${offer.asset}`);
console.log(`  amount  ${offer.amount} minor units`);
console.log(`  payTo   ${offer.payTo}`);
console.log(`  feePayer ${offer.extra?.feePayer ?? "none — we would pay our own fee"}`);

// --- 3. sign -------------------------------------------------------------------------------------
console.log(`\nsigning...`);
const client = new x402Client();
client.register(offer.network, new ExactAvmScheme(signer));
const payload = await new x402HTTPClient(client).createPaymentPayload(narrowed);
const signature = encodePaymentSignatureHeader(payload);
console.log(`  atomic group of ${payload.payload?.paymentGroup?.length ?? "?"} txns, payment at index ${payload.payload?.paymentIndex}`);

// --- 4. pay ---------------------------------------------------------------------------------------
const paid = await fetch(TARGET, { headers: { "PAYMENT-SIGNATURE": signature } });
if (!paid.ok) {
  // A second 402 means the facilitator refused to settle. Its body is usually empty, so the
  // useful detail lives in PAYMENT-RESPONSE if it sent one — and the cause is nearly always
  // one of three things on a fresh account.
  const header = paid.headers.get("PAYMENT-RESPONSE");
  const reason = header ? decodePaymentResponseHeader(header).errorReason : (await paid.text()) || "(empty body)";
  console.error(`
REFUSED — seller returned ${paid.status}: ${reason}`);
  console.error("check, in this order:");
  console.error("  1. is this account opted in to ASA 10458941?");
  console.error("  2. does it hold at least 0.01 USDC?");
  console.error("  3. does it hold at least 0.2 ALGO for the minimum balance?");
  console.error(`  run: node src/payments/scripts/algo-check.mjs ${signer.address}`);
  process.exit(1);
}

const settlement = decodePaymentResponseHeader(paid.headers.get("PAYMENT-RESPONSE"));
if (!settlement.success) throw new Error(`settlement failed: ${settlement.errorReason}`);

console.log(`\nbody     ${JSON.stringify(await paid.json()).slice(0, 120)}`);
console.log(`txId     ${settlement.transaction}   (${settlement.transaction.length} chars)`);
console.log(`explorer https://lora.algokit.io/testnet/transaction/${settlement.transaction}`);
