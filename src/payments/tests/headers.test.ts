// OWNER: PAY. Header codecs against the REAL captures in ./fixtures.ts, never invented values.
import { describe, expect, it } from "vitest";
import {
  PaymentHeaderError,
  decodePaymentRequired,
  decodePaymentResponse,
  decodePaymentSignature,
  encodePaymentSignature,
} from "@/payments/x402/headers";
import {
  AVM_CAPTURED_REQUIRED,
  AVM_CAPTURED_REQUIRED_MULTIRAIL,
  AVM_CAPTURED_RESPONSE,
  AVM_NETWORK,
  AVM_PAY_TO,
  AVM_SETTLED_TX_ID,
  CAPTURED_REQUIRED,
  CAPTURED_RESPONSE,
  CAPTURED_SIGNATURE,
  SETTLED_TX_HASH,
  asHeader,
} from "@/payments/tests/fixtures";


/** Every field the policy engine judges, as it really arrived. */
const offer = () => decodePaymentRequired(CAPTURED_REQUIRED).accepts[0];

describe("decodePaymentRequired", () => {
  it("decodes the real C1 capture", () => {
    expect(decodePaymentRequired(CAPTURED_REQUIRED).x402Version).toBe(2);
    expect(offer()).toMatchObject({
      scheme: "exact",
      network: "eip155:84532",
      amount: "10000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x2de7B9388C249D20800bA097eD5DEb66e4437Dc4",
    });
  });

  it("keeps the amount as integer minor units, never a float", () => {
    expect(offer().amount).toBe("10000");
    expect(BigInt(offer().amount)).toBe(10_000n);
  });

  it("rejects a malformed header with INVALID_PAYMENT_REQUIREMENTS instead of a raw parse error", () => {
    expect(() => decodePaymentRequired("not base64 !!")).toThrow(PaymentHeaderError);
    try {
      decodePaymentRequired("not base64 !!");
    } catch (error) {
      expect((error as PaymentHeaderError).code).toBe("INVALID_PAYMENT_REQUIREMENTS");
    }
  });

  it("rejects an empty header", () => {
    expect(() => decodePaymentRequired("")).toThrow(PaymentHeaderError);
  });

  it("rejects well-formed base64 JSON that is not a payment offer", () => {
    expect(() => decodePaymentRequired(asHeader({}))).toThrow(/not a usable payment offer/);
  });

  it("rejects an offer with no accepted payment methods", () => {
    expect(() => decodePaymentRequired(asHeader({ x402Version: 2, accepts: [] }))).toThrow(PaymentHeaderError);
  });

  it("rejects a merchant quoting dollars instead of minor units", () => {
    const dollars = {
      x402Version: 2,
      accepts: [{ ...offer(), amount: "0.01" }],
    };
    expect(() => decodePaymentRequired(asHeader(dollars))).toThrow(PaymentHeaderError);
  });
});

describe("encodePaymentSignature", () => {
  it("round-trips a real C1 payload", () => {
    const payload = decodePaymentSignature(CAPTURED_SIGNATURE);
    expect(decodePaymentSignature(encodePaymentSignature(payload))).toEqual(payload);
  });

  it("preserves the signed authorization byte for byte", () => {
    const payload = decodePaymentSignature(CAPTURED_SIGNATURE);
    expect(encodePaymentSignature(payload)).toBe(CAPTURED_SIGNATURE);
  });
});

describe("decodePaymentResponse", () => {
  it("extracts the tx hash from the real C1 capture", () => {
    const settlement = decodePaymentResponse(CAPTURED_RESPONSE);
    expect(settlement.txHash).toBe(SETTLED_TX_HASH);
    expect(settlement.settledAt).toBeInstanceOf(Date);
  });

  it("fails closed when the facilitator reports failure", () => {
    const failed = asHeader({ success: false, transaction: "", network: "eip155:84532", errorReason: "insufficient_funds" });
    expect(() => decodePaymentResponse(failed)).toThrow(/insufficient_funds/);
    try {
      decodePaymentResponse(failed);
    } catch (error) {
      expect((error as PaymentHeaderError).code).toBe("SETTLEMENT_FAILED");
    }
  });

  it("fails closed when success is claimed without a usable transaction hash", () => {
    const bogus = asHeader({ success: true, transaction: "0xnope", network: "eip155:84532" });
    expect(() => decodePaymentResponse(bogus)).toThrow(/transaction hash/);
  });
});

// ---------------------------------------------------------------------------------------------
// Phase A0: the same codecs against real Algorand TestNet captures. Every test here fails if the
// EVM-only regexes come back.
// ---------------------------------------------------------------------------------------------

describe("decodePaymentRequired — Algorand", () => {
  const avmOffer = () => decodePaymentRequired(AVM_CAPTURED_REQUIRED).accepts[0];

  it("decodes the real Algorand capture", () => {
    expect(avmOffer()).toMatchObject({
      scheme: "exact",
      network: AVM_NETWORK,
      amount: "10000",
      asset: "10458941",
      payTo: AVM_PAY_TO,
    });
  });

  it("carries the network as the full genesis hash, which is what policies allowlist", () => {
    // Not the truncated ALGORAND_TESTNET_CAIP2 constant — that is an SDK-internal form and never
    // reaches the wire. Seeding the wrong one blocks every payment with NETWORK_NOT_ALLOWED.
    expect(avmOffer().network).toBe("algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=");
  });

  it("keeps the ASA id as a plain decimal string, not a contract address", () => {
    expect(avmOffer().asset).toBe("10458941");
    expect(BigInt(avmOffer().amount)).toBe(10_000n);
  });

  it("keeps the payable rail from a multi-rail envelope and drops the rest", () => {
    // The live seller quotes algorand + eip155 + solana and leaves payTo off the last two. Those
    // two cannot be pinned to a recipient, so they are discarded — but discarding them must not
    // cost us the Algorand offer sitting beside them.
    const decoded = decodePaymentRequired(AVM_CAPTURED_REQUIRED_MULTIRAIL);
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].network).toBe(AVM_NETWORK);
    expect(decoded.accepts[0].payTo).toBe(AVM_PAY_TO);
  });

  it("refuses an envelope in which no rail at all is usable", () => {
    // Every entry unpayable is a different thing from one entry unpayable, and it must still fail
    // closed rather than hand back an empty accepts array for the signer to iterate over.
    const useless = { x402Version: 2, accepts: [{ scheme: "exact", network: "eip155:84532", amount: "1" }] };
    expect(() => decodePaymentRequired(asHeader(useless))).toThrow(/no usable payment rail/);
  });

  it("rejects an Algorand payTo of the wrong length", () => {
    const short = { x402Version: 2, accepts: [{ ...avmOffer(), payTo: AVM_PAY_TO.slice(0, 57) }] };
    expect(() => decodePaymentRequired(asHeader(short))).toThrow(PaymentHeaderError);
  });

  it("rejects a lowercased Algorand payTo, because base32 addresses are uppercase", () => {
    const lower = { x402Version: 2, accepts: [{ ...avmOffer(), payTo: AVM_PAY_TO.toLowerCase() }] };
    expect(() => decodePaymentRequired(asHeader(lower))).toThrow(PaymentHeaderError);
  });

  it("rejects base32 padding characters that are not in the Algorand alphabet", () => {
    // 0, 1, 8 and 9 are excluded from RFC 4648 base32 precisely to avoid look-alike confusion.
    const bad = { x402Version: 2, accepts: [{ ...avmOffer(), payTo: `01${AVM_PAY_TO.slice(2)}` }] };
    expect(() => decodePaymentRequired(asHeader(bad))).toThrow(PaymentHeaderError);
  });

  it("still decodes the EVM capture — the rails coexist until phase A3", () => {
    expect(decodePaymentRequired(CAPTURED_REQUIRED).accepts[0].payTo)
      .toBe("0x2de7B9388C249D20800bA097eD5DEb66e4437Dc4");
  });
});

describe("decodePaymentResponse — Algorand", () => {
  it("extracts a 52-character base32 transaction id unchanged", () => {
    const settlement = decodePaymentResponse(AVM_CAPTURED_RESPONSE);
    expect(settlement.txHash).toBe(AVM_SETTLED_TX_ID);
    expect(settlement.txHash).toHaveLength(52);
    expect(settlement.txHash.startsWith("0x")).toBe(false);
    expect(settlement.settledAt).toBeInstanceOf(Date);
  });

  it("fails closed on a transaction id of the wrong length", () => {
    const truncated = asHeader({ success: true, transaction: AVM_SETTLED_TX_ID.slice(0, 51), network: AVM_NETWORK });
    expect(() => decodePaymentResponse(truncated)).toThrow(/transaction hash/);
  });

  it("fails closed on a lowercased transaction id", () => {
    const lower = asHeader({ success: true, transaction: AVM_SETTLED_TX_ID.toLowerCase(), network: AVM_NETWORK });
    expect(() => decodePaymentResponse(lower)).toThrow(/transaction hash/);
  });

  it("fails closed when the facilitator reports failure on Algorand too", () => {
    const failed = asHeader({ success: false, transaction: "", network: AVM_NETWORK, errorReason: "asset_not_opted_in" });
    expect(() => decodePaymentResponse(failed)).toThrow(/asset_not_opted_in/);
  });

  it("still extracts the EVM hash — the rails coexist until phase A3", () => {
    expect(decodePaymentResponse(CAPTURED_RESPONSE).txHash).toBe(SETTLED_TX_HASH);
  });
});
