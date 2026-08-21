// OWNER: CORE. Both directions for each of the 10 blocking rules — one input that trips it, one that
// passes it. Rules 11-13 are risk tiering and belong to the engine; they land in engine.test.ts at C4.
import { describe, expect, it } from "vitest";
import { ALGORAND_TESTNET_NETWORK_ID, ALGORAND_TESTNET_USDC_ASA } from "@/shared/env";
import {
  BLOCKING_RULES,
  BLOCKING_RULE_NAMES,
  ruleAbsoluteBlockThreshold,
  ruleAgentActive,
  ruleBudgetWindows,
  ruleMerchantAllowlisted,
  ruleMerchantNotBlocked,
  rulePerTransactionLimit,
  ruleRailAllowed,
  ruleRecipientPinned,
  ruleVelocity,
  ruleWalletAllowance,
} from "@/core/policy/rules";
import { toMinor } from "@/shared/money";
import {
  MERCHANT_WALLET,
  ROGUE_WALLET,
  SANDBOX,
  makeContext,
  makeCounters,
  makeIntent,
  makePolicy,
  makePolicyRules,
} from "@/core/tests/fixtures";

describe("policy rules", () => {
  it("1  BLOCKs a frozen agent", () => {
    const reason = ruleAgentActive(makeContext({ agentStatus: "FROZEN" }));
    expect(reason?.code).toBe("AGENT_FROZEN");
    expect(reason?.rule).toBe("agent.status");
    expect(ruleAgentActive(makeContext())).toBeNull();
  });

  it("2  BLOCKs a non-allowlisted network", () => {
    const ctx = makeContext({ intent: makeIntent({ network: "ethereum-mainnet" }) });
    const reason = ruleRailAllowed(ctx);
    expect(reason?.code).toBe("NETWORK_NOT_ALLOWED");
    expect(reason?.expected).toEqual([ALGORAND_TESTNET_NETWORK_ID]);
    expect(ruleRailAllowed(makeContext())).toBeNull();
  });

  it("2b BLOCKs a non-allowlisted asset", () => {
    const ctx = makeContext({ intent: makeIntent({ asset: "DAI" }) });
    expect(ruleRailAllowed(ctx)?.code).toBe("ASSET_NOT_ALLOWED");
    expect(ruleRailAllowed(makeContext({ intent: makeIntent({ asset: ALGORAND_TESTNET_USDC_ASA }) }))).toBeNull();
  });

  it("3  BLOCKs a blocklisted merchant", () => {
    const ctx = makeContext({ intent: makeIntent({ merchant: "rogue.example.com" }) });
    expect(ruleMerchantNotBlocked(ctx)?.code).toBe("MERCHANT_BLOCKED");
    expect(ruleMerchantNotBlocked(makeContext())).toBeNull();
  });

  it("3b BLOCKs a blocklisted merchant spelled in a different case", () => {
    // A hostname is case-insensitive, so this must not slip past the blocklist.
    const ctx = makeContext({ intent: makeIntent({ merchant: "Rogue.Example.COM" }) });
    expect(ruleMerchantNotBlocked(ctx)?.code).toBe("MERCHANT_BLOCKED");
  });

  it("4  BLOCKs an unknown merchant when unknownMerchantAction=BLOCK", () => {
    const ctx = makeContext({ intent: makeIntent({ merchant: "unknown.example.com" }) });
    const reason = ruleMerchantAllowlisted(ctx);
    expect(reason?.code).toBe("MERCHANT_NOT_ALLOWLISTED");
    expect(reason?.expected).toEqual([SANDBOX]);
    expect(ruleMerchantAllowlisted(makeContext())).toBeNull();
  });

  it("4b reports the same reason when unknownMerchantAction=HOLD — the engine decides the verdict", () => {
    const rules = makePolicyRules({
      merchant: { ...makePolicyRules().merchant, unknownMerchantAction: "HOLD" },
    });
    const ctx = makeContext({
      intent: makeIntent({ merchant: "unknown.example.com" }),
      policy: makePolicy({ rules }),
    });
    expect(ruleMerchantAllowlisted(ctx)?.code).toBe("MERCHANT_NOT_ALLOWLISTED");
    expect(ctx.policy.rules.merchant.unknownMerchantAction).toBe("HOLD");
  });

  it("5  BLOCKs when payTo differs from the pinned recipient", () => {
    const ctx = makeContext({ intent: makeIntent({ recipient: ROGUE_WALLET }) });
    const reason = ruleRecipientPinned(ctx);
    expect(reason?.code).toBe("RECIPIENT_MISMATCH");
    expect(reason?.observed).toBe(ROGUE_WALLET);
    expect(ruleRecipientPinned(makeContext())).toBeNull();
  });

  it("5b passes a correct recipient written in a different case", () => {
    // Checksummed and lowercase spellings are the same address; blocking here would break every payment.
    const ctx = makeContext({
      intent: makeIntent({ recipient: MERCHANT_WALLET.toLowerCase() as `0x${string}` }),
    });
    expect(ruleRecipientPinned(ctx)).toBeNull();
  });

  it("5c passes an unpinned merchant — risk scores that, it does not block", () => {
    const rules = makePolicyRules({
      merchant: { ...makePolicyRules().merchant, pinnedRecipients: {} },
    });
    const ctx = makeContext({ policy: makePolicy({ rules }), pinnedRecipient: undefined });
    expect(ruleRecipientPinned(ctx)).toBeNull();
  });

  it("5d passes anything when enforceRecipientPinning is off", () => {
    const rules = makePolicyRules({
      merchant: { ...makePolicyRules().merchant, enforceRecipientPinning: false },
    });
    const ctx = makeContext({
      intent: makeIntent({ recipient: ROGUE_WALLET }),
      policy: makePolicy({ rules }),
    });
    expect(ruleRecipientPinned(ctx)).toBeNull();
  });

  it("6  BLOCKs above maxPerTransactionUsd", () => {
    const ctx = makeContext({ intent: makeIntent({ amountMinor: toMinor("2.00") }) });
    const reason = rulePerTransactionLimit(ctx);
    expect(reason?.code).toBe("PER_TRANSACTION_LIMIT_EXCEEDED");
    expect(reason?.message).toBe(
      "Transaction amount $2.00 exceeds the per-transaction limit of $1.00.",
    );
    expect(reason?.observed).toBe("2.00");
    expect(reason?.expected).toBe("1.00");
  });

  it("6b allows an amount exactly at maxPerTransactionUsd", () => {
    const ctx = makeContext({ intent: makeIntent({ amountMinor: toMinor("1.00") }) });
    expect(rulePerTransactionLimit(ctx)).toBeNull();
    // One minor unit over is the other side of the boundary.
    const over = makeContext({ intent: makeIntent({ amountMinor: toMinor("1.00") + 1n }) });
    expect(rulePerTransactionLimit(over)?.code).toBe("PER_TRANSACTION_LIMIT_EXCEEDED");
  });

  it("7  BLOCKs above blockAboveUsd", () => {
    const ctx = makeContext({ intent: makeIntent({ amountMinor: toMinor("1.50") }) });
    expect(ruleAbsoluteBlockThreshold(ctx)?.code).toBe("ABSOLUTE_BLOCK_THRESHOLD");
    const atThreshold = makeContext({ intent: makeIntent({ amountMinor: toMinor("1.00") }) });
    expect(ruleAbsoluteBlockThreshold(atThreshold)).toBeNull();
  });

  it("8  BLOCKs when the daily window would be exceeded", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.10") }),
      counters: makeCounters({ daySpentMinor: toMinor("4.95") }),
    });
    const reason = ruleBudgetWindows(ctx);
    expect(reason?.code).toBe("BUDGET_EXCEEDED");
    expect(reason?.rule).toBe("financial.dailyBudgetUsd");
    expect(ruleBudgetWindows(makeContext())).toBeNull();
  });

  it("8b BLOCKs when the hourly window would be exceeded", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.10") }),
      counters: makeCounters({ hourSpentMinor: toMinor("0.95") }),
    });
    expect(ruleBudgetWindows(ctx)?.rule).toBe("financial.hourlyBudgetUsd");
  });

  it("8c counts outstanding reservations against the window", () => {
    // Spend alone leaves room; the reservation is what closes it. This is the race C6 defends.
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.10") }),
      counters: makeCounters({ daySpentMinor: toMinor("4.50"), reservedMinor: toMinor("0.45") }),
    });
    expect(ruleBudgetWindows(ctx)?.code).toBe("BUDGET_EXCEEDED");
  });

  it("8d allows spend landing exactly on the budget", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.10") }),
      counters: makeCounters({ daySpentMinor: toMinor("4.90") }),
    });
    expect(ruleBudgetWindows(ctx)).toBeNull();
  });

  it("8e reports the hourly window before the daily one when both are blown", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.10") }),
      counters: makeCounters({ hourSpentMinor: toMinor("1.00"), daySpentMinor: toMinor("5.00") }),
    });
    expect(ruleBudgetWindows(ctx)?.rule).toBe("financial.hourlyBudgetUsd");
  });

  it("9  BLOCKs above maxTxPerMinute", () => {
    const ctx = makeContext({ counters: makeCounters({ txLastMinute: 10 }) });
    const reason = ruleVelocity(ctx);
    expect(reason?.code).toBe("VELOCITY_EXCEEDED");
    expect(reason?.rule).toBe("velocity.maxTxPerMinute");
    expect(ruleVelocity(makeContext({ counters: makeCounters({ txLastMinute: 9 }) }))).toBeNull();
  });

  it("9b BLOCKs on the per-merchant minute limit and on the hourly limit", () => {
    const perMerchant = makeContext({ counters: makeCounters({ txLastMinuteForMerchant: 5 }) });
    expect(ruleVelocity(perMerchant)?.rule).toBe("velocity.maxTxPerMerchantPerMinute");
    const perHour = makeContext({ counters: makeCounters({ txLastHour: 100 }) });
    expect(ruleVelocity(perHour)?.rule).toBe("velocity.maxTxPerHour");
  });

  it("10 BLOCKs when the wallet allowance is insufficient", () => {
    const ctx = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.05") }),
      walletAllowanceRemainingMinor: toMinor("0.01"),
    });
    expect(ruleWalletAllowance(ctx)?.code).toBe("ALLOWANCE_EXHAUSTED");
    const exact = makeContext({
      intent: makeIntent({ amountMinor: toMinor("0.05") }),
      walletAllowanceRemainingMinor: toMinor("0.05"),
    });
    expect(ruleWalletAllowance(exact)).toBeNull();
  });

  // Rules 11-13 are risk tiering, which only exists once rules and score are combined.
  // They are asserted in tests/policy/engine.test.ts as "11", "12" and "13".
});

describe("BLOCKING_RULES", () => {
  it("passes every rule on a clean context", () => {
    const ctx = makeContext();
    expect(BLOCKING_RULES.map((rule) => rule(ctx))).toEqual(BLOCKING_RULES.map(() => null));
  });

  it("keeps the frozen precedence order", () => {
    expect(BLOCKING_RULES).toHaveLength(10);
    expect(BLOCKING_RULES[0]).toBe(ruleAgentActive);
    expect(BLOCKING_RULES[3]).toBe(ruleMerchantAllowlisted);
    expect(BLOCKING_RULES[9]).toBe(ruleWalletAllowance);
  });

  it("names every rule, so matchedRules cannot drift out of step", () => {
    expect(BLOCKING_RULE_NAMES).toHaveLength(BLOCKING_RULES.length);
  });

  it("is deterministic — the same context yields identical reasons on 1000 runs", () => {
    const ctx = makeContext({ intent: makeIntent({ amountMinor: toMinor("2.00") }) });
    const first = JSON.stringify(BLOCKING_RULES.map((rule) => rule(ctx)));
    for (let i = 0; i < 1000; i += 1) {
      expect(JSON.stringify(BLOCKING_RULES.map((rule) => rule(ctx)))).toBe(first);
    }
  });

  it("throws on a malformed policy amount, so the engine can fail closed", () => {
    const rules = makePolicyRules({
      financial: { ...makePolicyRules().financial, maxPerTransactionUsd: "ten dollars" },
    });
    const ctx = makeContext({ policy: makePolicy({ rules }) });
    expect(() => rulePerTransactionLimit(ctx)).toThrow(/Invalid USD amount/);
  });
});
