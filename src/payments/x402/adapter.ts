// OWNER: PAY. The x402 SDK boundary — if the SDK surface changes, this folder is what changes.
// Split into read / sign / read so the policy decision fits between knowing the price and paying it.
//
// Phase A2: the rail is Algorand (AVM). @x402/avm is a drop-in sibling of @x402/evm at the same
// pinned version, so only the scheme class and the signer type move; every export below keeps its
// name and shape, which is why nothing outside this folder had to change.
import { x402Client, x402HTTPClient } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import type { ClientAvmConfig, ClientAvmSigner } from "@x402/avm";
import type { PaymentRequirements } from "@x402/core/types";
import {
  HEADER,
  PaymentHeaderError,
  decodePaymentRequired,
  decodePaymentResponse,
  encodePaymentSignature,
} from "@/payments/x402/headers";
import type { PaymentRequired } from "@/payments/x402/headers";
import type { SettlementResult } from "@/shared/types";

// Re-exported so wallet/signer.ts can build a signer without importing the SDK itself — the C3
// import boundary says only this folder may do that, and it is the reason A2 is a small change.
export { toClientAvmSigner } from "@x402/avm";
export type { ClientAvmSigner } from "@x402/avm";
export type { PaymentRequirements } from "@x402/core/types";
export type { PaymentPayload, PaymentRequired } from "@/payments/x402/headers";

// Unset means the SDK's own AlgoNode default, which is the path the A2 probe proved. Set
// ALGORAND_ALGOD_URL only to point at a different node; a wrong value here fails every signature.
const avmConfig: ClientAvmConfig | undefined = process.env.ALGORAND_ALGOD_URL
  ? { algodUrl: process.env.ALGORAND_ALGOD_URL }
  : undefined;

/** Reads the merchant's price. `null` means the resource was free, so there is nothing to judge. */
export function readPaymentRequired(response: Response): PaymentRequired | null {
  if (response.status !== 402) return null;
  const header = response.headers.get(HEADER.required);
  if (!header) {
    throw new PaymentHeaderError(
      "INVALID_PAYMENT_REQUIREMENTS",
      `Merchant returned 402 without a ${HEADER.required} header.`,
    );
  }
  return decodePaymentRequired(header);
}

/**
 * Rebuilds the offer envelope around the single approved entry, so the SDK's selector cannot
 * choose a different one than the policy engine judged. This is the binding that closes threat T9.
 */
export function narrowToOffer(paymentRequired: PaymentRequired, offer: PaymentRequirements): PaymentRequired {
  return { ...paymentRequired, accepts: [offer] };
}

/**
 * Signs an approved offer and returns the PAYMENT-SIGNATURE header value.
 * Signs whatever it is handed — narrow with {@link narrowToOffer} and check the allowToken first.
 *
 * On Algorand the result is an atomic group: the facilitator's fee-payer transaction plus our ASA
 * transfer, which settle together or not at all. The agent therefore never needs an ALGO balance
 * to pay fees — only the minimum balance its own account and its USDC opt-in reserve.
 */
export async function createPaymentSignature(
  paymentRequired: PaymentRequired,
  signer: ClientAvmSigner,
): Promise<string> {
  const client = new x402Client();
  for (const offer of paymentRequired.accepts) {
    client.register(offer.network, new ExactAvmScheme(signer, avmConfig));
  }
  const payload = await new x402HTTPClient(client).createPaymentPayload(paymentRequired);
  return encodePaymentSignature(payload);
}

/** Reads the settlement confirmation. A paid response without one has not proven anything. */
export function readSettlement(response: Response): SettlementResult {
  const header = response.headers.get(HEADER.response);
  if (!header) {
    throw new PaymentHeaderError(
      "SETTLEMENT_FAILED",
      `Merchant returned ${response.status} without a ${HEADER.response} header.`,
    );
  }
  return decodePaymentResponse(header);
}
