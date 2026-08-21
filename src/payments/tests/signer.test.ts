// OWNER: PAY. The security tests for threat T9. These must pass before the demo.
// Every refusal here is a payment that would otherwise have left the wallet unapproved.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.GUARD_HMAC_SECRET ??= "test-only-secret";
// Throwaway anvil account 0. Signing is offline typed data, so no network and no funds are needed.
process.env.AVM_PRIVATE_KEY ??= "ASdQfaLIBs5ujxlKf1HO3mkzmIl+I1T+9Yn1rDLCsYHXjURdAvI/9C5cv4PcpdNh63PdwRauu6Y06IKqBfvAJg==";

/** Structural, so it needs no import inside the hoisted block. Enough to assert what was signed. */
type SignedOffer = { accepts: Array<{ payTo: string; amount: string; network: string }> };
const adapterStub = vi.hoisted(() => ({
  createPaymentSignature: vi.fn<(paymentRequired: SignedOffer, signer: unknown) => Promise<string>>(
    async () => "c3R1Yi1zaWduYXR1cmU=",
  ),
}));
vi.mock("@/payments/x402/adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/payments/x402/adapter")>()),
  createPaymentSignature: adapterStub.createPaymentSignature,
}));

import { buildIntentFromRequirements } from "@/payments/intent/build";
import { AVM_CAPTURED_REQUIRED, AVM_NETWORK, AVM_PAY_TO, CAPTURED_REQUIRED } from "@/payments/tests/fixtures";
import { mintAllowToken } from "@/payments/wallet/allowToken";
import { signPaymentPayload } from "@/payments/wallet/signer";
import { readPaymentRequired, type PaymentRequired } from "@/payments/x402/adapter";
import { HEADER } from "@/payments/x402/headers";
import type { PaymentIntent } from "@/shared/types";

let OFFER: PaymentRequired;

beforeAll(() => {
  OFFER = readPaymentRequired(
    new Response(null, { status: 402, headers: { [HEADER.required]: CAPTURED_REQUIRED } }),
  )!;
});

/** The capture came from localhost:3001, so the intent must agree or the merchant check fires. */
const approvedIntent = (): PaymentIntent =>
  buildIntentFromRequirements({
    agentId: "agt_researchbot",
    requirements: OFFER.accepts[0],
    requestUrl: "http://localhost:3001/api/gw/poc-seller",
    method: "post",
    reason: "signer test",
  });

const withOffer = (patch: Record<string, unknown>): PaymentRequired =>
  ({ ...OFFER, accepts: [{ ...OFFER.accepts[0], ...patch }] }) as PaymentRequired;

afterEach(() => vi.useRealTimers());

describe("signPaymentPayload", () => {
  it("hands the SDK exactly the approved offer, and only after every check passed", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");

    await signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: token });

    const [signed] = adapterStub.createPaymentSignature.mock.calls.at(-1)!;
    expect(signed.accepts).toHaveLength(1);
    expect(signed.accepts[0].payTo).toBe(intent.recipient);
    expect(signed.accepts[0].amount).toBe(intent.amountMinor.toString());
  });

  it("refuses to sign without a valid allowToken", async () => {
    const intent = approvedIntent();
    await expect(signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: "" }))
      .rejects.toThrow(/Malformed allowToken/);
    await expect(signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: "v1.9999999999999.evl.deadbeef" }))
      .rejects.toThrow(/not issued for this intent/);
  });

  it("refuses when the recipient changed after ALLOW", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");
    const swapped = withOffer({ payTo: "0x000000000000000000000000000000000000dEaD" });

    await expect(signPaymentPayload({ intent, paymentRequired: swapped, allowToken: token }))
      .rejects.toThrow(/No offer on the wire matches/);
  });

  it("refuses when the amount changed after ALLOW", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");

    await expect(signPaymentPayload({ intent, paymentRequired: withOffer({ amount: "2000000" }), allowToken: token }))
      .rejects.toThrow(/No offer on the wire matches/);
  });

  it("strips a decoy offer appended alongside the approved one", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");
    const decoy = { ...OFFER.accepts[0], payTo: "0x000000000000000000000000000000000000dEaD" };
    const both = { ...OFFER, accepts: [decoy, OFFER.accepts[0]] } as PaymentRequired;

    await signPaymentPayload({ intent, paymentRequired: both, allowToken: token });

    // narrowToOffer must have removed the decoy before the SDK's selector ever saw it.
    const [signed] = adapterStub.createPaymentSignature.mock.calls.at(-1)!;
    expect(signed.accepts).toHaveLength(1);
    expect(signed.accepts[0].payTo).toBe(intent.recipient);
  });

  it("refuses a replayed allowToken", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");

    await signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: token });
    await expect(signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: token }))
      .rejects.toThrow(/already used/);
  });

  it("refuses an expired allowToken", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);

    await expect(signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: token }))
      .rejects.toThrow(/expired/);
  });

  it("refuses a token minted for a different intent", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(approvedIntent().intentHash, "evl_test");

    await expect(signPaymentPayload({ intent, paymentRequired: OFFER, allowToken: token }))
      .rejects.toThrow(/not issued for this intent/);
  });

  it("refuses an intent whose terms were mutated after it was hashed", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");
    const tampered = { ...intent, amountMinor: 2_000_000n };

    await expect(signPaymentPayload({ intent: tampered, paymentRequired: OFFER, allowToken: token }))
      .rejects.toThrow(/do not match its own intentHash/);
  });

  it("refuses an offer served by a merchant other than the one approved", async () => {
    const intent = approvedIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");
    const elsewhere = { ...OFFER, resource: { ...OFFER.resource, url: "http://evil.example.com/api/x" } } as PaymentRequired;

    await expect(signPaymentPayload({ intent, paymentRequired: elsewhere, allowToken: token }))
      .rejects.toThrow(/but localhost:3001 was approved/);
  });
});

// ---------------------------------------------------------------------------------------------
// Phase A0: the same T9 refusals with an Algorand intent. These exercise the checks that run
// BEFORE any key is touched, so they need no AVM signer — that arrives with phase A2.
// ---------------------------------------------------------------------------------------------

describe("signPaymentPayload — Algorand recipients", () => {
  const avmOffer = () =>
    readPaymentRequired(
      new Response(null, { status: 402, headers: { [HEADER.required]: AVM_CAPTURED_REQUIRED } }),
    )!;

  const avmIntent = (): PaymentIntent =>
    buildIntentFromRequirements({
      agentId: "agt_researchbot",
      requirements: avmOffer().accepts[0],
      requestUrl: "https://x402.goplausible.xyz/examples/weather",
      method: "get",
      reason: "algorand signer test",
    });

  it("carries the base32 recipient into the intent without mangling it", () => {
    const intent = avmIntent();
    expect(intent.recipient).toBe(AVM_PAY_TO);
    expect(intent.network).toBe(AVM_NETWORK);
    expect(intent.asset).toBe("10458941");
  });

  it("refuses when the wire quotes a different Algorand recipient than was approved", async () => {
    // The whole of threat T9 in one case: same amount, same asset, same network, one swapped
    // address. Refusal happens before the allowToken is consumed and before anything is signed.
    const intent = avmIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");
    const swapped = {
      ...avmOffer(),
      accepts: [{ ...avmOffer().accepts[0], payTo: "ZMFK2OI7ZBD2U27ISERZC4S6LKM6WMFJPZQ4MYNJDZ2VNBNMBA67RA22AB" }],
    } as PaymentRequired;

    await expect(signPaymentPayload({ intent, paymentRequired: swapped, allowToken: token }))
      .rejects.toThrow(/No offer on the wire matches/);
  });

  it("refuses when the amount was raised after approval", async () => {
    const intent = avmIntent();
    const { token } = mintAllowToken(intent.intentHash, "evl_test");
    const dearer = {
      ...avmOffer(),
      accepts: [{ ...avmOffer().accepts[0], amount: "20000" }],
    } as PaymentRequired;

    await expect(signPaymentPayload({ intent, paymentRequired: dearer, allowToken: token }))
      .rejects.toThrow(/No offer on the wire matches/);
  });

  it("refuses when the intent no longer hashes to its own intentHash", async () => {
    const intent = { ...avmIntent(), intentHash: "0".repeat(64) };
    const { token } = mintAllowToken(intent.intentHash, "evl_test");

    await expect(signPaymentPayload({ intent, paymentRequired: avmOffer(), allowToken: token }))
      .rejects.toThrow(/do not match its own intentHash/);
  });
});
