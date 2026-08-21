// OWNER: PAY. Spike: request -> 402 -> [policy gap] -> sign -> retry -> settle, via the adapter.
// This is the phase A2 gate. Unlike tools/algo-probe.mjs, which talks to the SDK directly, every
// line below goes through our own adapter and our own signer — so a pass here means OUR code pays
// on Algorand, not merely that the SDK can.
//
// RUN: `npm run poc:x402`
//
// Targets our own sandbox seller. Point it at the hosted Algorand reference seller with
// POC_TARGET_URL to tell "our seller is broken" apart from "our buyer is broken".
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createPaymentSignature,
  narrowToOffer,
  readPaymentRequired,
  readSettlement,
  toClientAvmSigner,
} from "@/payments/x402/adapter";
import { HEADER, decodePaymentRequired, decodePaymentResponse, decodePaymentSignature } from "@/payments/x402/headers";
import { explorerTxUrl } from "@/shared/explorer";
import { env } from "@/shared/env";
import { toUsd } from "@/shared/money";

const TARGET = process.env.POC_TARGET_URL ?? `${env.APP_URL}/api/sandbox/search`;
const NOTES_PATH = resolve(process.cwd(), "../Docs/x402-notes.md");

// The hosted seller is a GET; our own sandbox sellers take a POST body. Send one only when there
// is somewhere to send it, so the same script serves both targets.
const REQUEST: RequestInit = TARGET.includes("/api/sandbox/")
  ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "x402 adoption" }) }
  : { method: "GET" };

/** Raw base64 exactly as it crossed the wire. The C2 header tests decode these captures. */
function writeNotes(captured: Record<string, string>, decoded: Record<string, unknown>) {
  const section = (name: string) =>
    `## ${name}\n\n\`\`\`\n${captured[name]}\n\`\`\`\n\n\`\`\`json\n${JSON.stringify(decoded[name], null, 2)}\n\`\`\`\n`;
  writeFileSync(
    NOTES_PATH,
    [
      "# x402 wire captures — PAY spike",
      "",
      `Captured from \`${TARGET}\` via \`npm run poc:x402\`, routed through \`x402/adapter.ts\`.`,
      "Protocol v2 on Algorand TestNet. These are real values, not fixtures — the C2 header tests",
      "decode exactly these.",
      "",
      section(HEADER.required),
      section(HEADER.signature),
      section(HEADER.response),
    ].join("\n"),
    "utf8",
  );
}

function requireHeader(response: Response, name: string): string {
  const value = response.headers.get(name);
  if (!value) throw new Error(`No ${name} header on the ${response.status} response.`);
  return value;
}

async function main() {
  const signer = toClientAvmSigner(env.AVM_PRIVATE_KEY);
  console.log(`buyer    ${signer.address}`);
  console.log(`target   ${TARGET}\n`);

  const unpaid = await fetch(TARGET, REQUEST);
  const paymentRequired = readPaymentRequired(unpaid);
  if (!paymentRequired) {
    // A 404 here almost always means next dev fell back to another port because 3000 was taken,
    // so NEXT_PUBLIC_APP_URL points at whatever else is listening.
    throw new Error(
      `Expected 402 from the seller, got ${unpaid.status}. Is \`npm run dev\` serving ${env.APP_URL}?`,
    );
  }

  // The seller may quote several rails. We can only sign the Algorand one, and picking it here is
  // the stand-in for C6's policy decision — which is what chooses the offer in the real flow.
  const offer = paymentRequired.accepts.find((candidate) => candidate.network.startsWith("algorand:"));
  if (!offer) {
    throw new Error(
      `Seller quoted no Algorand rail, only: ${paymentRequired.accepts.map((a) => a.network).join(", ")}`,
    );
  }

  console.log(`price    ${toUsd(BigInt(offer.amount))} USDC on ${offer.network}`);
  console.log(`asset    ASA ${offer.asset}`);
  console.log(`payTo    ${offer.payTo}`);
  console.log(`feePayer ${(offer.extra as Record<string, unknown> | undefined)?.feePayer ?? "none"}`);
  console.log("policy   <- C6 calls evaluatePayment here. Nothing is signed before ALLOW.\n");

  const signature = await createPaymentSignature(narrowToOffer(paymentRequired, offer), signer);

  const paid = await fetch(TARGET, {
    ...REQUEST,
    headers: { ...(REQUEST.headers as Record<string, string>), [HEADER.signature]: signature },
  });
  if (!paid.ok) {
    // A second 402 is the facilitator refusing to settle, and on a fresh account it is almost
    // always the opt-in or the USDC balance rather than anything wrong with the code.
    const detail = paid.headers.get(HEADER.response) ?? (await paid.text()) ?? "(no detail)";
    throw new Error(
      `Seller returned ${paid.status}. ${detail}\n` +
        `Check the account first: node src/payments/scripts/algo-check.mjs ${signer.address}`,
    );
  }

  const settlement = readSettlement(paid);
  const captured = {
    [HEADER.required]: requireHeader(unpaid, HEADER.required),
    [HEADER.signature]: signature,
    [HEADER.response]: requireHeader(paid, HEADER.response),
  };
  writeNotes(captured, {
    [HEADER.required]: decodePaymentRequired(captured[HEADER.required]),
    [HEADER.signature]: decodePaymentSignature(captured[HEADER.signature]),
    [HEADER.response]: decodePaymentResponse(captured[HEADER.response]).raw,
  });

  console.log(`body     ${JSON.stringify(await paid.json()).slice(0, 120)}`);
  console.log(`notes    ${NOTES_PATH}`);
  console.log(`txId     ${settlement.txHash}`);
  console.log(`explorer ${explorerTxUrl(offer.network, settlement.txHash)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
