// OWNER: CORE · ADMIN only. Triggers a FRESH evaluation, not a bypass. API_DOCS 5.4
import { z } from "zod";
import { writeAudit } from "@/core/audit/log";
import { actionApproval, getIntentById } from "@/core/db/queries";
import { handle, parseBody, requireAdmin } from "@/core/handlers/guards";
import { toIntentDto } from "@/core/handlers/serialize";
import { evaluatePayment } from "@/core/policy/context";
import { fail, ok } from "@/shared/http";
import type { PaymentIntent } from "@/shared/types";

const approveSchema = z.object({
  reviewerEmail: z.string().email().optional(),
  note: z.string().max(500).optional(),
});

export const POST = async (
  request: Request,
  { params }: { params: Promise<{ approvalId: string }> },
): Promise<Response> =>
  handle("POST /api/v1/approvals/:approvalId/approve", async () => {
    const forbidden = await requireAdmin(request);
    if (forbidden) return forbidden;

    const { approvalId } = await params;
    const intent = await getIntentById(approvalId);
    if (!intent) return fail("NOT_FOUND", { approvalId });
    if (intent.approvalStatus !== "PENDING") {
      return fail("APPROVAL_EXPIRED", { approvalId, approvalStatus: intent.approvalStatus });
    }
    if (intent.approvalExpiresAt && intent.approvalExpiresAt.getTime() < Date.now()) {
      await actionApproval(approvalId, "EXPIRED");
      await writeAudit("EXPIRED", { approvalId }, "system", { agentId: intent.agentId, intentId: approvalId });
      return fail("APPROVAL_EXPIRED", { approvalId });
    }

    const parsed = await parseBody(request, approveSchema);
    const reviewer = parsed.ok ? parsed.data : {};

    await actionApproval(approvalId, "APPROVED", reviewer.reviewerEmail, reviewer.note);
    await writeAudit("APPROVED", { reviewerEmail: reviewer.reviewerEmail ?? null, note: reviewer.note ?? null },
      reviewer.reviewerEmail ?? "dashboard", { agentId: intent.agentId, intentId: approvalId, live: "approval" });

    // A human approving does NOT skip the engine. Budgets and velocity may have moved since the
    // hold was raised, so the payment is judged again against the policy as it stands right now.
    // Passing the intent id as the resume key is what tells the engine an approval now exists:
    // without it the review rule fires a second time and puts the payment straight back in the
    // queue this approval just cleared. Every blocking rule still applies.
    const replay: PaymentIntent = {
      intentId: intent.id,
      agentId: intent.agentId,
      amountMinor: intent.amountMinor,
      asset: intent.asset,
      network: intent.network,
      recipient: intent.recipient as `0x${string}`,
      merchant: intent.merchantDomain,
      resource: intent.resource,
      reason: intent.reason ?? undefined,
      nonce: intent.nonce,
      intentHash: intent.intentHash,
      state: "EVALUATING",
      createdAt: intent.createdAt,
    };
    const reevaluation = await evaluatePayment({ intent: replay, idempotencyKey: intent.id });

    const updated = await getIntentById(approvalId);
    return ok({
      transaction: updated ? toIntentDto(updated) : null,
      reevaluation: {
        decision: reevaluation.decision,
        reasons: reevaluation.reasons,
        riskScore: reevaluation.riskScore,
      },
    });
  });
