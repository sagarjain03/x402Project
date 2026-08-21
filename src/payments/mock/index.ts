// OWNER: PAY. Fake signer + facilitator, so CORE, UI and DEMO can run the whole flow with no
// chain, no RPC and no funded wallet. Mirrors the adapter surface, enabled by USE_MOCKS=1.
import type { PaymentRequired } from "@/payments/x402/adapter";
import type { SettlementResult } from "@/shared/types";

/**
 * Obviously fake, but a well-formed 52-character Algorand transaction id so that anything
 * validating the shape behaves exactly as it does against the real rail. A 0x-hash here would let
 * a USE_MOCKS=1 run pass while the same code fails on Algorand.
 */
export const MOCK_TX_HASH = "MOCK4TESTNET4ONLY4NEVER4BROADCASTAAAAAAAAAAAAAAAAAAA";

export async function createPaymentSignature(paymentRequired: PaymentRequired): Promise<string> {
  const payload = { x402Version: paymentRequired.x402Version, payload: { mock: true } };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function readSettlement(_response?: Response): SettlementResult {
  return { txHash: MOCK_TX_HASH, settledAt: new Date(), raw: { mock: true } };
}
