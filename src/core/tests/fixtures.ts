// OWNER: CORE. Test contexts for the pure engine. Values mirror src/core/db/seed.ts so a failing
// test reads like the demo it protects. Overrides merge one level deep, exactly like the seed's own helper.
import { toMinor } from "@/shared/money";
import { ALGORAND_TESTNET_NETWORK_ID, ALGORAND_TESTNET_USDC_ASA } from "@/shared/env";
import type {
  EvaluationContext,
  PaymentIntent,
  Policy,
  PolicyRules,
  SpendCounters,
} from "@/shared/types";

export const SANDBOX = "localhost:3000";
export const MERCHANT_WALLET = "0x9a2B4c6D8e0F1a3B5c7D9e1F2a4B6c8D0e2F4a6B" as const;
export const ROGUE_WALLET = "0xdEaD00000000000000000000000000000000BEEF" as const;
export const NOW = new Date("2026-08-13T09:30:00.000Z");

export function makePolicyRules(overrides: Partial<PolicyRules> = {}): PolicyRules {
  return {
    financial: {
      maxPerTransactionUsd: "1.00",
      hourlyBudgetUsd: "1.00",
      dailyBudgetUsd: "5.00",
      monthlyBudgetUsd: "50.00",
    },
    merchant: {
      allowedMerchants: [SANDBOX],
      blockedMerchants: ["rogue.example.com"],
      pinnedRecipients: { [SANDBOX]: MERCHANT_WALLET },
      unknownMerchantAction: "BLOCK",
      enforceRecipientPinning: true,
    },
    velocity: { maxTxPerMinute: 10, maxTxPerHour: 100, maxTxPerMerchantPerMinute: 5 },
    rail: { allowedNetworks: [ALGORAND_TESTNET_NETWORK_ID], allowedAssets: [ALGORAND_TESTNET_USDC_ASA] },
    risk: {
      autoApproveBelowUsd: "0.10",
      holdBetweenUsd: ["0.10", "1.00"],
      blockAboveUsd: "1.00",
      riskHoldScore: 30,
      riskBlockScore: 60,
    },
    ...overrides,
  };
}

export function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    policyId: "pol_01TESTTESTTESTTESTTESTTEST",
    agentId: "agt_01TESTTESTTESTTESTTESTTEST",
    version: 3,
    isActive: true,
    rules: makePolicyRules(),
    createdAt: NOW,
    ...overrides,
  };
}

export function makeIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    intentId: "int_01TESTTESTTESTTESTTESTTEST",
    agentId: "agt_01TESTTESTTESTTESTTESTTEST",
    amountMinor: toMinor("0.02"),
    asset: ALGORAND_TESTNET_USDC_ASA,
    network: ALGORAND_TESTNET_NETWORK_ID,
    recipient: MERCHANT_WALLET,
    merchant: SANDBOX,
    resource: "POST /api/sandbox/search",
    reason: "search for x402 adoption data",
    nonce: "nonce_test_0",
    intentHash: "0".repeat(64),
    state: "EVALUATING",
    createdAt: NOW,
    ...overrides,
  };
}

export function makeCounters(overrides: Partial<SpendCounters> = {}): SpendCounters {
  return {
    hourSpentMinor: 0n,
    daySpentMinor: 0n,
    monthSpentMinor: 0n,
    reservedMinor: 0n,
    txLastMinute: 0,
    txLastHour: 0,
    txLastMinuteForMerchant: 0,
    blockedAttemptsLast5Min: 0,
    medianAmountMinor24h: toMinor("0.03"),
    isFirstPayment: false,
    ...overrides,
  };
}

/** Every rule passes on this context. Override one field per test so the failure is unambiguous. */
export function makeContext(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    intent: makeIntent(),
    policy: makePolicy(),
    counters: makeCounters(),
    agentStatus: "ACTIVE",
    merchantKnown: true,
    pinnedRecipient: MERCHANT_WALLET,
    walletAllowanceRemainingMinor: toMinor("25.00"),
    now: NOW,
    ...overrides,
  };
}
