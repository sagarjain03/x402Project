// OWNER: CORE. The only place outside budget/ledger.ts that touches the database.
// Handlers call these; they never import getDb() directly. That keeps a future
// change like adding multi-tenancy to one file instead of twenty-six.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { hashAgentId } from "@/core/budget/ledger";
import { windowKeys } from "@/core/budget/windows";
import { getDb, schema } from "@/core/db";
import type {
  AgentRow,
  AuditLogRow,
  BudgetLedgerRow,
  NewAgentRow,
  NewPaymentIntentRow,
  PaymentIntentRow,
  PolicyRow,
} from "@/core/db/schema";
import { newId } from "@/shared/ids";
import { toMinor } from "@/shared/money";
import type { EvaluationResult, PolicyRules, SpendCounters } from "@/shared/types";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** PAY's 202 response assumes this window, so the two have to agree. See their blocker B8. */
export const APPROVAL_WINDOW_MS = 15 * 60_000;

// Aggregates come back from the driver as strings so a bigint never loses precision on the way out.
const toMinorUnits = (value: unknown): bigint => BigInt(String(value ?? "0"));
const toCount = (value: unknown): number => Number(value ?? 0);

// --- agents ---------------------------------------------------------------

export async function getAgentByApiKeyHash(hash: string): Promise<AgentRow | null> {
  const [agent] = await getDb().select().from(schema.agents).where(eq(schema.agents.apiKeyHash, hash)).limit(1);
  return agent ?? null;
}

export async function getAgentById(agentId: string): Promise<AgentRow | null> {
  const [agent] = await getDb().select().from(schema.agents).where(eq(schema.agents.id, agentId)).limit(1);
  return agent ?? null;
}

export async function listAgents(): Promise<AgentRow[]> {
  return getDb().select().from(schema.agents).orderBy(asc(schema.agents.name));
}

/** Names are unique in the schema; checked here so the caller gets a field error, not a 500. */
export async function agentNameTaken(name: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: schema.agents.id })
    .from(schema.agents)
    .where(eq(schema.agents.name, name))
    .limit(1);
  return Boolean(row);
}

export async function createAgent(input: NewAgentRow): Promise<AgentRow> {
  const [agent] = await getDb().insert(schema.agents).values(input).returning();
  return agent;
}

export async function setAgentStatus(agentId: string, status: "ACTIVE" | "FROZEN", reason?: string): Promise<void> {
  await getDb()
    .update(schema.agents)
    .set({
      status,
      frozenAt: status === "FROZEN" ? new Date() : null,
      frozenReason: status === "FROZEN" ? (reason ?? null) : null,
    })
    .where(eq(schema.agents.id, agentId));
}

/** Returns the new plaintext once. Only its hash is ever stored. */
export async function rotateAgentKey(agentId: string, hash: string): Promise<void> {
  await getDb().update(schema.agents).set({ apiKeyHash: hash }).where(eq(schema.agents.id, agentId));
}

// --- policies -------------------------------------------------------------

export async function getActivePolicy(agentId: string): Promise<PolicyRow | null> {
  const [policy] = await getDb()
    .select()
    .from(schema.policies)
    .where(and(eq(schema.policies.agentId, agentId), eq(schema.policies.isActive, true)))
    .orderBy(desc(schema.policies.version))
    .limit(1);
  return policy ?? null;
}

export async function listPolicyVersions(agentId: string): Promise<PolicyRow[]> {
  return getDb()
    .select()
    .from(schema.policies)
    .where(eq(schema.policies.agentId, agentId))
    .orderBy(desc(schema.policies.version));
}

/** Creates version n+1 and flips is_active in one transaction. Never mutates a version. */
export async function createPolicyVersion(
  agentId: string,
  rules: PolicyRules,
  byEmail?: string,
): Promise<PolicyRow> {
  return getDb().transaction(async (tx) => {
    // Serialised per agent, so two concurrent edits cannot both claim the same version number.
    await tx.execute(sql`select pg_advisory_xact_lock(${hashAgentId(agentId)})`);

    const [latest] = await tx
      .select({ version: schema.policies.version })
      .from(schema.policies)
      .where(eq(schema.policies.agentId, agentId))
      .orderBy(desc(schema.policies.version))
      .limit(1);

    await tx.update(schema.policies).set({ isActive: false }).where(eq(schema.policies.agentId, agentId));

    const [created] = await tx
      .insert(schema.policies)
      .values({
        id: newId("policy"),
        agentId,
        version: (latest?.version ?? 0) + 1,
        isActive: true,
        // The typed columns are what the ledger reads, so they are derived here rather than passed in.
        maxPerTransactionMinor: toMinor(rules.financial.maxPerTransactionUsd),
        hourlyBudgetMinor: toMinor(rules.financial.hourlyBudgetUsd),
        dailyBudgetMinor: toMinor(rules.financial.dailyBudgetUsd),
        monthlyBudgetMinor: toMinor(rules.financial.monthlyBudgetUsd),
        maxTxPerMinute: rules.velocity.maxTxPerMinute,
        maxTxPerHour: rules.velocity.maxTxPerHour,
        rules,
        createdByEmail: byEmail ?? null,
      })
      .returning();

    await tx.update(schema.agents).set({ activePolicyId: created.id }).where(eq(schema.agents.id, agentId));
    return created;
  });
}

// --- intents --------------------------------------------------------------

/** Idempotent on the primary key: a retried evaluation must not create a second attempt row. */
export async function insertIntent(input: NewPaymentIntentRow): Promise<PaymentIntentRow> {
  const [inserted] = await getDb()
    .insert(schema.paymentIntents)
    .values(input)
    .onConflictDoNothing({ target: schema.paymentIntents.id })
    .returning();
  if (inserted) return inserted;

  const existing = await getIntentById(String(input.id));
  if (!existing) throw new Error(`insertIntent could not read back intent ${input.id}`);
  return existing;
}

/** Writes the decision onto the intent. Must happen before anything is signed. */
export async function recordDecision(intentId: string, result: EvaluationResult): Promise<void> {
  const heldUntil = new Date(Date.now() + APPROVAL_WINDOW_MS);

  await getDb()
    .update(schema.paymentIntents)
    .set({
      decision: result.decision,
      policyVersion: result.policyVersion,
      reasons: result.reasons,
      matchedRules: result.matchedRules,
      riskScore: result.riskScore,
      riskSignals: result.riskSignals,
      latencyMs: result.latencyMs,
      // ALLOW keeps the intent in EVALUATING: the ledger and the signer move it on from there.
      ...(result.decision === "BLOCK" ? { state: "BLOCKED" as const } : {}),
      ...(result.decision === "HOLD"
        ? { state: "HELD" as const, approvalStatus: "PENDING" as const, approvalExpiresAt: heldUntil }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.paymentIntents.id, intentId));
}

export async function setIntentState(intentId: string, state: PaymentIntentRow["state"]): Promise<void> {
  await getDb()
    .update(schema.paymentIntents)
    .set({ state, updatedAt: new Date() })
    .where(eq(schema.paymentIntents.id, intentId));
}

/** commitBudget already stamps tx_hash and state; this adds the decoded PAYMENT-RESPONSE body. */
export async function recordSettlement(intentId: string, txHash: string, raw: unknown): Promise<void> {
  await getDb()
    .update(schema.paymentIntents)
    .set({
      txHash,
      settlementResponse: raw,
      state: "SETTLED",
      settledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.paymentIntents.id, intentId));
}

export async function recordFailure(intentId: string, failureReason: string): Promise<void> {
  await getDb()
    .update(schema.paymentIntents)
    .set({ state: "FAILED", failureReason, updatedAt: new Date() })
    .where(eq(schema.paymentIntents.id, intentId));
}

export async function listLedgerForIntent(intentId: string): Promise<BudgetLedgerRow[]> {
  return getDb()
    .select()
    .from(schema.budgetLedger)
    .where(eq(schema.budgetLedger.intentId, intentId))
    .orderBy(asc(schema.budgetLedger.createdAt));
}

export interface AuditFilters {
  agentId?: string;
  intentId?: string;
  limit?: number;
}

export async function listAuditLogs(filters: AuditFilters): Promise<AuditLogRow[]> {
  const conditions = [];
  if (filters.agentId) conditions.push(eq(schema.auditLogs.agentId, filters.agentId));
  if (filters.intentId) conditions.push(eq(schema.auditLogs.intentId, filters.intentId));

  return getDb()
    .select()
    .from(schema.auditLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.auditLogs.seq))
    .limit(Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE)));
}

export async function getIntentById(intentId: string): Promise<PaymentIntentRow | null> {
  const [intent] = await getDb()
    .select()
    .from(schema.paymentIntents)
    .where(eq(schema.paymentIntents.id, intentId))
    .limit(1);
  return intent ?? null;
}

export async function findByIdempotencyKey(agentId: string, key: string): Promise<PaymentIntentRow | null> {
  const [intent] = await getDb()
    .select()
    .from(schema.paymentIntents)
    .where(and(eq(schema.paymentIntents.agentId, agentId), eq(schema.paymentIntents.idempotencyKey, key)))
    .limit(1);
  return intent ?? null;
}

export interface IntentFilters {
  agentId?: string;
  decision?: "ALLOW" | "HOLD" | "BLOCK";
  merchantDomain?: string;
  limit?: number;
  cursor?: string;
}

export async function listIntents(filters: IntentFilters): Promise<PaymentIntentRow[]> {
  const conditions = [];
  if (filters.agentId) conditions.push(eq(schema.paymentIntents.agentId, filters.agentId));
  if (filters.decision) conditions.push(eq(schema.paymentIntents.decision, filters.decision));
  if (filters.merchantDomain) conditions.push(eq(schema.paymentIntents.merchantDomain, filters.merchantDomain));

  // Keyset on (created_at, id), not on the id alone: a ULID sorts by generation time, which is not
  // the same as created_at once a row carries a backdated timestamp — as every seeded row does.
  // An unknown cursor makes the subquery NULL and returns an empty page rather than the first one.
  if (filters.cursor) {
    conditions.push(sql`(${schema.paymentIntents.createdAt}, ${schema.paymentIntents.id})
      < (select created_at, id from payment_intents where id = ${filters.cursor})`);
  }

  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? DEFAULT_PAGE_SIZE));

  return getDb()
    .select()
    .from(schema.paymentIntents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.paymentIntents.createdAt), desc(schema.paymentIntents.id))
    .limit(limit);
}

// --- counters (the engine's inputs) --------------------------------------

/** Ledger sums + velocity counts + risk inputs, in as few round trips as possible. */
export async function getSpendCounters(
  agentId: string,
  merchantDomain: string,
  now: Date,
): Promise<SpendCounters> {
  const db = getDb();
  const keys = windowKeys(now);
  // A raw sql`` parameter reaches the driver unserialised, so timestamps cross as ISO text and are
  // cast on the Postgres side. Passing the Date itself throws inside postgres-js.
  const at = (msAgo: number): string => new Date(now.getTime() - msAgo).toISOString();
  const nowIso = now.toISOString();
  const minuteAgo = at(60_000);
  const hourAgo = at(60 * 60_000);
  const fiveMinutesAgo = at(5 * 60_000);
  const dayAgo = at(24 * 60 * 60_000);

  // Two round trips, not ten: FILTER lets one pass over each table answer every question about it.
  const [ledgerRows, intentRows] = await Promise.all([
    db.execute(sql`
      select
        coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT' and window_hour = ${keys.hour}), 0)::text as hour_spent,
        coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT' and window_day = ${keys.day}), 0)::text as day_spent,
        coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT' and window_month = ${keys.month}), 0)::text as month_spent,
        (coalesce(sum(amount_minor) filter (where entry_type = 'RESERVE'), 0)
          - coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT'), 0)
          - coalesce(sum(amount_minor) filter (where entry_type = 'RELEASE'), 0))::text as reserved
      from budget_ledger
      where agent_id = ${agentId}
    `),
    db.execute(sql`
      select
        count(*) filter (where decision in ('ALLOW','HOLD') and created_at >= ${minuteAgo}::timestamptz)::int as tx_last_minute,
        count(*) filter (where decision in ('ALLOW','HOLD') and created_at >= ${hourAgo}::timestamptz)::int as tx_last_hour,
        count(*) filter (where decision in ('ALLOW','HOLD') and created_at >= ${minuteAgo}::timestamptz
                          and merchant_domain = ${merchantDomain})::int as tx_last_minute_for_merchant,
        count(*) filter (where decision = 'BLOCK' and created_at >= ${fiveMinutesAgo}::timestamptz)::int as blocked_attempts,
        count(*) filter (where decision in ('ALLOW','HOLD'))::int as payments_ever,
        coalesce(percentile_disc(0.5) within group (order by amount_minor)
          filter (where decision in ('ALLOW','HOLD') and created_at >= ${dayAgo}::timestamptz), 0)::text as median_24h
      from payment_intents
      where agent_id = ${agentId} and created_at <= ${nowIso}::timestamptz
    `),
  ]);

  const ledger = (ledgerRows as unknown as Record<string, unknown>[])[0] ?? {};
  const intents = (intentRows as unknown as Record<string, unknown>[])[0] ?? {};

  return {
    hourSpentMinor: toMinorUnits(ledger.hour_spent),
    daySpentMinor: toMinorUnits(ledger.day_spent),
    monthSpentMinor: toMinorUnits(ledger.month_spent),
    // Committed and released reservations net to zero, so an all-time sum leaves only live ones.
    reservedMinor: toMinorUnits(ledger.reserved),
    txLastMinute: toCount(intents.tx_last_minute),
    txLastHour: toCount(intents.tx_last_hour),
    txLastMinuteForMerchant: toCount(intents.tx_last_minute_for_merchant),
    blockedAttemptsLast5Min: toCount(intents.blocked_attempts),
    medianAmountMinor24h: toMinorUnits(intents.median_24h),
    isFirstPayment: toCount(intents.payments_ever) === 0,
  };
}

// --- approvals ------------------------------------------------------------

export async function listPendingApprovals(): Promise<PaymentIntentRow[]> {
  return getDb()
    .select()
    .from(schema.paymentIntents)
    .where(eq(schema.paymentIntents.approvalStatus, "PENDING"))
    // Oldest first: it is a queue, and the one closest to expiring is the one to action.
    .orderBy(asc(schema.paymentIntents.createdAt));
}

export async function actionApproval(
  intentId: string,
  status: "APPROVED" | "REJECTED" | "EXPIRED",
  reviewerEmail?: string,
  note?: string,
): Promise<void> {
  await getDb()
    .update(schema.paymentIntents)
    .set({
      approvalStatus: status,
      approvalReviewerEmail: reviewerEmail ?? null,
      approvalNote: note ?? null,
      approvalActionedAt: new Date(),
      // An approval does not move money — it only returns the intent to the flow, or ends it.
      state: status === "APPROVED" ? "EVALUATING" : "BLOCKED",
      updatedAt: new Date(),
    })
    .where(eq(schema.paymentIntents.id, intentId));
}

// --- metrics --------------------------------------------------------------

export interface MetricsSummary {
  decisions: { allow: number; hold: number; block: number };
  spentMinor: bigint;
  blockedMinor: bigint;
  onChainTxCount: number;
  blockedOnChainTxCount: number;
  topBlockReasons: { code: string; count: number }[];
  p95GuardLatencyMs: number;
}

export async function getMetricsSummary(windowHours: number): Promise<MetricsSummary> {
  const db = getDb();
  const since = new Date(Date.now() - windowHours * 60 * 60_000).toISOString();

  const [totalRows, reasonRows] = await Promise.all([
    db.execute(sql`
      select
        count(*) filter (where decision = 'ALLOW')::int as allow_count,
        count(*) filter (where decision = 'HOLD')::int as hold_count,
        count(*) filter (where decision = 'BLOCK')::int as block_count,
        coalesce(sum(amount_minor) filter (where state = 'SETTLED'), 0)::text as spent,
        coalesce(sum(amount_minor) filter (where decision = 'BLOCK'), 0)::text as blocked,
        count(*) filter (where tx_hash is not null)::int as on_chain,
        -- The headline claim: a blocked payment must never have reached the chain.
        count(*) filter (where decision = 'BLOCK' and tx_hash is not null)::int as blocked_on_chain,
        coalesce(percentile_disc(0.95) within group (order by latency_ms)
          filter (where latency_ms is not null), 0)::int as p95_latency
      from payment_intents
      where created_at >= ${since}::timestamptz
    `),
    db.execute(sql`
      -- Aliased as block_reason(entry), because a bare "reason" would bind to the intent's own
      -- text column instead of the unnested element, and ->> would fail on text.
      select block_reason.entry->>'code' as code, count(*)::int as count
      from payment_intents, jsonb_array_elements(coalesce(reasons, '[]'::jsonb)) as block_reason(entry)
      where decision = 'BLOCK' and created_at >= ${since}::timestamptz
      group by 1
      order by count desc, code asc
      limit 5
    `),
  ]);

  const totals = (totalRows as unknown as Record<string, unknown>[])[0] ?? {};
  const reasons = reasonRows as unknown as Record<string, unknown>[];

  return {
    decisions: {
      allow: toCount(totals.allow_count),
      hold: toCount(totals.hold_count),
      block: toCount(totals.block_count),
    },
    spentMinor: toMinorUnits(totals.spent),
    blockedMinor: toMinorUnits(totals.blocked),
    onChainTxCount: toCount(totals.on_chain),
    blockedOnChainTxCount: toCount(totals.blocked_on_chain),
    topBlockReasons: reasons.map((row) => ({ code: String(row.code), count: toCount(row.count) })),
    p95GuardLatencyMs: toCount(totals.p95_latency),
  };
}
