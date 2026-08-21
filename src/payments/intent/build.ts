// OWNER: PAY. PAYMENT-REQUIRED -> the canonical PaymentIntent that CORE judges.
// Every term comes off the wire or from the request. Nothing here is inferred or defaulted.
import { randomBytes } from "node:crypto";
import { computeIntentHash } from "@/payments/intent/hash";
import { PaymentHeaderError, isRecipientAddress } from "@/payments/x402/headers";
import type { PaymentRequirements } from "@/payments/x402/adapter";
import { newId } from "@/shared/ids";
import type { PaymentIntent } from "@/shared/types";

export interface BuildIntentInput {
  agentId: string;
  requirements: PaymentRequirements;
  requestUrl: string;
  method: string;
  reason?: string;
}

const MINOR_UNITS = /^\d+$/;

function check(condition: boolean, message: string): void {
  if (!condition) throw new PaymentHeaderError("INVALID_PAYMENT_REQUIREMENTS", message);
}

/**
 * The two request-derived terms, resolved in one place so the gateway and the intent can never
 * disagree about which merchant was judged. `host` keeps the port: it is part of the allowlist key.
 */
export function resolveTarget(requestUrl: string, method: string): { merchant: string; resource: string } {
  const url = new URL(requestUrl);
  return { merchant: url.host, resource: `${method.toUpperCase()} ${url.pathname}` };
}

export function buildIntentFromRequirements(input: BuildIntentInput): PaymentIntent {
  const { agentId, requirements, requestUrl, method, reason } = input;

  // Re-checked here as well as at decode: this is exported, so it is its own trust boundary.
  check(MINOR_UNITS.test(requirements.amount), `Amount must be integer minor units, got ${JSON.stringify(requirements.amount)}.`);
  check(isRecipientAddress(requirements.payTo), `payTo is not an address: ${JSON.stringify(requirements.payTo)}.`);

  const terms = {
    intentId: newId("intent"),
    agentId,
    // The wire already carries integer minor units, so toMinor() would be wrong by a factor of 10^6.
    amountMinor: BigInt(requirements.amount),
    asset: requirements.asset,
    network: requirements.network,
    recipient: requirements.payTo,
    ...resolveTarget(requestUrl, method),
    reason,
    nonce: randomBytes(16).toString("hex"),
    createdAt: new Date(),
  };

  return { ...terms, intentHash: computeIntentHash(terms), state: "EVALUATING" };
}
