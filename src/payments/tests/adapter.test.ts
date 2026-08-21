// OWNER: PAY. The adapter split, proven without a chain: reading a price and signing for it are
// separate calls, which is the only reason a policy decision can sit between them.
import { describe, expect, it } from "vitest";
import {
  createPaymentSignature,
  narrowToOffer,
  readPaymentRequired,
  readSettlement,
} from "@/payments/x402/adapter";
import { HEADER, decodePaymentSignature } from "@/payments/x402/headers";
import {
  AVM_CAPTURED_REQUIRED,
  AVM_CAPTURED_RESPONSE,
  AVM_NETWORK,
  AVM_PAY_TO,
  AVM_SETTLED_TX_ID,
  CAPTURED_REQUIRED,
  CAPTURED_RESPONSE,
  SETTLED_TX_HASH,
} from "@/payments/tests/fixtures";

const respond = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers });

const paid = () => respond(200, { [HEADER.response]: CAPTURED_RESPONSE });
const unpaid = () => respond(402, { [HEADER.required]: CAPTURED_REQUIRED });

const avmPaid = () => respond(200, { [HEADER.response]: AVM_CAPTURED_RESPONSE });
const avmUnpaid = () => respond(402, { [HEADER.required]: AVM_CAPTURED_REQUIRED });

describe("readPaymentRequired", () => {
  it("returns null when the resource was free", () => {
    expect(readPaymentRequired(respond(200))).toBeNull();
  });

  it("decodes the offer from a real 402", () => {
    expect(readPaymentRequired(unpaid())?.accepts[0]).toMatchObject({
      network: "eip155:84532",
      amount: "10000",
      payTo: "0x2de7B9388C249D20800bA097eD5DEb66e4437Dc4",
    });
  });

  it("refuses a 402 that carries no payment offer", () => {
    expect(() => readPaymentRequired(respond(402))).toThrow(/without a PAYMENT-REQUIRED header/);
  });
});

describe("narrowToOffer", () => {
  it("leaves exactly the approved offer for the SDK to sign", () => {
    const paymentRequired = readPaymentRequired(unpaid())!;
    const decoy = { ...paymentRequired.accepts[0], payTo: "0x000000000000000000000000000000000000dEaD" };

    const narrowed = narrowToOffer({ ...paymentRequired, accepts: [...paymentRequired.accepts, decoy] }, paymentRequired.accepts[0]);

    expect(narrowed.accepts).toHaveLength(1);
    expect(narrowed.accepts[0].payTo).toBe("0x2de7B9388C249D20800bA097eD5DEb66e4437Dc4");
  });
});

describe("readPaymentRequired — Algorand", () => {
  it("decodes the offer from a real Algorand 402", () => {
    expect(readPaymentRequired(avmUnpaid())?.accepts[0]).toMatchObject({
      network: AVM_NETWORK,
      amount: "10000",
      asset: "10458941",
      payTo: AVM_PAY_TO,
    });
  });
});

describe("narrowToOffer — Algorand", () => {
  it("leaves exactly the approved offer for the SDK to sign", () => {
    const paymentRequired = readPaymentRequired(avmUnpaid())!;
    // Same amount, same asset, same network — only the payee swapped. Threat T9 in one object.
    const decoy = { ...paymentRequired.accepts[0], payTo: `${AVM_PAY_TO.slice(0, 57)}B` };

    const narrowed = narrowToOffer(
      { ...paymentRequired, accepts: [...paymentRequired.accepts, decoy] },
      paymentRequired.accepts[0],
    );

    expect(narrowed.accepts).toHaveLength(1);
    expect(narrowed.accepts[0].payTo).toBe(AVM_PAY_TO);
  });
});

// AVM signing builds an atomic group, and building one needs suggested params from algod — a
// network call, which a unit test must not make. The real proof of this path is `npm run poc:x402`,
// which settles for $0.01 and is the phase A2 gate. Opt in here with RUN_AVM_INTEGRATION=1.
describe.skipIf(!process.env.RUN_AVM_INTEGRATION)("createPaymentSignature — Algorand (network)", () => {
  it("signs the approved offer as an atomic group", async () => {
    const { toClientAvmSigner } = await import("@/payments/x402/adapter");
    const algosdk = (await import("algosdk")).default;
    // Unfunded throwaway: building and signing the group needs no balance, only the facilitator
    // would refuse it. That is enough to prove the adapter wires the AVM scheme correctly.
    const account = algosdk.generateAccount();
    const signer = toClientAvmSigner(Buffer.from(account.sk).toString("base64"));
    const paymentRequired = readPaymentRequired(avmUnpaid())!;

    const header = await createPaymentSignature(narrowToOffer(paymentRequired, paymentRequired.accepts[0]), signer);
    const payload = decodePaymentSignature(header).payload as { paymentGroup: string[]; paymentIndex: number };

    expect(signer.address).toBe(account.addr.toString());
    expect(payload.paymentGroup.length).toBeGreaterThanOrEqual(1);
    expect(payload.paymentIndex).toBeGreaterThanOrEqual(0);
  });
});

describe("readSettlement", () => {
  it("extracts the tx hash from a real settled response", () => {
    expect(readSettlement(paid()).txHash).toBe(SETTLED_TX_HASH);
  });

  it("extracts the Algorand transaction id from a real settled response", () => {
    expect(readSettlement(avmPaid()).txHash).toBe(AVM_SETTLED_TX_ID);
  });

  it("refuses a 200 that never proved settlement", () => {
    expect(() => readSettlement(respond(200))).toThrow(/without a PAYMENT-RESPONSE header/);
  });
});
