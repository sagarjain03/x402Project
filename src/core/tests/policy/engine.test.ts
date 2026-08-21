// OWNER: CORE. Properties of the engine itself, not of individual rules, plus rules 11-13 —
// the risk tiering that only exists once rules and score are combined.
import { describe, expect, it } from "vitest";
import { evaluate } from "@/core/policy/engine";
import { BLOCKING_RULES, BLOCKING_RULE_NAMES } from "@/core/policy/rules";
import { toMinor } from "@/shared/money";
import type { EvaluationContext, Policy } from "@/shared/types";
import {
  ROGUE_WALLET,
  makeContext,
  makeCounters,
  makeIntent,
  makePolicy,
  makePolicyRules,
} from "@/core/tests/fixtures";

/** Trips one rule each, so "no blocking rule may end in ALLOW" can be asserted across all ten. */
const TRIPPING_CONTEXTS: { rule: string; ctx: EvaluationContext }[] = [
  { rule: "agent.status", ctx: makeContext({ agentStatus: "FROZEN" }) },
  { rule: "rail", ctx: makeContext({ intent: makeIntent({ network: "ethereum-mainnet" }) }) },
  { rule: "merchant.blockedMerchants", ctx: makeContext({ intent: makeIntent({ merchant: "rogue.example.com" }) }) },
  { rule: "merchant.allowedMerchants", ctx: makeContext({ intent: makeIntent({ merchant: "unknown.example.com" }) }) },
  { rule: "merchant.pinnedRecipients", ctx: makeContext({ intent: makeIntent({ recipient: ROGUE_WALLET }) }) },
  { rule: "financial.maxPerTransactionUsd", ctx: makeContext({ intent: makeIntent({ amountMinor: toMinor("2.00") }) }) },
  {
    rule: "risk.blockAboveUsd",
    ctx: makeContext({
      intent: makeIntent({ amountMinor: toMinor("1.50") }),
      // Lift the per-transaction cap so rule 7 is the one that fires, not rule 6.
      policy: makePolicy({
        rules: makePolicyRules({
          financial: { ...makePolicyRules().financial, maxPerTransactionUsd: "10.00" },
        }),
      }),
    }),
  },
  {
    rule: "financial.budgets",
    ctx: makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.10") }),
      counters: makeCounters({ daySpentMinor: toMinor("4.95") }),
    }),
  },
  { rule: "velocity", ctx: makeContext({ counters: makeCounters({ txLastMinute: 10 }) }) },
  { rule: "wallet.allowanceCap", ctx: makeContext({ walletAllowanceRemainingMinor: toMinor("0.001") }) },
];

describe("policy engine", () => {
  it("returns the FIRST failing rule, in documented precedence order", () => {
    // Trips rule 3 (blocked merchant) and rule 8 (daily budget) at once.
    const ctx = makeContext({
      intent: makeIntent({ merchant: "rogue.example.com", amountMinor: toMinor("0.10") }),
      counters: makeCounters({ daySpentMinor: toMinor("4.95") }),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0].code).toBe("MERCHANT_BLOCKED");
  });

  it("prefers rule 6 over rule 7 when an amount trips both", () => {
    const ctx = makeContext({ intent: makeIntent({ amountMinor: toMinor("5.00") }) });
    expect(evaluate(ctx).reasons[0].code).toBe("PER_TRANSACTION_LIMIT_EXCEEDED");
  });

  it("prefers rule 5 over the amount rules — a wrong payee outranks a large amount", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("2000.00"), recipient: ROGUE_WALLET }),
    });
    expect(evaluate(ctx).reasons[0].code).toBe("RECIPIENT_MISMATCH");
  });

  it("is deterministic: same context => same decision, 1000 runs", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.09") }),
      merchantKnown: false,
      counters: makeCounters({ blockedAttemptsLast5Min: 2, txLastMinute: 8 }),
    });
    const first = JSON.stringify(evaluate(ctx));
    for (let i = 0; i < 1000; i += 1) {
      expect(JSON.stringify(evaluate(ctx))).toBe(first);
    }
  });

  it("fails CLOSED when a rule throws", () => {
    const index = 5;
    const original = BLOCKING_RULES[index];
    BLOCKING_RULES[index] = () => {
      throw new Error("rule exploded");
    };
    try {
      const result = evaluate(makeContext());
      expect(result.decision).toBe("BLOCK");
      expect(result.reasons[0].code).toBe("GUARD_UNAVAILABLE");
    } finally {
      BLOCKING_RULES[index] = original;
    }
  });

  it("fails CLOSED when a policy amount is malformed", () => {
    const rules = makePolicyRules({
      financial: { ...makePolicyRules().financial, dailyBudgetUsd: "five dollars" },
    });
    const result = evaluate(makeContext({ policy: makePolicy({ rules }) }));
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("GUARD_UNAVAILABLE");
  });

  it("fails CLOSED when the policy is missing", () => {
    const result = evaluate(makeContext({ policy: undefined as unknown as Policy }));
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("NO_ACTIVE_POLICY");
  });

  it("never returns ALLOW when any blocking rule produced a Reason", () => {
    for (const { rule, ctx } of TRIPPING_CONTEXTS) {
      const result = evaluate(ctx);
      expect(result.decision, `${rule} must not ALLOW`).not.toBe("ALLOW");
      expect(result.reasons.length, `${rule} must explain itself`).toBeGreaterThan(0);
    }
  });

  it("stops walking rules at the first failure and reports what it checked", () => {
    const blockedFirst = evaluate(makeContext({ agentStatus: "FROZEN" }));
    expect(blockedFirst.matchedRules).toEqual(["agent.status"]);

    const clean = evaluate(makeContext());
    expect(clean.matchedRules).toEqual(BLOCKING_RULE_NAMES);
  });

  it("reports the policy version it decided under and leaves latency to the caller", () => {
    const result = evaluate(makeContext({ policy: makePolicy({ version: 7 }) }));
    expect(result.policyVersion).toBe(7);
    expect(result.latencyMs).toBe(0);
  });

  it("11 BLOCKs when riskScore >= riskBlockScore", () => {
    // merchantKnown is false while the merchant is still allowlisted, so no blocking rule fires
    // and the decision is made purely on the score: 40 + 25 = 65, over the 60 block threshold.
    const ctx = makeContext({
      merchantKnown: false,
      counters: makeCounters({ blockedAttemptsLast5Min: 2 }),
    });
    const result = evaluate(ctx);
    expect(result.riskScore).toBe(65);
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("RISK_TOO_HIGH");
    expect(result.reasons[0].rule).toBe("risk.riskBlockScore");
  });

  it("11b HOLDs rather than BLOCKs when the score only clears the review threshold", () => {
    // 25 + 10 = 35: over riskHoldScore 30, under riskBlockScore 60.
    const ctx = makeContext({
      counters: makeCounters({ blockedAttemptsLast5Min: 1, isFirstPayment: true }),
    });
    const result = evaluate(ctx);
    expect(result.riskScore).toBe(35);
    expect(result.decision).toBe("HOLD");
    expect(result.reasons[0].rule).toBe("risk.riskHoldScore");
  });

  it("12 HOLDs when the amount sits in holdBetweenUsd", () => {
    const result = evaluate(makeContext({ intent: makeIntent({ amountMinor: toMinor("0.45") }) }));
    expect(result.decision).toBe("HOLD");
    expect(result.reasons.map((reason) => reason.code)).toContain("APPROVAL_REQUIRED");
    expect(result.reasons.some((reason) => reason.rule === "risk.holdBetweenUsd")).toBe(true);
    expect(result.reasons.find((reason) => reason.rule === "risk.holdBetweenUsd")?.message).toBe(
      "$0.45 falls in the $0.10-$1.00 review band.",
    );
  });

  it("12a keeps the whole review band reachable under the default policy", () => {
    // Regression guard. A maxPerTransactionUsd below holdBetweenUsd[1] makes rule 6 shadow the
    // entire band, so no payment can ever reach human review and the approvals queue stays empty.
    // That shipped in the first seed; this assertion is what stops it coming back.
    const { financial, risk } = makePolicyRules();
    expect(toMinor(financial.maxPerTransactionUsd)).toBeGreaterThanOrEqual(toMinor(risk.holdBetweenUsd[1]));

    for (const usd of ["0.10", "0.45", "0.80", "1.00"]) {
      const result = evaluate(makeContext({ intent: makeIntent({ amountMinor: toMinor(usd) }) }));
      expect(result.decision, `$${usd} must reach human review`).toBe("HOLD");
    }
  });

  it("12b HOLDs an unknown merchant when unknownMerchantAction=HOLD", () => {
    const rules = makePolicyRules({
      merchant: { ...makePolicyRules().merchant, unknownMerchantAction: "HOLD" },
    });
    const ctx = makeContext({
      intent: makeIntent({ merchant: "unknown.example.com" }),
      policy: makePolicy({ rules }),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("HOLD");
    expect(result.reasons.map((reason) => reason.code)).toEqual([
      "MERCHANT_NOT_ALLOWLISTED",
      "APPROVAL_REQUIRED",
    ]);
  });

  it("12c BLOCKs the same unknown merchant when unknownMerchantAction=BLOCK", () => {
    const ctx = makeContext({ intent: makeIntent({ merchant: "unknown.example.com" }) });
    const result = evaluate(ctx);
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("MERCHANT_NOT_ALLOWLISTED");
  });

  it("13 ALLOWs a clean low-risk payment", () => {
    const result = evaluate(makeContext());
    expect(result.decision).toBe("ALLOW");
    expect(result.reasons).toEqual([]);
    expect(result.riskScore).toBe(0);
    expect(result.riskSignals).toEqual([]);
    expect(result.matchedRules).toEqual(BLOCKING_RULE_NAMES);
  });

  it("carries the risk score onto a blocked payment, so the UI can still explain it", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("2.00") }),
      counters: makeCounters({ blockedAttemptsLast5Min: 1 }),
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("BLOCK");
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.riskSignals.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// A human approval is permission to pass the review gate, not permission to pass everything else.
// The asymmetry below is the whole security property: HOLD is spent, every BLOCK still stands.
// ---------------------------------------------------------------------------------------------
describe("approvalGranted", () => {
  const inBand = () => makeIntent({ amountMinor: toMinor("0.50") });

  it("HOLDs an in-band amount when no approval has been granted", () => {
    const result = evaluate(makeContext({ intent: inBand() }));
    expect(result.decision).toBe("HOLD");
    expect(result.reasons[0].code).toBe("APPROVAL_REQUIRED");
  });

  it("ALLOWs the same amount once a reviewer has approved it", () => {
    const result = evaluate(makeContext({ intent: inBand(), approvalGranted: true }));
    expect(result.decision).toBe("ALLOW");
    expect(result.reasons).toEqual([]);
  });

  it("ALLOWs an approved unknown merchant that would otherwise be queued for review", () => {
    const ctx = makeContext({
      intent: makeIntent({ merchant: "unknown.example.com" }),
      merchantKnown: false,
      policy: makePolicy({
        rules: makePolicyRules({
          merchant: { ...makePolicyRules().merchant, unknownMerchantAction: "HOLD" },
        }),
      }),
      approvalGranted: true,
    });
    expect(evaluate(ctx).decision).toBe("ALLOW");
  });

  it("does NOT rescue a payment any blocking rule refuses", () => {
    const blocked: { why: string; ctx: EvaluationContext }[] = [
      { why: "over the per-transaction limit", ctx: makeContext({ intent: makeIntent({ amountMinor: toMinor("2.00") }), approvalGranted: true }) },
      { why: "frozen agent", ctx: makeContext({ agentStatus: "FROZEN", approvalGranted: true }) },
      { why: "budget exhausted", ctx: makeContext({ intent: makeIntent({ amountMinor: toMinor("0.50") }), counters: makeCounters({ daySpentMinor: toMinor("4.95") }), approvalGranted: true }) },
      { why: "velocity", ctx: makeContext({ intent: makeIntent({ amountMinor: toMinor("0.50") }), counters: makeCounters({ txLastMinute: 10 }), approvalGranted: true }) },
      { why: "wrong rail", ctx: makeContext({ intent: makeIntent({ amountMinor: toMinor("0.50"), network: "ethereum-mainnet" }), approvalGranted: true }) },
      { why: "recipient not the pinned one", ctx: makeContext({ intent: makeIntent({ amountMinor: toMinor("0.50"), recipient: ROGUE_WALLET }), approvalGranted: true }) },
    ];

    for (const { why, ctx } of blocked) {
      const result = evaluate(ctx);
      expect(result.decision, `approval must not rescue: ${why}`).toBe("BLOCK");
    }
  });

  it("still BLOCKs on risk score even when approved, because riskBlockScore is a block not a hold", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.50") }),
      counters: makeCounters({ blockedAttemptsLast5Min: 5, txLastMinute: 8, isFirstPayment: true }),
      policy: makePolicy({
        rules: makePolicyRules({ risk: { ...makePolicyRules().risk, riskBlockScore: 1 } }),
      }),
      approvalGranted: true,
    });
    const result = evaluate(ctx);
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("RISK_TOO_HIGH");
  });
});
