// OWNER: CORE · GET detail / PATCH agent · API_DOCS 5.1
import { z } from "zod";
import { getActivePolicy, getAgentById, getSpendCounters } from "@/core/db/queries";
import { getDb, schema } from "@/core/db";
import { eq } from "drizzle-orm";
import { handle, parseBody, requireAdmin } from "@/core/handlers/guards";
import { toAgentDto, toPolicyDto } from "@/core/handlers/serialize";
import { isAddress } from "@/shared/address";
import { fail, ok } from "@/shared/http";
import { toUsd } from "@/shared/money";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  walletAddress: z
    .string()
    .refine(isAddress, "walletAddress is not a recognised wallet address")
    .nullable()
    .optional(),
});

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ agentId: string }> },
): Promise<Response> =>
  handle("GET /api/v1/agents/:agentId", async () => {
    const { agentId } = await params;
    const agent = await getAgentById(agentId);
    if (!agent) return fail("NOT_FOUND", { agentId });

    const [policy, counters] = await Promise.all([
      getActivePolicy(agentId),
      getSpendCounters(agentId, "", new Date()),
    ]);

    return ok({
      agent: toAgentDto(agent),
      policy: policy ? toPolicyDto(policy) : null,
      spend: {
        hourUsd: toUsd(counters.hourSpentMinor),
        dayUsd: toUsd(counters.daySpentMinor),
        monthUsd: toUsd(counters.monthSpentMinor),
        reservedUsd: toUsd(counters.reservedMinor),
      },
    });
  });

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
): Promise<Response> =>
  handle("PATCH /api/v1/agents/:agentId", async () => {
    const forbidden = await requireAdmin(request);
    if (forbidden) return forbidden;

    const { agentId } = await params;
    const parsed = await parseBody(request, patchSchema);
    if (!parsed.ok) return parsed.response;

    // Status is deliberately not patchable here: freezing goes through its own audited endpoint.
    const [updated] = await getDb()
      .update(schema.agents)
      .set(parsed.data)
      .where(eq(schema.agents.id, agentId))
      .returning();

    if (!updated) return fail("NOT_FOUND", { agentId });
    return ok({ agent: toAgentDto(updated) });
  });
