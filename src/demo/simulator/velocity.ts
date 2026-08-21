// OWNER: DEMO. Waits until the agent has velocity headroom before a scenario spends anything.
//
// The seeded policy allows 5 payments a minute to one merchant, and every sandbox seller is served
// from localhost:3000 — so the whole demo shares one velocity window. Running two scenarios back to
// back therefore made the second one fail on a rule the first had used up: D3 saturates the window
// by design, and D1 and D6 were failing immediately after it for no reason of their own.
//
// Waiting is the honest fix. The limit is real and the guard is right to enforce it; what was wrong
// was scenarios pretending the window was theirs alone. In a fresh run this returns immediately.
import { env } from "@/shared/env";

/** Mirrors the seeded policy velocity.maxTxPerMerchantPerMinute. Change both together. */
export const MAX_PER_MERCHANT_PER_MINUTE = 5;

const POLL_INTERVAL_MS = 3_000;
// One velocity window is 60 s, so nothing can need longer than that plus a little slack.
const MAX_WAIT_MS = 70_000;

async function velocityLastMinute(agentId: string): Promise<number | null> {
  const response = await fetch(`${env.APP_URL}/api/v1/budgets/${agentId}`).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as
    | { data?: { velocity?: { lastMinute?: unknown } } }
    | null;
  const value = body?.data?.velocity?.lastMinute;
  return typeof value === "number" ? value : null;
}

async function agentIdByName(name: string): Promise<string | null> {
  const response = await fetch(`${env.APP_URL}/api/v1/agents`).catch(() => null);
  if (!response?.ok) return null;
  const body = (await response.json().catch(() => null)) as
    | { data?: { agents?: { agentId?: string; name?: string }[] } }
    | null;
  return body?.data?.agents?.find((agent) => agent.name === name)?.agentId ?? null;
}

/**
 * Blocks until the agent can make `needed` more payments this minute.
 *
 * Only ALLOW and HOLD count toward the window — a blocked payment leaves no trace in it — so the
 * scenarios that settle nothing (D2, D4, D5) never need to call this.
 *
 * Every failure here is non-fatal on purpose: if the count cannot be read, the scenario runs anyway
 * and reports whatever the guard decides. A demo helper must never be the reason a demo fails.
 */
export async function waitForVelocityHeadroom(
  needed: number,
  log: (line: string) => void,
  agentName = "ResearchBot",
): Promise<void> {
  const agentId = await agentIdByName(agentName);
  if (!agentId) return;

  const deadline = Date.now() + MAX_WAIT_MS;
  let announced = false;

  while (Date.now() < deadline) {
    const used = await velocityLastMinute(agentId);
    if (used === null) return;
    if (used + needed <= MAX_PER_MERCHANT_PER_MINUTE) return;

    if (!announced) {
      log(
        `[velocity] ${used}/${MAX_PER_MERCHANT_PER_MINUTE} payments used this minute; ` +
        `waiting for room for ${needed} more`,
      );
      announced = true;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  log("[velocity] window did not clear in time — running anyway, the guard decides");
}
