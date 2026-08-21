/**
 * OWNER: CORE (frozen contract - see src/shared/README.md)
 * WHAT: The shared vocabulary of the whole system. Every division imports this.
 * DOCS: API_DOCS.md section 3, ARCHITECTURE.md section 10
 */

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export type Decision = "ALLOW" | "HOLD" | "BLOCK";

export type IntentState =
  | "EVALUATING"
  | "BLOCKED"
  | "HELD"
  | "RESERVED"
  | "SIGNING"
  | "SETTLING"
  | "SETTLED"
  | "FAILED"
  | "EXPIRED";

// ---------------------------------------------------------------------------
// Payment intent - what the Guard actually judges
// ---------------------------------------------------------------------------

export interface PaymentIntent {
  intentId: string;
  agentId: string;
  /** USDC minor units. $0.05 => 50000n. Never a float. */
  amountMinor: bigint;
  asset: string;                 // "USDC"
  network: string;               // CAIP-2, exactly as quoted on the wire
  recipient: string;             // payTo from PAYMENT-REQUIRED. EVM hex or Algorand base32.
  merchant: string;              // hostname, the allowlist key
  resource: string;              // "POST /api/sandbox/search"
  reason?: string;               // the "WHY" dimension, from X-Guard-Reason
  nonce: string;
  intentHash: string;            // binds the signer to these exact fields
  state: IntentState;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Evaluation result - what the policy engine returns
// ---------------------------------------------------------------------------

export interface Reason {
  code: string;                  // see shared/errors.ts
  rule: string;                  // "financial.maxPerTransactionUsd"
  message: string;
  observed?: string;
  expected?: string | string[];
}

export interface RiskSignal {
  signal: string;
  points: number;
}

export interface EvaluationResult {
  decision: Decision;
  /**
   * The intent row this decision was recorded against. Differs from the intent the caller built
   * only when a human-approved payment was resumed: the settlement then lands on the row the
   * reviewer actually approved, instead of on a fresh copy of it.
   */
  intentId?: string;
  reasons: Reason[];
  riskScore: number;             // 0-100
  riskSignals: RiskSignal[];
  matchedRules: string[];
  policyVersion: number;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Evaluation context - everything the pure engine needs, injected by the caller
// ---------------------------------------------------------------------------

export interface SpendCounters {
  hourSpentMinor: bigint;
  daySpentMinor: bigint;
  monthSpentMinor: bigint;
  reservedMinor: bigint;
  txLastMinute: number;
  txLastHour: number;
  txLastMinuteForMerchant: number;
  blockedAttemptsLast5Min: number;
  medianAmountMinor24h: bigint;
  isFirstPayment: boolean;
}

export interface EvaluationContext {
  intent: PaymentIntent;
  policy: Policy;
  counters: SpendCounters;
  agentStatus: AgentStatus;
  merchantKnown: boolean;
  pinnedRecipient?: string;
  walletAllowanceRemainingMinor: bigint;
  /**
   * A human has already reviewed this exact payment and approved it. Suppresses HOLD only —
   * every blocking rule is still evaluated, because an approval is permission, not a bypass.
   */
  approvalGranted?: boolean;
  /** Injected, never read from Date.now() inside the engine. Keeps it deterministic. */
  now: Date;
}

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export type AgentStatus = "ACTIVE" | "FROZEN";
export type UnknownMerchantAction = "BLOCK" | "HOLD";

export interface PolicyRules {
  financial: {
    maxPerTransactionUsd: string;
    hourlyBudgetUsd: string;
    dailyBudgetUsd: string;
    monthlyBudgetUsd: string;
  };
  merchant: {
    allowedMerchants: string[];
    blockedMerchants: string[];
    /** domain -> expected payTo. A mismatch is a BLOCK, not a warning (rule 5). */
    pinnedRecipients: Record<string, string>;
    unknownMerchantAction: UnknownMerchantAction;
    enforceRecipientPinning: boolean;
  };
  velocity: {
    maxTxPerMinute: number;
    maxTxPerHour: number;
    maxTxPerMerchantPerMinute: number;
  };
  rail: {
    allowedNetworks: string[];
    allowedAssets: string[];
  };
  risk: {
    autoApproveBelowUsd: string;
    holdBetweenUsd: [string, string];
    blockAboveUsd: string;
    riskHoldScore: number;
    riskBlockScore: number;
  };
}

export interface Policy {
  policyId: string;
  agentId: string;
  version: number;
  isActive: boolean;
  rules: PolicyRules;
  createdByEmail?: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Budget ledger
// ---------------------------------------------------------------------------

export type LedgerEntryType = "RESERVE" | "COMMIT" | "RELEASE";

export interface Reservation {
  reservationId: string;
  intentId: string;
  amountMinor: bigint;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export interface SettlementResult {
  txHash: string;                // EVM 0x-hash or Algorand base32 transaction id.
  settledAt: Date;
  raw: unknown;                  // the decoded PAYMENT-RESPONSE payload
}

