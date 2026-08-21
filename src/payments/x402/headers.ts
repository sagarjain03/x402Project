// OWNER: PAY. Codecs for the three x402 protocol headers, plus the validation the SDK omits.
// Protocol-defined headers: never wrapped in the API envelope (see ../../CLAUDE.md section 1).
import { z } from "zod";
import {
  decodePaymentRequiredHeader,
  decodePaymentResponseHeader,
  decodePaymentSignatureHeader,
  encodePaymentSignatureHeader,
} from "@x402/core/http";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import { AVM_TX_ID, EVM_TX_HASH, isAddress } from "@/shared/address";
import type { ErrorCode } from "@/shared/errors";
import type { SettlementResult } from "@/shared/types";

export type { PaymentPayload, PaymentRequired } from "@x402/core/types";

export const HEADER = {
  required: "PAYMENT-REQUIRED",
  signature: "PAYMENT-SIGNATURE",
  response: "PAYMENT-RESPONSE",
} as const;

/** Carries an ERROR_CODES key so the gateway maps a bad header straight to fail() (../../CLAUDE.md section 1). */
export class PaymentHeaderError extends Error {
  constructor(readonly code: ErrorCode, message: string) {
    super(message);
    this.name = "PaymentHeaderError";
  }
}

// The SDK decoders check base64 shape and JSON.parse, nothing more — an empty object decodes
// happily. These schemas are what makes an unreadable offer a BLOCK (../../CLAUDE.md rule 2).
// Both rails are accepted for as long as they coexist. Algorand addresses and transaction ids
// are base32 over the alphabet A-Z2-7 — 58 characters for an address, 52 for a transaction id.
// These stay exact shapes rather than z.string(): a payTo we cannot recognise is a payTo we
// cannot pin, and CLAUDE.md rule 2 says that resolves to BLOCK, not to "probably fine".
// Both stay recognised after A3 on purpose. An EVM offer can no longer be signed — the adapter
// registers no EVM scheme — and the policy engine refuses it by rail. Keeping it *readable* means
// that refusal surfaces as NETWORK_NOT_ALLOWED, a decision, instead of a malformed-header error.


/** Exported so intent/build.ts can enforce the same rule without keeping a second copy of it. */
export function isRecipientAddress(value: string): boolean {
  return isAddress(value);
}

const requirementsSchema = z.object({
  scheme: z.string().min(1),
  network: z.string().min(1),
  // Integer minor units as a string. A float here would mean the merchant is quoting dollars.
  amount: z.string().regex(/^\d+$/),
  asset: z.string().min(1),
  // Required by the v2 spec. Some third-party sellers omit it on rails they do not really
  // support; those offers are rejected rather than signed with no recipient to pin.
  payTo: z.string().refine(isRecipientAddress),
});

// The envelope and the individual offers are validated separately. A seller may quote several
// rails at once and get one of them wrong — the live Algorand reference seller quotes three and
// leaves payTo off two of them. Refusing the whole envelope for a rail we were never going to use
// would throw away a perfectly payable offer. Deny-by-default is unharmed: an entry that fails
// validation is discarded, never repaired, so nothing unvalidated can reach the signer.
const paymentRequiredSchema = z.object({
  x402Version: z.number().int().positive(),
  accepts: z.array(z.unknown()).min(1),
});

const paymentPayloadSchema = z.object({
  x402Version: z.number().int().positive(),
  payload: z.object({}).passthrough(),
});

const settleResponseSchema = z.object({
  success: z.boolean(),
  transaction: z.string(),
  network: z.string().min(1),
  errorReason: z.string().optional(),
});

function decodeOrThrow(
  headerValue: string,
  name: string,
  code: ErrorCode,
  decoder: (value: string) => unknown,
): unknown {
  if (!headerValue) throw new PaymentHeaderError(code, `Missing ${name} header.`);
  try {
    return decoder(headerValue);
  } catch {
    throw new PaymentHeaderError(code, `${name} header is not valid base64-encoded JSON.`);
  }
}

export function decodePaymentRequired(headerValue: string): PaymentRequired {
  const raw = decodeOrThrow(headerValue, HEADER.required, "INVALID_PAYMENT_REQUIREMENTS", decodePaymentRequiredHeader);
  const envelope = paymentRequiredSchema.safeParse(raw);
  if (!envelope.success) {
    throw new PaymentHeaderError("INVALID_PAYMENT_REQUIREMENTS", `${HEADER.required} header is not a usable payment offer.`);
  }

  const accepts = envelope.data.accepts.filter((offer) => requirementsSchema.safeParse(offer).success);
  if (accepts.length === 0) {
    throw new PaymentHeaderError("INVALID_PAYMENT_REQUIREMENTS", `${HEADER.required} header quotes no usable payment rail.`);
  }

  return { ...(raw as PaymentRequired), accepts } as PaymentRequired;
}

export function encodePaymentSignature(payload: PaymentPayload): string {
  return encodePaymentSignatureHeader(payload);
}

export function decodePaymentSignature(headerValue: string): PaymentPayload {
  const raw = decodeOrThrow(headerValue, HEADER.signature, "INVALID_PAYMENT_REQUIREMENTS", decodePaymentSignatureHeader);
  if (!paymentPayloadSchema.safeParse(raw).success) {
    throw new PaymentHeaderError("INVALID_PAYMENT_REQUIREMENTS", `${HEADER.signature} header is not a usable payment payload.`);
  }
  return raw as PaymentPayload;
}

/** A settlement we cannot read is a settlement we cannot prove, so it fails closed rather than reporting success. */
export function decodePaymentResponse(headerValue: string): SettlementResult {
  const raw = decodeOrThrow(headerValue, HEADER.response, "SETTLEMENT_FAILED", decodePaymentResponseHeader);
  const parsed = settleResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PaymentHeaderError("SETTLEMENT_FAILED", `${HEADER.response} header is not a usable settlement result.`);
  }
  const { success, transaction, errorReason } = parsed.data;
  if (!success) {
    throw new PaymentHeaderError("SETTLEMENT_FAILED", errorReason ?? "The facilitator reported settlement failure.");
  }
  if (!EVM_TX_HASH.test(transaction) && !AVM_TX_ID.test(transaction)) {
    throw new PaymentHeaderError("SETTLEMENT_FAILED", `Settlement reported success without a usable transaction hash.`);
  }
  // The header carries no timestamp, so settledAt is when we read the confirmation.
  return { txHash: transaction, settledAt: new Date(), raw };
}
