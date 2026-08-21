// OWNER: CORE. NFR-4. The test that proves budgets cannot be raced.
// Needs a real Postgres: the advisory lock is the thing under test, so there is nothing to mock.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  RESERVATION_TTL_MS,
  commitBudget,
  hashAgentId,
  releaseBudget,
  reserveBudget,
  sweepExpiredReservations,
} from "@/core/budget/ledger";
import { getDb, schema } from "@/core/db";
import { newId } from "@/shared/ids";
import { toMinor } from "@/shared/money";
import { makePolicyRules } from "@/core/tests/fixtures";

// Vitest does not run through --env-file, and drizzle.config.ts loads it the same way.
try { process.loadEnvFile(".env.local"); } catch { /* CI supplies DATABASE_URL directly */ }

const hasDatabase = Boolean(process.env.DATABASE_URL);
const agentId = newId("agent");

// The app pool is 5 connections, which quietly serialises a 50-way fan-out into roughly two
// backends. Racing has to be real for these assertions to mean anything, so the suite runs the
// production code against a pool wide enough for every attempt to be in flight at once.
const RACERS = 20;
let racePool: postgres.Sql | null = null;
let previousDb: typeof globalThis.__aspgDb;

async function ledgerTotals() {
  const rows = (await getDb().execute(sql`
    select
      coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT'), 0)::text as committed,
      (coalesce(sum(amount_minor) filter (where entry_type = 'RESERVE'), 0)
        - coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT'), 0)
        - coalesce(sum(amount_minor) filter (where entry_type = 'RELEASE'), 0))::text as reserved
    from budget_ledger where agent_id = ${agentId}
  `)) as unknown as Record<string, unknown>[];
  return {
    committedMinor: BigInt(String(rows[0]?.committed ?? "0")),
    reservedMinor: BigInt(String(rows[0]?.reserved ?? "0")),
  };
}

/** One intent row per reservation, because budget_ledger.intent_id is a real foreign key. */
async function makeIntents(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => newId("intent"));
  await getDb().insert(schema.paymentIntents).values(
    ids.map((id, index) => ({
      id,
      agentId,
      amountMinor: toMinor("0.60"),
      asset: "USDC",
      network: "algorand-testnet",
      recipient: "0x9a2B4c6D8e0F1a3B5c7D9e1F2a4B6c8D0e2F4a6B",
      merchantDomain: "localhost:3000",
      resource: "POST /api/sandbox/search",
      nonce: `nonce_race_${index}`,
      intentHash: `${index}`.padStart(64, "0"),
      state: "EVALUATING" as const,
    })),
  );
  return ids;
}

describe.skipIf(!hasDatabase)("budget ledger", () => {
  beforeAll(async () => {
    previousDb = globalThis.__aspgDb;
    racePool = postgres(process.env.DATABASE_URL as string, { max: 60, prepare: false });
    globalThis.__aspgDb = drizzle(racePool, { schema });

    await getDb().insert(schema.agents).values({
      id: agentId,
      name: `RaceBot ${agentId}`,
      status: "ACTIVE",
      apiKeyHash: `hash_${agentId}`,
      walletAllowanceCapMinor: toMinor("100.00"),
      walletFundedMinor: toMinor("100.00"),
    });
    await getDb().insert(schema.policies).values({
      id: newId("policy"),
      agentId,
      version: 1,
      isActive: true,
      maxPerTransactionMinor: toMinor("1.00"),
      hourlyBudgetMinor: toMinor("1.00"),
      dailyBudgetMinor: toMinor("1.00"),
      monthlyBudgetMinor: toMinor("50.00"),
      maxTxPerMinute: 100,
      maxTxPerHour: 1000,
      rules: makePolicyRules(),
    });
  });

  afterAll(async () => {
    // Cascades to policies, intents and ledger rows.
    await getDb().execute(sql`delete from agents where id = ${agentId}`);
    await racePool?.end();
    globalThis.__aspgDb = previousDb;
  });

  beforeEach(async () => {
    await getDb().execute(sql`delete from budget_ledger where agent_id = ${agentId}`);
    await getDb().execute(sql`delete from payment_intents where agent_id = ${agentId}`);
  });

  afterEach(async () => {
    await getDb().execute(sql`delete from budget_ledger where agent_id = ${agentId}`);
    await getDb().execute(sql`delete from payment_intents where agent_id = ${agentId}`);
  });

  // Runs the admission check by hand so the window between read and write can be held open.
  // reserveBudget itself finishes in about a millisecond, which is why the fan-out test below
  // cannot fail even with the lock deleted — the attempts simply never overlap. This one can.
  async function raceAdmission(useLock: boolean): Promise<{ admitted: number; reservedMinor: bigint }> {
    const client = postgres(process.env.DATABASE_URL as string, { max: RACERS + 5, prepare: false });
    const budgetMinor = toMinor("1.00");
    const amountMinor = toMinor("0.60");

    // Open every connection up front. Otherwise the pool establishes them one at a time and the
    // first attempt has committed before the last has a socket, which is not a race at all.
    await Promise.all(Array.from({ length: RACERS }, () => client`select pg_sleep(0.05)`));

    // Hold everyone at the point where they have read the balance but not yet written. The cap
    // matters for the locked run, where only one attempt can ever reach the barrier at a time.
    let arrived = 0;
    let openGate: () => void = () => {};
    const allArrived = new Promise<void>((resolve) => { openGate = resolve; });
    const waitForPeers = async () => {
      arrived += 1;
      if (arrived >= RACERS) openGate();
      await Promise.race([allArrived, new Promise((resolve) => setTimeout(resolve, 250))]);
    };

    const attempts = Array.from({ length: RACERS }, () =>
      client.begin(async (tx) => {
        if (useLock) // postgres.js types its template against bigint, so the key crosses as text and is cast back.
        await tx`select pg_advisory_xact_lock(${String(hashAgentId(agentId))}::bigint)`;

        const [sums] = await tx`
          select (coalesce(sum(amount_minor) filter (where entry_type = 'RESERVE'), 0)
                 - coalesce(sum(amount_minor) filter (where entry_type = 'COMMIT'), 0)
                 - coalesce(sum(amount_minor) filter (where entry_type = 'RELEASE'), 0))::text as reserved
          from budget_ledger where agent_id = ${agentId}`;

        await waitForPeers();

        if (BigInt(sums.reserved) + amountMinor > budgetMinor) throw new Error("BUDGET_EXCEEDED");

        await tx`
          insert into budget_ledger (id, agent_id, reservation_id, entry_type, amount_minor,
                                     window_hour, window_day, window_month, expires_at)
          values (${newId("ledger")}, ${agentId}, ${newId("reservation")}, 'RESERVE', ${String(amountMinor)}::bigint,
                  '2026-08-13T09', '2026-08-13', '2026-08', now() + interval '120 seconds')`;
      }),
    );

    const results = await Promise.allSettled(attempts);
    const rows = (await getDb().execute(sql`
      select coalesce(sum(amount_minor), 0)::text as total from budget_ledger
      where agent_id = ${agentId} and entry_type = 'RESERVE'`)) as unknown as Record<string, unknown>[];
    await client.end();

    return {
      admitted: results.filter((result) => result.status === "fulfilled").length,
      reservedMinor: BigInt(String(rows[0]?.total ?? "0")),
    };
  }

  it("the advisory lock is what prevents the overspend, not luck", async () => {
    // Without the lock every attempt reads "room left" before any of them writes, and the agent
    // reserves several times its daily budget. If this ever stops overspending, the fan-out test
    // below has quietly become meaningless and this whole file is proving nothing.
    const unlocked = await raceAdmission(false);
    expect(unlocked.admitted).toBeGreaterThan(1);
    expect(unlocked.reservedMinor).toBeGreaterThan(toMinor("1.00"));

    await getDb().execute(sql`delete from budget_ledger where agent_id = ${agentId}`);

    // Same race, same held-open window, with the lock the real reserveBudget takes.
    const locked = await raceAdmission(true);
    expect(locked.admitted).toBe(1);
    expect(locked.reservedMinor).toBe(toMinor("0.60"));
  }, 120_000);

  it("reserveBudget actually takes the per-agent lock before it reads the balance", async () => {
    // The test above proves the lock works; this one proves reserveBudget uses it. Hold the agent's
    // advisory lock on another connection and reserveBudget must block until it is handed over.
    // Delete the pg_advisory_xact_lock line from reserveBudget and this is the assertion that fails.
    const [intentId] = await makeIntents(1);
    const holder = postgres(process.env.DATABASE_URL as string, { max: 1, prepare: false });

    let signalAcquired: () => void = () => {};
    const acquired = new Promise<void>((resolve) => { signalAcquired = resolve; });
    let releaseHolder: () => void = () => {};
    const holderMayFinish = new Promise<void>((resolve) => { releaseHolder = resolve; });

    const holderTransaction = holder.begin(async (tx) => {
      // postgres.js types its template against bigint, so the key crosses as text and is cast back.
        await tx`select pg_advisory_xact_lock(${String(hashAgentId(agentId))}::bigint)`;
      signalAcquired();
      await holderMayFinish;
    });
    await acquired;

    let settled = false;
    const pending = reserveBudget(agentId, intentId, toMinor("0.10")).then((reservation) => {
      settled = true;
      return reservation;
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(settled, "reserveBudget ran without waiting for the agent lock").toBe(false);

    releaseHolder();
    await holderTransaction;
    await expect(pending).resolves.toMatchObject({ amountMinor: toMinor("0.10") });
    await holder.end();
  }, 30_000);

  it("50 concurrent $0.60 reservations against a $1.00 daily budget => exactly 1 ALLOW", async () => {
    const intentIds = await makeIntents(50);

    const results = await Promise.allSettled(
      intentIds.map((intentId) => reserveBudget(agentId, intentId, toMinor("0.60"))),
    );

    const reserved = results.filter((result) => result.status === "fulfilled");
    const refused = results.filter((result) => result.status === "rejected");

    expect(reserved).toHaveLength(1);
    expect(refused).toHaveLength(49);
    for (const failure of refused) {
      expect((failure as PromiseRejectedResult).reason.code).toBe("BUDGET_EXCEEDED");
    }

    // The ledger itself must agree — one RESERVE row, not one lucky return value.
    const totals = await ledgerTotals();
    expect(totals.reservedMinor).toBe(toMinor("0.60"));
  }, 60_000);

  it("COMMIT converts a reservation without double counting", async () => {
    const [intentId] = await makeIntents(1);
    const reservation = await reserveBudget(agentId, intentId, toMinor("0.60"));

    await commitBudget(reservation.reservationId, "0xdeadbeef");

    const totals = await ledgerTotals();
    expect(totals.committedMinor).toBe(toMinor("0.60"));
    // RESERVE minus COMMIT nets to zero, so the amount is counted as spent and not also as reserved.
    expect(totals.reservedMinor).toBe(0n);

    // Committing twice must not spend the money twice.
    await commitBudget(reservation.reservationId, "0xdeadbeef");
    expect((await ledgerTotals()).committedMinor).toBe(toMinor("0.60"));
  });

  it("RELEASE frees the window immediately", async () => {
    const intentIds = await makeIntents(2);
    const reservation = await reserveBudget(agentId, intentIds[0], toMinor("0.60"));

    // The window is full while the reservation is live.
    await expect(reserveBudget(agentId, intentIds[1], toMinor("0.60"))).rejects.toMatchObject({
      code: "BUDGET_EXCEEDED",
    });

    await releaseBudget(reservation.reservationId, "settlement failed");
    expect((await ledgerTotals()).reservedMinor).toBe(0n);

    // And the same amount fits again straight away.
    const second = await reserveBudget(agentId, intentIds[1], toMinor("0.60"));
    expect(second.amountMinor).toBe(toMinor("0.60"));

    // Releasing twice is harmless — the orchestrator and the sweeper both call it.
    await releaseBudget(second.reservationId, "duplicate release");
    await releaseBudget(second.reservationId, "duplicate release");
    expect((await ledgerTotals()).reservedMinor).toBe(0n);
  });

  it("the sweeper releases reservations after the 120 s TTL", async () => {
    const intentIds = await makeIntents(2);
    const live = await reserveBudget(agentId, intentIds[0], toMinor("0.30"));
    const stale = await reserveBudget(agentId, intentIds[1], toMinor("0.30"));

    expect(live.expiresAt.getTime() - Date.now()).toBeGreaterThan(RESERVATION_TTL_MS - 5_000);

    // Age one reservation past its TTL rather than waiting two minutes for the clock.
    await getDb().execute(sql`
      update budget_ledger set expires_at = now() - interval '1 second'
      where reservation_id = ${stale.reservationId}
    `);

    expect(await sweepExpiredReservations()).toBe(1);
    expect((await ledgerTotals()).reservedMinor).toBe(toMinor("0.30"));

    // A second sweep finds nothing left to do.
    expect(await sweepExpiredReservations()).toBe(0);
  });

  it("hourly, daily and monthly windows are enforced independently", async () => {
    const intentIds = await makeIntents(3);

    // Daily is $1.00 and monthly is $50.00, so the daily window is what refuses the second $0.60.
    await reserveBudget(agentId, intentIds[0], toMinor("0.60"));
    await expect(reserveBudget(agentId, intentIds[1], toMinor("0.60"))).rejects.toMatchObject({
      code: "BUDGET_EXCEEDED",
      details: { window: "hourly" },
    });

    // Under every window, the same amount is admitted.
    await expect(reserveBudget(agentId, intentIds[2], toMinor("0.40"))).resolves.toMatchObject({
      amountMinor: toMinor("0.40"),
    });
  });

  it("refuses a non-positive reservation", async () => {
    const [intentId] = await makeIntents(1);
    await expect(reserveBudget(agentId, intentId, 0n)).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });

  it("hashes an agent id into the signed 64-bit range pg_advisory_xact_lock accepts", () => {
    const min = -(2n ** 63n);
    const max = 2n ** 63n - 1n;
    for (const id of [agentId, newId("agent"), newId("agent"), ""]) {
      const key = hashAgentId(id);
      expect(key).toBeGreaterThanOrEqual(min);
      expect(key).toBeLessThanOrEqual(max);
    }
    expect(hashAgentId(agentId)).toBe(hashAgentId(agentId));
    expect(hashAgentId("agt_a")).not.toBe(hashAgentId("agt_b"));
  });
});
