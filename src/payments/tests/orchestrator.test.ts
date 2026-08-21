// OWNER: PAY. The whole flow, and the rule that matters most: once a reservation exists, every
// exit path releases it. A leaked reservation silently shrinks the budget until someone restarts.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.GUARD_HMAC_SECRET ??= "test-only-secret";
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

import {
  AVM_CAPTURED_REQUIRED,
  AVM_CAPTURED_RESPONSE,
  AVM_SETTLED_TX_ID,
  CAPTURED_REQUIRED,
  CAPTURED_RESPONSE,
  SETTLED_TX_HASH,
  asHeader,
} from "@/payments/tests/fixtures";
import { HEADER } from "@/payments/x402/headers";
import type { EvaluationResult } from "@/shared/types";

const core = vi.hoisted(() => ({
  evaluatePayment: vi.fn(),
  reserveBudget: vi.fn(),
  commitBudget: vi.fn(),
  releaseBudget: vi.fn(),
}));
vi.mock("@/core", () => core);

const forward = vi.hoisted(() => ({ forwardToMerchant: vi.fn(), isStrippedHeader: vi.fn() }));
vi.mock("@/payments/gateway/forward", () => forward);

const { runGuardedRequest } = await import("@/payments/gateway/orchestrator");

const ALLOW: EvaluationResult = {
  decision: "ALLOW", reasons: [], riskScore: 0, riskSignals: [], matchedRules: [], policyVersion: 1, latencyMs: 1,
};

// The capture was served from localhost:3001, so the request URL must agree or the signer's
// merchant check fires before any failure path is reached.
const REQUEST = { agentId: "agt_researchbot", url: "http://localhost:3001/api/gw/poc-seller", method: "POST" };

const quoted = () => new Response(null, { status: 402, headers: { [HEADER.required]: CAPTURED_REQUIRED } });

// The Algorand capture, served from the host its resource.url names so the signer's merchant
// check agrees. Used by the rail test below; the rest stay on the EVM capture on purpose, to keep
// proving that none of the guard's checks depend on which chain the money moves over.
const AVM_REQUEST = { agentId: "agt_researchbot", url: "https://x402.goplausible.xyz/examples/weather", method: "GET" };
const avmQuoted = () => new Response(null, { status: 402, headers: { [HEADER.required]: AVM_CAPTURED_REQUIRED } });
const avmSettled = () => new Response(JSON.stringify({ forecast: {} }), { status: 200, headers: { [HEADER.response]: AVM_CAPTURED_RESPONSE } });
const settled = () => new Response(JSON.stringify({ results: [] }), { status: 200, headers: { [HEADER.response]: CAPTURED_RESPONSE } });

/** First call is the unpaid probe, second is the paid retry. */
function merchantReplies(unpaid: () => Response, paid: () => Response | Promise<never>) {
  forward.forwardToMerchant.mockImplementationOnce(async () => unpaid());
  forward.forwardToMerchant.mockImplementationOnce(async () => paid());
}

beforeEach(() => {
  vi.clearAllMocks();
  core.evaluatePayment.mockResolvedValue(ALLOW);
  core.reserveBudget.mockResolvedValue({ reservationId: "rsv_test", intentId: "int_test", amountMinor: 10_000n, expiresAt: new Date(Date.now() + 120_000) });
  core.commitBudget.mockResolvedValue(undefined);
  core.releaseBudget.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe("runGuardedRequest — happy path", () => {
  it("settles, commits the budget and returns the tx hash", async () => {
    merchantReplies(quoted, settled);

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("SETTLED");
    expect(result.onChain).toEqual({ signed: true, txHash: SETTLED_TX_HASH });
    expect(result.payment?.amount).toBe("0.01");
    expect(result.payment?.explorerUrl).toContain(SETTLED_TX_HASH);
    expect(core.commitBudget).toHaveBeenCalledOnce();
    expect(core.releaseBudget).not.toHaveBeenCalled();
  });

  it("passes a free resource straight through without touching the budget", async () => {
    forward.forwardToMerchant.mockResolvedValueOnce(new Response(JSON.stringify({ free: true }), { status: 200 }));

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("SETTLED");
    expect(result.onChain.signed).toBe(false);
    expect(core.reserveBudget).not.toHaveBeenCalled();
    expect(core.releaseBudget).not.toHaveBeenCalled();
  });

  it.each([404, 403, 500, 503])("reports a merchant %i as FAILED, never as a free resource", async (status) => {
    forward.forwardToMerchant.mockResolvedValueOnce(new Response("nope", { status }));

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("FAILED");
    expect(result.reasons[0].code).toBe("UPSTREAM_UNAVAILABLE");
    expect(core.reserveBudget).not.toHaveBeenCalled();
  });
});

describe("runGuardedRequest — Algorand rail", () => {
  it("settles and links the transaction to Lora, not to a Base explorer", async () => {
    merchantReplies(avmQuoted, avmSettled);

    const result = await runGuardedRequest(AVM_REQUEST);

    expect(result.status).toBe("SETTLED");
    expect(result.onChain).toEqual({ signed: true, txHash: AVM_SETTLED_TX_ID });
    // A BaseScan link for an Algorand transaction renders as "not found", which reads to a judge
    // as a failed payment. Wrong explorer is worse than no explorer.
    expect(result.payment?.explorerUrl).toBe(`https://lora.algokit.io/testnet/transaction/${AVM_SETTLED_TX_ID}`);
    expect(core.commitBudget).toHaveBeenCalledOnce();
  });
});

describe("runGuardedRequest — nothing is signed before ALLOW", () => {
  it("blocks without reserving or signing", async () => {
    forward.forwardToMerchant.mockResolvedValueOnce(quoted());
    core.evaluatePayment.mockResolvedValue({ ...ALLOW, decision: "BLOCK", reasons: [{ code: "BUDGET_EXCEEDED", rule: "financial.dailyBudgetUsd", message: "over budget" }] });

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("BLOCKED");
    expect(result.onChain).toEqual({ signed: false, txHash: null });
    expect(result.reasons[0].code).toBe("BUDGET_EXCEEDED");
    expect(core.reserveBudget).not.toHaveBeenCalled();
    expect(forward.forwardToMerchant).toHaveBeenCalledOnce();
  });

  it("holds for human review without reserving", async () => {
    forward.forwardToMerchant.mockResolvedValueOnce(quoted());
    core.evaluatePayment.mockResolvedValue({ ...ALLOW, decision: "HOLD" });

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("PENDING_APPROVAL");
    expect(result.onChain.signed).toBe(false);
    expect(core.reserveBudget).not.toHaveBeenCalled();
  });

  // The real ledger throws instead of returning a decision when a window has no room. That is a
  // policy outcome, so it has to read as BLOCKED here — a FAILED would claim the guard broke.
  it("blocks, and signs nothing, when the ledger refuses the reservation", async () => {
    forward.forwardToMerchant.mockResolvedValueOnce(quoted());
    core.reserveBudget.mockRejectedValueOnce(
      Object.assign(new Error("This payment would take daily spend over the $5.00 daily budget."), { code: "BUDGET_EXCEEDED" }),
    );

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("BLOCKED");
    expect(result.onChain).toEqual({ signed: false, txHash: null });
    expect(result.reasons[0].code).toBe("BUDGET_EXCEEDED");
    // Nothing was reserved, so nothing may be released — a stray release would credit a phantom.
    expect(core.releaseBudget).not.toHaveBeenCalled();
    expect(forward.forwardToMerchant).toHaveBeenCalledOnce();
  });

  it("blocks on the caller's own maxAmountUsd before CORE is even asked", async () => {
    forward.forwardToMerchant.mockResolvedValueOnce(quoted());

    const result = await runGuardedRequest({ ...REQUEST, maxAmountUsd: "0.005" });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons[0].code).toBe("PER_TRANSACTION_LIMIT_EXCEEDED");
    expect(core.evaluatePayment).not.toHaveBeenCalled();
    expect(core.reserveBudget).not.toHaveBeenCalled();
  });
});

describe("runGuardedRequest — every failure path releases the reservation", () => {
  const FAILURES: Array<[string, () => void, string]> = [
    ["merchant 500", () => merchantReplies(quoted, () => new Response("boom", { status: 500 })), "UPSTREAM_UNAVAILABLE"],
    ["402 on retry", () => merchantReplies(quoted, () => new Response(null, { status: 402 })), "SETTLEMENT_FAILED"],
    ["verify-fail: paid 200 with no settlement header", () => merchantReplies(quoted, () => new Response("{}", { status: 200 })), "SETTLEMENT_FAILED"],
    ["settle-fail: facilitator reports success false", () => merchantReplies(quoted, () => new Response("{}", {
      status: 200,
      headers: { [HEADER.response]: asHeader({ success: false, transaction: "", network: "eip155:84532", errorReason: "insufficient_funds" }) },
    })), "SETTLEMENT_FAILED"],
    ["timeout", () => merchantReplies(quoted, () => { throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }); }), "UPSTREAM_UNAVAILABLE"],
  ];

  it.each(FAILURES)("%s", async (_label, arrange, expectedCode) => {
    arrange();

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("FAILED");
    expect(result.onChain).toEqual({ signed: false, txHash: null });
    expect(result.reasons[0].code).toBe(expectedCode);
    expect(core.releaseBudget).toHaveBeenCalledOnce();
    expect(core.commitBudget).not.toHaveBeenCalled();
  });

  it("releases when the signer itself refuses, and never retries the merchant", async () => {
    // The offer is served by a host other than the one the intent was built for, so the signer's
    // merchant check fires and the paid retry is never issued.
    const elsewhere = asHeader({
      x402Version: 2,
      resource: { url: "http://evil.example.com/api/gw/poc-seller" },
      accepts: [{ scheme: "exact", network: "eip155:84532", amount: "10000", asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", payTo: "0x2de7B9388C249D20800bA097eD5DEb66e4437Dc4" }],
    });
    forward.forwardToMerchant.mockResolvedValueOnce(new Response(null, { status: 402, headers: { [HEADER.required]: elsewhere } }));

    const result = await runGuardedRequest(REQUEST);

    expect(result.status).toBe("FAILED");
    expect(result.reasons[0].message).toMatch(/evil\.example\.com/);
    expect(core.releaseBudget).toHaveBeenCalledOnce();
    expect(core.commitBudget).not.toHaveBeenCalled();
    expect(forward.forwardToMerchant).toHaveBeenCalledOnce();
  });
});

// A payment held for human review is judged again on the retry, and CORE answers with the id of the
// row the reviewer approved. Everything the gateway writes has to follow that id: put the
// reservation or the tx hash on the fresh intent instead and the approvals queue shows an approved
// payment that never settled, next to an orphan row holding the hash.
describe("runGuardedRequest — resumed after human approval", () => {
  const APPROVED_INTENT_ID = "int_approved_by_a_human";

  beforeEach(() => {
    core.evaluatePayment.mockResolvedValue({ ...ALLOW, intentId: APPROVED_INTENT_ID });
  });

  it("reserves and reports against the approved intent, not the retry's own", async () => {
    merchantReplies(quoted, settled);

    const result = await runGuardedRequest({ ...REQUEST, idempotencyKey: APPROVED_INTENT_ID });

    expect(result.status).toBe("SETTLED");
    expect(result.intentId).toBe(APPROVED_INTENT_ID);
    // commitBudget stamps the tx hash by way of the reservation, so this is what puts the hash on
    // the approved row.
    expect(core.reserveBudget).toHaveBeenCalledWith("agt_researchbot", APPROVED_INTENT_ID, 10_000n);
  });

  it("carries the approved id onto a failure too, so the release is traceable to it", async () => {
    merchantReplies(quoted, () => new Response("gone", { status: 503 }));

    const result = await runGuardedRequest({ ...REQUEST, idempotencyKey: APPROVED_INTENT_ID });

    expect(result.status).toBe("FAILED");
    expect(result.intentId).toBe(APPROVED_INTENT_ID);
    expect(core.releaseBudget).toHaveBeenCalledOnce();
  });

  it("still uses the gateway's own intent when CORE names no other", async () => {
    core.evaluatePayment.mockResolvedValue(ALLOW);
    merchantReplies(quoted, settled);

    const result = await runGuardedRequest(REQUEST);

    expect(result.intentId).toMatch(/^int_/);
    expect(core.reserveBudget).toHaveBeenCalledWith("agt_researchbot", result.intentId, 10_000n);
  });
});
