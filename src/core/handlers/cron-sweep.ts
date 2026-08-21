// OWNER: CORE · releases reservations past their 120 s TTL · ARCHITECTURE 6.1
import { timingSafeEqual } from "node:crypto";
import { writeAudit } from "@/core/audit/log";
import { sweepExpiredReservations } from "@/core/budget/ledger";
import { handle } from "@/core/handlers/guards";
import { fail, ok } from "@/shared/http";

// Vercel's scheduler sends `Authorization: Bearer $CRON_SECRET`. Unset, the route stays open so a
// local `curl` still works; set, nobody but the scheduler can free another agent's reservations.
function isScheduler(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const presented = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const GET = async (request: Request): Promise<Response> =>
  handle("GET /api/v1/cron/sweep", async () => {
    if (!isScheduler(request)) return fail("FORBIDDEN");

    const released = await sweepExpiredReservations();

    // Only worth an audit row when it actually freed budget; a no-op sweep is noise.
    if (released > 0) {
      await writeAudit("BUDGET_RELEASED", { released, reason: "TTL sweep" }, "cron", { live: "budget" });
    }

    return ok({ released }, 200, `Released ${released} expired reservation(s).`);
  });
