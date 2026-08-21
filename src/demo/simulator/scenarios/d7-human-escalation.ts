// OWNER: DEMO · $0.50 premium-report (analyst edition, inside the hold band).
// EXPECT: HOLD (202 APPROVAL_REQUIRED) -> a human approves -> the retry settles with a tx hash.
// Needs CORE's HOLD path + approvals API. The approve/poll calls below follow API_DOCS 5.4 —
// adjust here if CORE ships a different shape, nowhere else.
import { env } from "@/shared/env";
import { guardedFetch } from "@/demo/agent/guardedFetch";
import { TOOL_ENDPOINTS } from "@/demo/agent/tools";
import { PREMIUM_REPORT_EDITIONS } from "@/demo/sandbox/pricing";
import { waitForVelocityHeadroom } from "@/demo/simulator/velocity";

const POLL_INTERVAL_MS = 3_000;
// A serverless function is killed at its own ceiling — 60s on Vercel Hobby — so a five minute wait
// never reports the scenario's message, it returns a 504 with no transcript at all. The default
// fits inside that and still leaves a presenter ample time to click approve. Raise
// D7_APPROVAL_WAIT_MS wherever the function ceiling is higher.
const APPROVAL_WAIT_MS = Number(process.env.D7_APPROVAL_WAIT_MS ?? 45_000);

/** GET /api/v1/payments/:id returns { payment: { approval: { status } } } — API_DOCS 5.5. */
function readApprovalStatus(payload: unknown): string | undefined {
  const payment = (payload as { payment?: { approval?: { status?: unknown } } })?.payment;
  return typeof payment?.approval?.status === "string" ? payment.approval.status : undefined;
}

async function waitForApproval(intentId: string, log: (line: string) => void): Promise<void> {
  const deadline = Date.now() + APPROVAL_WAIT_MS;
  log(`[D7] waiting for a human — approve it in the dashboard (/approvals)`);
  while (Date.now() < deadline) {
    const response = await fetch(`${env.APP_URL}/api/v1/payments/${intentId}`);
    const status = readApprovalStatus((await response.json().catch(() => null))?.data);
    if (status === "APPROVED") return;
    if (status === "REJECTED" || status === "EXPIRED") {
      throw new Error(`[D7] approval ${status.toLowerCase()} — the demo ends here, and no money moved`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`[D7] nobody approved within ${Math.round(APPROVAL_WAIT_MS / 1000)}s`);
}

export async function run(log: (line: string) => void = console.log): Promise<void> {
  const url = `${TOOL_ENDPOINTS.premiumReport}?edition=analyst`;
  const priceUsd = PREMIUM_REPORT_EDITIONS.analyst;
  const body = { topic: "EV battery recycling market", edition: "analyst" };
  // Two against the window: a HOLD counts the same as an ALLOW, and then the resume settles.
  await waitForVelocityHeadroom(2, log);
  log(`[D7] POST ${url} (${priceUsd}) — inside the hold band, expect HOLD`);

  const held = await guardedFetch(url, body, "D7: buy the analyst-edition report");
  if (held.ok) {
    throw new Error(`[D7] SETTLED immediately (tx: ${held.txHash}) — the hold band did not fire`);
  }
  if (held.blocked?.code !== "APPROVAL_REQUIRED" || !held.approval?.intentId) {
    throw new Error(`[D7] expected HOLD APPROVAL_REQUIRED, got ${held.blocked?.code ?? "an unreadable response"}`);
  }
  const { intentId } = held.approval;
  log(`[D7] HOLD — intent ${intentId} is waiting for review${held.approval.expiresAt ? ` (expires ${held.approval.expiresAt})` : ""}`);

  await waitForApproval(intentId, log);
  log("[D7] approved — resuming the same purchase");

  const settled = await guardedFetch(url, body, "D7: resume after approval", { idempotencyKey: intentId });
  if (!settled.ok || !settled.txHash) {
    throw new Error(`[D7] approved but the retry did not settle: ${settled.blocked?.code ?? "no tx hash"}`);
  }
  log(`[D7] payment resumed and settled — txHash: ${settled.txHash}`);
  log(`[D7] attempted $${priceUsd}, spent $${priceUsd} — with a human in the loop`);
}
