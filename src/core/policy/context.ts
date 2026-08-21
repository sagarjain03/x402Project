// OWNER: CORE. Does the I/O the engine refuses to do, then calls the pure engine.
// Fails closed: every path out of here that is not a clean evaluation is a BLOCK.
import { writeAudit } from "@/core/audit/log";
import { sweepExpiredReservations } from "@/core/budget/ledger";
import {
  findByIdempotencyKey,
  getActivePolicy,
  getAgentById,
  getIntentById,
  getSpendCounters,
  insertIntent,
  recordDecision,
} from "@/core/db/queries";
import { evaluate } from "@/core/policy/engine";
import { ERROR_CODES } from "@/shared/errors";
import type {
  EvaluationContext,
  EvaluationResult,
  PaymentIntent,
  Policy,
  Reason,
} from "@/shared/types";
import type { PaymentIntentRow, PolicyRow } from "@/core/db/schema";

export interface EvaluatePaymentInput {
  intent: PaymentIntent;
  idempotencyKey?: string;
}

function failClosed(code: "GUARD_UNAVAILABLE" | "IDEMPOTENCY_CONFLICT", latencyMs: number): EvaluationResult {
  const reason: Reason = { code, rule: "guard", message: ERROR_CODES[code].message };
  return {
    decision: "BLOCK",
    reasons: [reason],
    riskScore: 0,
    riskSignals: [],
    matchedRules: [],
    policyVersion: 0,
    latencyMs,
  };
}

/**
 * Whether two attempts are the same payment.
 *
 * Not intentHash: the nonce is regenerated on every attempt and is inside that hash by design —
 * it is what makes an allow-token unforgeable for a different intent (threat T9) — so two attempts
 * at one payment never share a hash, and comparing hashes rejected every genuine retry.
 *
 * The reason string is excluded too: it is free text the agent may reword on a retry.
 *
 * What is compared is every term the policy engine judges. A merchant that re-quotes a different
 * price therefore fails this check and is judged from scratch — an approval of $0.50 must never
 * be spent settling a $0.90 invoice.
 */
function sameTerms(prior: PaymentIntentRow, intent: PaymentIntent): boolean {
  return prior.amountMinor === intent.amountMinor
    && prior.asset === intent.asset
    && prior.network === intent.network
    && prior.recipient === intent.recipient
    && prior.merchantDomain === intent.merchant
    && prior.resource === intent.resource;
}

/**
 * The row a resume key points at, or null.
 *
 * Two things can be handed back as a resume token and both have to work: an Idempotency-Key the
 * agent chose, and the intent id the 202 returned — which is the only one a held payment gets,
 * and the one CORE's own approve handler uses when it re-judges an intent in place.
 *
 * The agent filter is not cosmetic. Without it one agent could resume another's approved payment
 * by quoting its id, which is an approval-stealing bug, not an idempotency one.
 */
async function findResumable(agentId: string, key: string): Promise<PaymentIntentRow | null> {
  const byKey = await findByIdempotencyKey(agentId, key);
  if (byKey) return byKey;
  const byId = await getIntentById(key);
  return byId?.agentId === agentId ? byId : null;
}

function toPolicy(row: PolicyRow): Policy {
  return {
    policyId: row.id,
    agentId: row.agentId,
    version: row.version,
    isActive: row.isActive,
    rules: row.rules,
    createdAt: row.createdAt,
  };
}

const normalizeHost = (host: string): string => host.trim().toLowerCase();

export async function evaluatePayment(input: EvaluatePaymentInput): Promise<EvaluationResult> {
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);
  const { intent, idempotencyKey } = input;

  // Which row the decision lands on, and whether a reviewer has already cleared this payment.
  // Declared out here so the fail-closed catch below records against the same row as the happy path.
  let recordAgainstId = intent.intentId;
  let approvalGranted = false;

  try {
    if (idempotencyKey) {
      const prior = await findResumable(intent.agentId, idempotencyKey);
      if (prior) {
        // Same key, different terms is an attacker or a bug — either way it is not the same payment.
        if (!sameTerms(prior, intent)) return failClosed("IDEMPOTENCY_CONFLICT", elapsed());

        // Replaying a key whose payment already settled must never sign a second one. A full replay
        // would hand back the stored response; response bodies are not stored, so this fails closed.
        if (prior.txHash) return failClosed("IDEMPOTENCY_CONFLICT", elapsed());

        if (prior.approvalStatus === "APPROVED") {
          // Re-judge it — API_DOCS 5.4: approval triggers a fresh evaluation, because budgets and
          // velocity may have moved while it waited. The settlement lands on the approved row.
          recordAgainstId = prior.id;
          approvalGranted = true;
        } else {
          return {
            decision: prior.decision ?? "BLOCK",
            intentId: prior.id,
            reasons: prior.reasons ?? [],
            riskScore: prior.riskScore,
            riskSignals: prior.riskSignals ?? [],
            matchedRules: prior.matchedRules ?? [],
            policyVersion: prior.policyVersion ?? 0,
            latencyMs: elapsed(),
          };
        }
      }
    }

    // The attempt is recorded before it is judged, so a refused payment still leaves a trace.
    // Skipped on a resume: that row already exists, and it is the one the reviewer approved.
    if (!approvalGranted) await insertIntent({
      id: intent.intentId,
      agentId: intent.agentId,
      amountMinor: intent.amountMinor,
      asset: intent.asset,
      network: intent.network,
      recipient: intent.recipient,
      merchantDomain: intent.merchant,
      resource: intent.resource,
      reason: intent.reason,
      nonce: intent.nonce,
      intentHash: intent.intentHash,
      // Defaulting to the intent's own id is what makes a held payment resumable: the 202 hands
      // that id back to the agent, and the agent returns it as the key once a human has approved.
      idempotencyKey: idempotencyKey ?? intent.intentId,
      state: "EVALUATING",
      createdAt: intent.createdAt,
    });

    const [agent, policyRow] = await Promise.all([
      getAgentById(intent.agentId),
      getActivePolicy(intent.agentId),
    ]);

    const now = new Date();
    // getSpendCounters sums RESERVE - COMMIT - RELEASE with no expiry predicate, so a reservation
    // whose TTL elapsed without settling still holds budget until something releases it. The cron
    // cannot be that something on every plan — Vercel Hobby allows one run a day — so the sweep
    // happens here, on the one path whose answer depends on it. Indexed on expires_at, and a
    // no-op in the normal case where nothing has expired.
    await sweepExpiredReservations();
    const counters = await getSpendCounters(intent.agentId, intent.merchant, now);

    const merchantRules = policyRow?.rules.merchant;
    const pinnedRecipient = merchantRules
      ? Object.entries(merchantRules.pinnedRecipients).find(
          ([host]) => normalizeHost(host) === normalizeHost(intent.merchant),
        )?.[1]
      : undefined;

    // Wallet allowance is capped by whichever of the grant and the balance is smaller, less the
    // money already promised. Committed spend is not subtracted: the funded figure is not re-read
    // from chain, so doing that would count the same dollars twice.
    const walletCeilingMinor =
      agent && agent.walletAllowanceCapMinor < agent.walletFundedMinor
        ? agent.walletAllowanceCapMinor
        : (agent?.walletFundedMinor ?? 0n);
    const walletAllowanceRemainingMinor =
      walletCeilingMinor > counters.reservedMinor ? walletCeilingMinor - counters.reservedMinor : 0n;

    const context: EvaluationContext = {
      intent,
      // A missing policy is left for the engine to refuse, so deny-by-default lives in one place.
      policy: policyRow ? toPolicy(policyRow) : (undefined as unknown as Policy),
      counters,
      agentStatus: agent?.status ?? "FROZEN",
      // The merchants table is deferred, so the policy allowlist is what "known" means today.
      merchantKnown: Boolean(
        merchantRules?.allowedMerchants.some((host) => normalizeHost(host) === normalizeHost(intent.merchant)),
      ),
      pinnedRecipient: pinnedRecipient as `0x${string}` | undefined,
      walletAllowanceRemainingMinor,
      approvalGranted,
      now,
    };

    const result = evaluate(context);
    result.latencyMs = elapsed();
    result.intentId = recordAgainstId;

    // Audit BEFORE the result returns, so nothing can be signed against a decision that was
    // never recorded. CLAUDE.md rule 4 — this ordering is the security property, not a preference.
    await writeAudit(
      "DECISION",
      {
        decision: result.decision,
        reasons: result.reasons,
        riskScore: result.riskScore,
        amountMinor: intent.amountMinor.toString(),
        merchant: intent.merchant,
        policyVersion: result.policyVersion,
      },
      `agent:${intent.agentId}`,
      { agentId: intent.agentId, intentId: recordAgainstId, live: "decision" },
    );

    await recordDecision(recordAgainstId, result);
    return result;
  } catch (error) {
    console.error("evaluatePayment failed closed:", error);
    const blocked = failClosed("GUARD_UNAVAILABLE", elapsed());
    blocked.intentId = recordAgainstId;

    // Best effort only. The guard is already returning BLOCK; a second failure must not change that.
    try {
      await writeAudit(
        "DECISION",
        { decision: "BLOCK", reason: "GUARD_UNAVAILABLE", error: String(error) },
        "guard",
        { agentId: intent.agentId, intentId: recordAgainstId, live: "decision" },
      );
      await recordDecision(recordAgainstId, blocked);
    } catch {
      // The database is what failed in the first place; there is nowhere left to write.
    }

    return blocked;
  }
}
