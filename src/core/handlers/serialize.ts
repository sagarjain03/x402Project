// OWNER: CORE. Row -> wire shape. Money leaves as a decimal string, never a bigint (which will not
// serialise) and never a number (which loses minor units). The UI renders these strings directly.
import type { AgentRow, AuditLogRow, BudgetLedgerRow, PaymentIntentRow, PolicyRow } from "@/core/db/schema";
import { toUsd } from "@/shared/money";
import { explorerTxUrl } from "@/shared/explorer";

/** Kept as a named export because handlers import it; the rail table lives in @/shared/explorer. */
export function explorerUrl(network: string, txHash: string | null): string | null {
  return explorerTxUrl(network, txHash);
}

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

export function toAgentDto(row: AgentRow) {
  return {
    agentId: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    activePolicyId: row.activePolicyId,
    wallet: {
      address: row.walletAddress,
      network: row.walletNetwork,
      allowanceCapUsd: toUsd(row.walletAllowanceCapMinor),
      fundedUsd: toUsd(row.walletFundedMinor),
    },
    frozenAt: iso(row.frozenAt),
    frozenReason: row.frozenReason,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toIntentDto(row: PaymentIntentRow) {
  return {
    intentId: row.id,
    agentId: row.agentId,
    amountUsd: toUsd(row.amountMinor),
    asset: row.asset,
    network: row.network,
    recipient: row.recipient,
    merchant: row.merchantDomain,
    resource: row.resource,
    reason: row.reason,
    state: row.state,
    decision: row.decision,
    policyVersion: row.policyVersion,
    reasons: row.reasons ?? [],
    matchedRules: row.matchedRules ?? [],
    riskScore: row.riskScore,
    riskSignals: row.riskSignals ?? [],
    latencyMs: row.latencyMs,
    approval: {
      status: row.approvalStatus,
      reviewerEmail: row.approvalReviewerEmail,
      note: row.approvalNote,
      expiresAt: iso(row.approvalExpiresAt),
      actionedAt: iso(row.approvalActionedAt),
    },
    settlement: {
      // Null on every blocked payment, which is the claim the whole product is judged on.
      txHash: row.txHash,
      explorerUrl: explorerUrl(row.network, row.txHash),
      settledAt: iso(row.settledAt),
      failureReason: row.failureReason,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPolicyDto(row: PolicyRow) {
  return {
    policyId: row.id,
    agentId: row.agentId,
    version: row.version,
    isActive: row.isActive,
    rules: row.rules,
    createdByEmail: row.createdByEmail,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLedgerDto(row: BudgetLedgerRow) {
  return {
    ledgerId: row.id,
    reservationId: row.reservationId,
    intentId: row.intentId,
    entryType: row.entryType,
    amountUsd: toUsd(row.amountMinor),
    window: { hour: row.windowHour, day: row.windowDay, month: row.windowMonth },
    expiresAt: iso(row.expiresAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAuditDto(row: AuditLogRow) {
  return {
    auditId: row.id,
    seq: row.seq.toString(),
    agentId: row.agentId,
    intentId: row.intentId,
    eventType: row.eventType,
    actor: row.actor,
    payload: row.payload,
    prevHash: row.prevHash,
    rowHash: row.rowHash,
    createdAt: row.createdAt.toISOString(),
  };
}
