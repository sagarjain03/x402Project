// OWNER: CORE. The decision: blocking rules in precedence order, then risk tiering. Pure, zero I/O.
// latencyMs is measured by context.ts — a clock in this file would break the determinism claim.
import { BLOCKING_RULES, BLOCKING_RULE_NAMES } from "@/core/policy/rules";
import { scoreRisk } from "@/core/risk/score";
import { ERROR_CODES } from "@/shared/errors";
import { formatUsd, toMinor } from "@/shared/money";
import type { Decision, EvaluationContext, EvaluationResult, Reason, RiskSignal } from "@/shared/types";

function riskTooHighReason(score: number, threshold: number): Reason {
  return {
    code: "RISK_TOO_HIGH",
    rule: "risk.riskBlockScore",
    message: `Risk score ${score} is at or above the block threshold of ${threshold}.`,
    observed: String(score),
    expected: String(threshold),
  };
}

function holdReasons(ctx: EvaluationContext, score: number): Reason[] {
  const { risk } = ctx.policy.rules;
  const reasons: Reason[] = [];

  if (score >= risk.riskHoldScore) {
    reasons.push({
      code: "APPROVAL_REQUIRED",
      rule: "risk.riskHoldScore",
      message: `Risk score ${score} is at or above the review threshold of ${risk.riskHoldScore}.`,
      observed: String(score),
      expected: String(risk.riskHoldScore),
    });
  }

  const [lowUsd, highUsd] = risk.holdBetweenUsd;
  const lowMinor = toMinor(lowUsd);
  const highMinor = toMinor(highUsd);
  if (ctx.intent.amountMinor >= lowMinor && ctx.intent.amountMinor <= highMinor) {
    reasons.push({
      code: "APPROVAL_REQUIRED",
      rule: "risk.holdBetweenUsd",
      message: `${formatUsd(ctx.intent.amountMinor)} falls in the ${formatUsd(lowMinor)}-${formatUsd(highMinor)} review band.`,
      observed: `${formatUsd(ctx.intent.amountMinor)}`,
      expected: [lowUsd, highUsd],
    });
  }

  return reasons;
}

export function evaluate(ctx: EvaluationContext): EvaluationResult {
  const matchedRules: string[] = [];

  const finish = (
    decision: Decision,
    reasons: Reason[],
    riskScore = 0,
    riskSignals: RiskSignal[] = [],
  ): EvaluationResult => ({
    decision,
    reasons,
    riskScore,
    riskSignals,
    matchedRules,
    policyVersion: ctx.policy?.version ?? 0,
    latencyMs: 0,
  });

  try {
    // A context assembled without an active policy must never read as an allow.
    if (!ctx.policy?.rules) {
      return finish("BLOCK", [{
        code: "NO_ACTIVE_POLICY",
        rule: "policy.isActive",
        message: ERROR_CODES.NO_ACTIVE_POLICY.message,
      }]);
    }

    let failure: Reason | null = null;
    for (let index = 0; index < BLOCKING_RULES.length; index += 1) {
      matchedRules.push(BLOCKING_RULE_NAMES[index]);
      failure = BLOCKING_RULES[index](ctx);
      if (failure) break;
    }

    // Scored on every path, not just the clean one: the transaction detail page shows a risk
    // number for blocked payments too. It only *decides* anything when no rule fired.
    const { score, signals } = scoreRisk(ctx);

    if (failure) {
      // Rule 4 is the only blocking rule the policy is allowed to soften into a review.
      const reviewable =
        failure.code === "MERCHANT_NOT_ALLOWLISTED" &&
        ctx.policy.rules.merchant.unknownMerchantAction === "HOLD";

      if (!reviewable) return finish("BLOCK", [failure], score, signals);

      // The reviewer saw this merchant and said yes. Holding it again would queue it forever.
      if (ctx.approvalGranted) return finish("ALLOW", [], score, signals);

      return finish("HOLD", [failure, {
        code: "APPROVAL_REQUIRED",
        rule: "merchant.unknownMerchantAction",
        message: `Merchant ${ctx.intent.merchant} is unknown and needs human review.`,
        observed: ctx.intent.merchant,
      }], score, signals);
    }

    if (score >= ctx.policy.rules.risk.riskBlockScore) {
      return finish("BLOCK", [riskTooHighReason(score, ctx.policy.rules.risk.riskBlockScore)], score, signals);
    }

    // Every blocking rule above still applies to an approved payment — budget, velocity and the
    // per-transaction ceiling can all have moved while it waited. Only the review gate is spent.
    const holds = holdReasons(ctx, score);
    if (holds.length > 0 && !ctx.approvalGranted) return finish("HOLD", holds, score, signals);

    return finish("ALLOW", [], score, signals);
  } catch {
    // Fail closed. A throwing rule, a malformed policy amount or a missing counter all land here,
    // and every one of them has to read as BLOCK rather than leak through as an allow.
    return finish("BLOCK", [{
      code: "GUARD_UNAVAILABLE",
      rule: "engine",
      message: ERROR_CODES.GUARD_UNAVAILABLE.message,
    }]);
  }
}
