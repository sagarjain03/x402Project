// OWNER: CORE · allowlist CRUD · API_DOCS 5.3
// The allowlist lives inside policy.rules, so every edit here creates a new policy version. That is
// deliberate: changing who an agent may pay is an auditable policy change, not an untracked row edit.
import { z } from "zod";
import { writeAudit } from "@/core/audit/log";
import { createPolicyVersion, getActivePolicy, listAgents } from "@/core/db/queries";
import { handle, parseBody, requireAdmin } from "@/core/handlers/guards";
import { fail, ok } from "@/shared/http";

const addSchema = z.object({
  agentId: z.string().min(1),
  merchant: z.string().min(1).max(255),
  list: z.enum(["allowed", "blocked"]).default("allowed"),
  pinnedRecipient: z.string().regex(/^([A-Z2-7]{58}|0x[a-fA-F0-9]{40})$/i).optional(),
  updatedByEmail: z.string().email().optional(),
});

export const GET = async (request: Request): Promise<Response> =>
  handle("GET /api/v1/merchants", async () => {
    const agentId = new URL(request.url).searchParams.get("agentId");
    const agents = agentId ? [{ id: agentId }] : (await listAgents()).map((agent) => ({ id: agent.id }));

    const merchants = [];
    for (const agent of agents) {
      const policy = await getActivePolicy(agent.id);
      if (!policy || !policy.rules?.merchant) continue;
      const { allowedMerchants = [], blockedMerchants = [], pinnedRecipients = {} } = policy.rules.merchant;

      merchants.push({
        agentId: agent.id,
        policyVersion: policy.version,
        allowed: allowedMerchants.map((domain) => ({
          domain,
          pinnedRecipient: pinnedRecipients?.[domain] ?? null,
        })),
        blocked: blockedMerchants,
        unknownMerchantAction: policy.rules.merchant.unknownMerchantAction || "BLOCK",
      });
    }

    return ok({ merchants, total: merchants.length });
  });

export const POST = async (request: Request): Promise<Response> =>
  handle("POST /api/v1/merchants", async () => {
    const forbidden = await requireAdmin(request);
    if (forbidden) return forbidden;

    const parsed = await parseBody(request, addSchema);
    if (!parsed.ok) return parsed.response;

    const { agentId, merchant, list, pinnedRecipient, updatedByEmail } = parsed.data;
    const policy = await getActivePolicy(agentId);
    if (!policy) return fail("NO_ACTIVE_POLICY", { agentId });

    const current = policy.rules.merchant;
    const rules = {
      ...policy.rules,
      merchant: {
        ...current,
        allowedMerchants:
          list === "allowed" && !current.allowedMerchants.includes(merchant)
            ? [...current.allowedMerchants, merchant]
            : current.allowedMerchants,
        blockedMerchants:
          list === "blocked" && !current.blockedMerchants.includes(merchant)
            ? [...current.blockedMerchants, merchant]
            : current.blockedMerchants,
        pinnedRecipients: pinnedRecipient
          ? { ...current.pinnedRecipients, [merchant]: pinnedRecipient }
          : current.pinnedRecipients,
      },
    };

    const created = await createPolicyVersion(agentId, rules, updatedByEmail);
    await writeAudit(list === "blocked" ? "MERCHANT_BLOCKED" : "MERCHANT_ADDED",
      { merchant, pinnedRecipient: pinnedRecipient ?? null, policyVersion: created.version },
      "dashboard", { agentId });

    return ok({ agentId, merchant, list, policyVersion: created.version }, 201);
  });
