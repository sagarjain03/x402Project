// OWNER: CORE. Five tables. Money is bigint minor units (USDC 6dp: $0.05 => 50000n).
// Deferred normalisation is deliberate — see ../README.md "Growing the schema".
import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { PolicyRules, Reason, RiskSignal } from "@/shared/types";

export const agentStatusEnum = pgEnum("agent_status", ["ACTIVE", "FROZEN"]);
export const decisionEnum = pgEnum("guard_decision", ["ALLOW", "HOLD", "BLOCK"]);
export const intentStateEnum = pgEnum("intent_state", [
  "EVALUATING",
  "BLOCKED",
  "HELD",
  "RESERVED",
  "SIGNING",
  "SETTLING",
  "SETTLED",
  "FAILED",
  "EXPIRED",
]);
export const ledgerEntryEnum = pgEnum("ledger_entry_type", ["RESERVE", "COMMIT", "RELEASE"]);
export const approvalStateEnum = pgEnum("approval_state", ["NONE", "PENDING", "APPROVED", "REJECTED", "EXPIRED"]);

// ---------------------------------------------------------------------------
// agents — the spender. Wallet columns are inlined because rule 10 reads the
// allowance on every evaluation, and a join there is pure overhead.
// ---------------------------------------------------------------------------

export const agents = pgTable(
  "agents",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    status: agentStatusEnum("status").notNull().default("ACTIVE"),
    apiKeyHash: text("api_key_hash").notNull(),
    activePolicyId: text("active_policy_id"),

    walletAddress: text("wallet_address"),
    walletNetwork: text("wallet_network").notNull().default("algorand-testnet"),
    // drizzle-kit JSON.stringify's the snapshot, so bigint defaults must be written as SQL.
    walletAllowanceCapMinor: bigint("wallet_allowance_cap_minor", { mode: "bigint" }).notNull().default(sql`0`),
    walletFundedMinor: bigint("wallet_funded_minor", { mode: "bigint" }).notNull().default(sql`0`),

    frozenAt: timestamp("frozen_at", { withTimezone: true }),
    frozenReason: text("frozen_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("agents_name_unique").on(t.name),
    uniqueIndex("agents_api_key_hash_unique").on(t.apiKeyHash),
  ],
);

// ---------------------------------------------------------------------------
// policies — immutable versions. Editing creates v+1, never mutates v.
// The merchant allowlist lives in `rules`, so changing it is a versioned,
// auditable policy change rather than an untracked row edit.
// ---------------------------------------------------------------------------

export const policies = pgTable(
  "policies",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    isActive: boolean("is_active").notNull().default(false),

    // Hot rules as typed columns so the engine reads them without parsing JSON.
    maxPerTransactionMinor: bigint("max_per_transaction_minor", { mode: "bigint" }).notNull(),
    hourlyBudgetMinor: bigint("hourly_budget_minor", { mode: "bigint" }).notNull(),
    dailyBudgetMinor: bigint("daily_budget_minor", { mode: "bigint" }).notNull(),
    monthlyBudgetMinor: bigint("monthly_budget_minor", { mode: "bigint" }).notNull(),
    maxTxPerMinute: integer("max_tx_per_minute").notNull(),
    maxTxPerHour: integer("max_tx_per_hour").notNull(),

    rules: jsonb("rules").$type<PolicyRules>().notNull(),

    createdByEmail: text("created_by_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("policies_agent_version_unique").on(t.agentId, t.version),
    index("policies_active_idx").on(t.agentId, t.isActive),
  ],
);

// ---------------------------------------------------------------------------
// payment_intents — the attempt, the decision and the outcome in one row.
// Refused payments exist ONLY here; the blockchain never saw them.
// ---------------------------------------------------------------------------

export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),

    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    asset: text("asset").notNull(),
    network: text("network").notNull(),
    recipient: text("recipient").notNull(),
    merchantDomain: text("merchant_domain").notNull(),
    resource: text("resource").notNull(),
    reason: text("reason"),

    nonce: text("nonce").notNull(),
    // Binds the signer to these exact fields, so a swap after ALLOW cannot be signed.
    intentHash: text("intent_hash").notNull(),
    idempotencyKey: text("idempotency_key"),
    state: intentStateEnum("state").notNull().default("EVALUATING"),

    // The decision. Latest wins; every decision is also an audit event.
    decision: decisionEnum("decision"),
    policyVersion: integer("policy_version"),
    reasons: jsonb("reasons").$type<Reason[]>(),
    matchedRules: jsonb("matched_rules").$type<string[]>(),
    riskScore: integer("risk_score").notNull().default(0),
    riskSignals: jsonb("risk_signals").$type<RiskSignal[]>(),
    latencyMs: integer("latency_ms"),

    // Human review, only used when the decision was HOLD.
    approvalStatus: approvalStateEnum("approval_status").notNull().default("NONE"),
    approvalReviewerEmail: text("approval_reviewer_email"),
    approvalNote: text("approval_note"),
    approvalExpiresAt: timestamp("approval_expires_at", { withTimezone: true }),
    approvalActionedAt: timestamp("approval_actioned_at", { withTimezone: true }),

    // Settlement. txHash stays NULL for every blocked payment.
    txHash: text("tx_hash"),
    settlementResponse: jsonb("settlement_response"),
    failureReason: text("failure_reason"),
    settledAt: timestamp("settled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("intents_agent_created_idx").on(t.agentId, t.createdAt),
    index("intents_state_idx").on(t.state),
    index("intents_decision_created_idx").on(t.decision, t.createdAt),
    index("intents_tx_hash_idx").on(t.txHash),
    index("intents_approval_idx").on(t.approvalStatus, t.approvalExpiresAt),
    uniqueIndex("intents_idempotency_unique").on(t.agentId, t.idempotencyKey),
  ],
);

// ---------------------------------------------------------------------------
// budget_ledger — append only.
//   spent    = SUM(COMMIT)
//   reserved = SUM(RESERVE) - SUM(COMMIT) - SUM(RELEASE)
// Writes happen under pg_advisory_xact_lock(agent) so concurrent payments
// cannot both pass the same admission check.
// ---------------------------------------------------------------------------

export const budgetLedger = pgTable(
  "budget_ledger",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    intentId: text("intent_id").references(() => paymentIntents.id, { onDelete: "cascade" }),
    reservationId: text("reservation_id").notNull(),

    entryType: ledgerEntryEnum("entry_type").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),

    // Text window keys keep a sliding sum an indexed equality lookup.
    windowHour: text("window_hour").notNull(),
    windowDay: text("window_day").notNull(),
    windowMonth: text("window_month").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ledger_agent_day_idx").on(t.agentId, t.windowDay),
    index("ledger_agent_hour_idx").on(t.agentId, t.windowHour),
    index("ledger_agent_month_idx").on(t.agentId, t.windowMonth),
    index("ledger_reservation_idx").on(t.reservationId),
    index("ledger_expiry_idx").on(t.expiresAt),
  ],
);

// ---------------------------------------------------------------------------
// audit_logs — append only, hash chained. Also the history for everything the
// 5-table schema keeps in a single row, which is what makes deferring the
// evaluations/approvals/payments tables safe.
// ---------------------------------------------------------------------------

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id"),
    intentId: text("intent_id"),
    eventType: text("event_type").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload").notNull(),
    prevHash: text("prev_hash").notNull(),
    rowHash: text("row_hash").notNull(),
    seq: bigint("seq", { mode: "bigint" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("audit_seq_unique").on(t.seq),
    index("audit_created_idx").on(t.createdAt),
    index("audit_intent_idx").on(t.intentId),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const agentsRelations = relations(agents, ({ many }) => ({
  policies: many(policies),
  intents: many(paymentIntents),
  ledgerEntries: many(budgetLedger),
}));

export const policiesRelations = relations(policies, ({ one }) => ({
  agent: one(agents, { fields: [policies.agentId], references: [agents.id] }),
}));

export const paymentIntentsRelations = relations(paymentIntents, ({ one, many }) => ({
  agent: one(agents, { fields: [paymentIntents.agentId], references: [agents.id] }),
  ledgerEntries: many(budgetLedger),
}));

export const budgetLedgerRelations = relations(budgetLedger, ({ one }) => ({
  agent: one(agents, { fields: [budgetLedger.agentId], references: [agents.id] }),
  intent: one(paymentIntents, { fields: [budgetLedger.intentId], references: [paymentIntents.id] }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AgentRow = typeof agents.$inferSelect;
export type NewAgentRow = typeof agents.$inferInsert;
export type PolicyRow = typeof policies.$inferSelect;
export type NewPolicyRow = typeof policies.$inferInsert;
export type PaymentIntentRow = typeof paymentIntents.$inferSelect;
export type NewPaymentIntentRow = typeof paymentIntents.$inferInsert;
export type BudgetLedgerRow = typeof budgetLedger.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
