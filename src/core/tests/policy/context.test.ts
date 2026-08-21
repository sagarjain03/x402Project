// OWNER: CORE. evaluatePayment does the I/O the engine refuses to do. What matters here is not the
// decision — engine.test.ts covers that — but that it is recorded before it returns, and that every
// failure path is a BLOCK. Needs a real Postgres.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ALGORAND_TESTNET_NETWORK_ID, ALGORAND_TESTNET_USDC_ASA } from "@/shared/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { verifyChain } from "@/core/audit/chain";
import { subscribe } from "@/core/audit/events";
import { getDb, schema } from "@/core/db";
import { actionApproval } from "@/core/db/queries";
import { evaluatePayment } from "@/core/policy/context";
import { newId } from "@/shared/ids";
import { toMinor } from "@/shared/money";
import type { PaymentIntent } from "@/shared/types";
import { MERCHANT_WALLET, ROGUE_WALLET, SANDBOX, makePolicyRules } from "@/core/tests/fixtures";

try { process.loadEnvFile(".env.local"); } catch { /* CI supplies DATABASE_URL directly */ }

const hasDatabase = Boolean(process.env.DATABASE_URL);
const agentId = newId("agent");

function makeIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  const intentId = newId("intent");
  return {
    intentId,
    agentId,
    amountMinor: toMinor("0.02"),
    asset: ALGORAND_TESTNET_USDC_ASA,
    network: ALGORAND_TESTNET_NETWORK_ID,
    recipient: MERCHANT_WALLET,
    merchant: SANDBOX,
    resource: "POST /api/sandbox/search",
    reason: "context test",
    nonce: `nonce_${intentId}`,
    intentHash: intentId.slice(-8).padStart(64, "0"),
    state: "EVALUATING",
    createdAt: new Date(),
    ...overrides,
  };
}

async function auditRowsFor(intentId: string) {
  return (await getDb().execute(sql`
    select event_type, actor, payload, row_hash from audit_logs where intent_id = ${intentId} order by seq asc
  `)) as unknown as Record<string, unknown>[];
}

async function intentRow(intentId: string) {
  const [row] = (await getDb().execute(sql`
    select decision, state, risk_score, latency_ms, reasons, approval_status
    from payment_intents where id = ${intentId}
  `)) as unknown as Record<string, unknown>[];
  return row;
}

describe.skipIf(!hasDatabase)("evaluatePayment", () => {
  beforeAll(async () => {
    await getDb().insert(schema.agents).values({
      id: agentId,
      name: `ContextBot ${agentId}`,
      status: "ACTIVE",
      apiKeyHash: `hash_${agentId}`,
      walletAllowanceCapMinor: toMinor("25.00"),
      walletFundedMinor: toMinor("10.00"),
    });
    await getDb().insert(schema.policies).values({
      id: newId("policy"),
      agentId,
      version: 1,
      isActive: true,
      maxPerTransactionMinor: toMinor("1.00"),
      hourlyBudgetMinor: toMinor("1.00"),
      dailyBudgetMinor: toMinor("5.00"),
      monthlyBudgetMinor: toMinor("50.00"),
      maxTxPerMinute: 10,
      maxTxPerHour: 100,
      rules: makePolicyRules(),
    });
  });

  afterAll(async () => {
    // Audit rows are deliberately left behind: deleting them would break the hash chain.
    await getDb().execute(sql`delete from agents where id = ${agentId}`);
  });

  it("ALLOWs a clean payment and records it", async () => {
    const intent = makeIntent();
    const result = await evaluatePayment({ intent });

    expect(result.decision).toBe("ALLOW");
    expect(result.reasons).toEqual([]);
    expect(result.policyVersion).toBe(1);

    const row = await intentRow(intent.intentId);
    expect(row.decision).toBe("ALLOW");
    // ALLOW leaves the intent mid-flight: the ledger and the signer move it on from here.
    expect(row.state).toBe("EVALUATING");
  });

  it("writes the audit row BEFORE it returns", async () => {
    const intent = makeIntent();
    await evaluatePayment({ intent });

    // No polling and no waiting — if the row is not already there, the ordering guarantee is broken.
    const rows = await auditRowsFor(intent.intentId);
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe("DECISION");
    expect((rows[0].payload as { decision: string }).decision).toBe("ALLOW");
  });

  it("BLOCKs over the per-transaction limit and marks the intent BLOCKED", async () => {
    const intent = makeIntent({ amountMinor: toMinor("2.00") });
    const result = await evaluatePayment({ intent });

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("PER_TRANSACTION_LIMIT_EXCEEDED");

    const row = await intentRow(intent.intentId);
    expect(row.decision).toBe("BLOCK");
    expect(row.state).toBe("BLOCKED");
    expect(await auditRowsFor(intent.intentId)).toHaveLength(1);
  });

  it("BLOCKs a recipient that is not the pinned one", async () => {
    const result = await evaluatePayment({ intent: makeIntent({ recipient: ROGUE_WALLET }) });
    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("RECIPIENT_MISMATCH");
  });

  it("HOLDs an amount in the review band and opens an approval", async () => {
    const intent = makeIntent({ amountMinor: toMinor("0.45") });
    const result = await evaluatePayment({ intent });

    expect(result.decision).toBe("HOLD");
    const row = await intentRow(intent.intentId);
    expect(row.state).toBe("HELD");
    expect(row.approval_status).toBe("PENDING");
  });

  it("measures its own latency, which the pure engine cannot", async () => {
    const result = await evaluatePayment({ intent: makeIntent() });
    expect(result.latencyMs).toBeGreaterThan(0);
  });

  it("publishes the decision to the live event bus", async () => {
    const seen: unknown[] = [];
    const unsubscribe = subscribe((event, data) => {
      if (event === "decision") seen.push(data);
    });
    try {
      await evaluatePayment({ intent: makeIntent() });
      expect(seen).toHaveLength(1);
    } finally {
      unsubscribe();
    }
  });

  it("replays the stored decision for a repeated idempotency key", async () => {
    const key = `idem_${newId("intent")}`;
    const intent = makeIntent({ amountMinor: toMinor("2.00") });

    const first = await evaluatePayment({ intent, idempotencyKey: key });
    const second = await evaluatePayment({ intent: makeIntent({ ...intent }), idempotencyKey: key });

    expect(first.decision).toBe("BLOCK");
    expect(second.decision).toBe(first.decision);
    expect(second.reasons[0].code).toBe(first.reasons[0].code);
    // The replay must not have judged the payment a second time.
    expect(await auditRowsFor(intent.intentId)).toHaveLength(1);
  });

  it("refuses a reused idempotency key that carries a different body", async () => {
    const key = `idem_${newId("intent")}`;
    await evaluatePayment({ intent: makeIntent({ amountMinor: toMinor("0.02") }), idempotencyKey: key });

    // Varying a term, not the hash: intentHash carries a per-attempt nonce, so it differs on every
    // genuine retry too and cannot be what tells a retry apart from a swapped payment.
    const tampered = await evaluatePayment({
      intent: makeIntent({ amountMinor: toMinor("0.90") }),
      idempotencyKey: key,
    });
    expect(tampered.decision).toBe("BLOCK");
    expect(tampered.reasons[0].code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("leaves the audit chain verifiable after every write", async () => {
    const chain = await verifyChain();
    expect(chain.valid).toBe(true);
    expect(chain.rowsChecked).toBeGreaterThan(0);
  });

  describe("fail closed", () => {
    let healthy: typeof globalThis.__aspgDb;
    let broken: postgres.Sql | null = null;

    afterEach(async () => {
      globalThis.__aspgDb = healthy;
      await broken?.end({ timeout: 1 }).catch(() => {});
      broken = null;
    });

    it("BLOCKs when the database is unreachable, and never ALLOWs", async () => {
      healthy = globalThis.__aspgDb;
      // A port nothing is listening on is the closest thing to pulling the cable mid-evaluate.
      broken = postgres("postgresql://postgres:wrong@127.0.0.1:59999/nope", {
        max: 1,
        prepare: false,
        connect_timeout: 1,
        onnotice: () => {},
      });
      globalThis.__aspgDb = drizzle(broken, { schema });

      const result = await evaluatePayment({ intent: makeIntent() });

      expect(result.decision).toBe("BLOCK");
      expect(result.decision).not.toBe("ALLOW");
      expect(result.reasons[0].code).toBe("GUARD_UNAVAILABLE");
    }, 30_000);

    it("BLOCKs an agent with no active policy", async () => {
      healthy = globalThis.__aspgDb;
      const orphanId = newId("agent");
      await getDb().insert(schema.agents).values({
        id: orphanId,
        name: `OrphanBot ${orphanId}`,
        status: "ACTIVE",
        apiKeyHash: `hash_${orphanId}`,
      });

      const result = await evaluatePayment({ intent: makeIntent({ agentId: orphanId }) });
      expect(result.decision).toBe("BLOCK");
      expect(result.reasons[0].code).toBe("NO_ACTIVE_POLICY");

      await getDb().execute(sql`delete from agents where id = ${orphanId}`);
    });

    it("BLOCKs an intent whose agent does not exist at all", async () => {
      healthy = globalThis.__aspgDb;
      const result = await evaluatePayment({ intent: makeIntent({ agentId: newId("agent") }) });
      expect(result.decision).toBe("BLOCK");
    });
  });
});

// ---------------------------------------------------------------------------------------------
// D7: HOLD -> a human approves -> the agent retries -> the SAME intent settles.
// Its own agent id: these intents would otherwise count toward the velocity window the tests
// above share, and a resume test that trips rule 9 would be testing the wrong thing.
// ---------------------------------------------------------------------------------------------
describe.skipIf(!hasDatabase)("evaluatePayment · resume after approval", () => {
  const resumeAgentId = newId("agent");

  function heldIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
    // A fresh id, a fresh nonce and therefore a fresh intentHash on every call — exactly what the
    // gateway produces on a retry, and what made hash-based idempotency reject every genuine one.
    return makeIntent({ agentId: resumeAgentId, amountMinor: toMinor("0.50"), ...overrides });
  }

  beforeAll(async () => {
    await getDb().insert(schema.agents).values({
      id: resumeAgentId,
      name: `ResumeBot ${resumeAgentId}`,
      status: "ACTIVE",
      apiKeyHash: `hash_${resumeAgentId}`,
      walletAllowanceCapMinor: toMinor("25.00"),
      walletFundedMinor: toMinor("10.00"),
    });
    await getDb().insert(schema.policies).values({
      id: newId("policy"),
      agentId: resumeAgentId,
      version: 1,
      isActive: true,
      maxPerTransactionMinor: toMinor("1.00"),
      hourlyBudgetMinor: toMinor("1.00"),
      dailyBudgetMinor: toMinor("5.00"),
      monthlyBudgetMinor: toMinor("50.00"),
      maxTxPerMinute: 10,
      maxTxPerHour: 100,
      rules: makePolicyRules(),
    });
  });

  afterAll(async () => {
    await getDb().execute(sql`delete from agents where id = ${resumeAgentId}`);
  });

  it("settles the intent the reviewer approved, not a fresh copy of it", async () => {
    const first = heldIntent();
    const held = await evaluatePayment({ intent: first });
    expect(held.decision).toBe("HOLD");
    expect(held.intentId).toBe(first.intentId);

    await actionApproval(first.intentId, "APPROVED", "reviewer@test");

    // The agent retries with the id it was handed in the 202. Different intent object entirely.
    const retry = heldIntent({ reason: "resume after approval" });
    const resumed = await evaluatePayment({ intent: retry, idempotencyKey: first.intentId });

    expect(resumed.decision).toBe("ALLOW");
    expect(resumed.intentId).toBe(first.intentId);

    const row = await intentRow(first.intentId);
    expect(row.decision).toBe("ALLOW");
    // ALLOW leaves it mid-flight for the ledger and the signer; the approval is not undone.
    expect(row.state).toBe("EVALUATING");
    expect(row.approval_status).toBe("APPROVED");

    // The retry never became a second row — one approval, one payment, one record.
    expect(await intentRow(retry.intentId)).toBeUndefined();
  });

  it("refuses to resume when the merchant re-quotes a different price", async () => {
    const first = heldIntent();
    expect((await evaluatePayment({ intent: first })).decision).toBe("HOLD");
    await actionApproval(first.intentId, "APPROVED", "reviewer@test");

    // $0.50 was approved. $0.90 is a different payment, whatever the key says.
    const reQuoted = heldIntent({ amountMinor: toMinor("0.90") });
    const result = await evaluatePayment({ intent: reQuoted, idempotencyKey: first.intentId });

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("IDEMPOTENCY_CONFLICT");
    expect(await intentRow(first.intentId)).toMatchObject({ decision: "HOLD" });
  });

  it("replays a decision that is still awaiting review instead of queueing a second one", async () => {
    const first = heldIntent();
    await evaluatePayment({ intent: first });

    const retry = heldIntent();
    const replayed = await evaluatePayment({ intent: retry, idempotencyKey: first.intentId });

    expect(replayed.decision).toBe("HOLD");
    expect(replayed.intentId).toBe(first.intentId);
    expect(await intentRow(retry.intentId)).toBeUndefined();
  });

  it("refuses to sign a second payment for a key that already settled", async () => {
    const first = heldIntent({ amountMinor: toMinor("0.02") });
    expect((await evaluatePayment({ intent: first })).decision).toBe("ALLOW");

    // Stand in for the settlement commitBudget would stamp.
    await getDb().execute(sql`update payment_intents set tx_hash = 'ALREADYSETTLED' where id = ${first.intentId}`);

    const retry = heldIntent({ amountMinor: toMinor("0.02") });
    const result = await evaluatePayment({ intent: retry, idempotencyKey: first.intentId });

    expect(result.decision).toBe("BLOCK");
    expect(result.reasons[0].code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("stores the intent's own id as its idempotency key, which is what makes a resume possible", async () => {
    const intent = heldIntent({ amountMinor: toMinor("0.02") });
    await evaluatePayment({ intent });

    const [row] = (await getDb().execute(sql`
      select idempotency_key from payment_intents where id = ${intent.intentId}
    `)) as unknown as Record<string, unknown>[];
    expect(row.idempotency_key).toBe(intent.intentId);
  });
});
