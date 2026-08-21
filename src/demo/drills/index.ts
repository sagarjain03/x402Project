// OWNER: DEMO. The ten attack drills from DEVELOPMENT_PLAN.md Phase 5, run through the Guard.
// RUN: npm run drills — records attempted vs actual spend per drill and writes Docs/ATTACK_DRILLS.md.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { guardedFetch } from "@/demo/agent/guardedFetch";
import { TOOL_ENDPOINTS } from "@/demo/agent/tools";
import { obeyInjection } from "@/demo/simulator/scenarios/d6-prompt-injection";
import { PRICING, type SandboxRoute } from "@/demo/sandbox/pricing";
import { ATTEMPTED_SPEND_USD } from "@/demo/fixtures/poisoned";
import { env } from "@/shared/env";
import { formatUsd, toMinor } from "@/shared/money";

export const DRILLS = [
  { id: "5.1", name: "runaway loop", owner: "DEMO", expect: "velocity blocks after the limit" },
  { id: "5.2", name: "prompt injection", owner: "DEMO", expect: "spend <= daily budget" },
  { id: "5.3", name: "unknown merchant", owner: "DEMO", expect: "allowlist BLOCK" },
  { id: "5.4", name: "recipient swap", owner: "PAY", expect: "RECIPIENT_MISMATCH" },
  { id: "5.5", name: "wrong rail", owner: "PAY", expect: "rail BLOCK" },
  { id: "5.6", name: "replay", owner: "CORE", expect: "single charge, 409 on conflict" },
  { id: "5.7", name: "budget race", owner: "CORE", expect: "no overspend across 50 parallel" },
  { id: "5.8", name: "policy bypass", owner: "PAY", expect: "allowToken check refuses" },
  { id: "5.9", name: "fail closed", owner: "CORE", expect: "DB down => BLOCK" },
  { id: "5.10", name: "frozen agent", owner: "UI", expect: "next payment blocked immediately" },
] as const;

// INFRA: the drill never reached a control (Guard down, wallet key missing) — no verdict either way.
export type DrillStatus = "PASS" | "FAIL" | "MANUAL" | "INFRA";

// Non-control outcomes: Guard down, wallet key missing, or the gateway's own HTTP throttle.
const INFRA_CODES = new Set(["GUARD_UNAVAILABLE", "UPSTREAM_UNAVAILABLE", "RATE_LIMITED"]);
const infraNote = (code: string) => `no verdict — the request never reached a control (${code}). Check AVM_PRIVATE_KEY and that the dev server is up.`;

// Attempted spend is a property of the drill definition, so it is reported even when
// infrastructure kept the attack from reaching a control.
const infra = (id: string, code: string, attemptedMinor: bigint): DrillResult => {
  const d = DRILLS.find((x) => x.id === id)!;
  return { id: d.id, name: d.name, owner: d.owner, attemptedMinor, actualMinor: 0n, control: "n/a", status: "INFRA", note: infraNote(code) };
};

export interface DrillResult {
  id: string;
  name: string;
  owner: string;
  attemptedMinor: bigint;
  actualMinor: bigint;
  control: string;
  status: DrillStatus;
  note: string;
}

// Seeded policy: velocity 10 / 5 min, hourly budget $1.00. Drills share those windows —
// run `npm run db:reset` between full passes for clean numbers.
const VELOCITY_CAP = 10;
const HOURLY_BUDGET_MINOR = toMinor("1.00");

const manual = (id: string, note: string, attemptedUsd = "0.00"): DrillResult => {
  const d = DRILLS.find((x) => x.id === id)!;
  return { id: d.id, name: d.name, owner: d.owner, attemptedMinor: toMinor(attemptedUsd), actualMinor: 0n, control: d.expect, status: "MANUAL", note };
};

async function drillRunawayLoop(log: (l: string) => void): Promise<DrillResult> {
  const d = DRILLS[0];
  const burst = 20;
  const priceMinor = toMinor(PRICING["/api/sandbox/fact-check"]);
  let settled = 0;
  const codes = new Map<string, number>();
  for (let i = 0; i < burst; i++) {
    const r = await guardedFetch(TOOL_ENDPOINTS.factCheck, { claim: "x" }, `drill 5.1 burst ${i + 1}/${burst}`);
    if (r.ok) settled++;
    else codes.set(r.blocked?.code ?? "UNKNOWN", (codes.get(r.blocked?.code ?? "UNKNOWN") ?? 0) + 1);
  }
  const control = codes.size ? [...codes].map(([c, n]) => `${c} x${n}`).join(", ") : "none fired";
  log(`[5.1] ${settled}/${burst} settled, ${control}`);
  if (codes.size && [...codes.keys()].every((c) => INFRA_CODES.has(c))) {
    return infra(d.id, control, BigInt(burst) * priceMinor);
  }
  const pass = settled <= VELOCITY_CAP && codes.has("VELOCITY_EXCEEDED");
  return {
    id: d.id, name: d.name, owner: d.owner,
    attemptedMinor: BigInt(burst) * priceMinor, actualMinor: BigInt(settled) * priceMinor,
    control, status: pass ? "PASS" : "FAIL",
    note: pass ? `velocity capped the burst at ${settled}` : "no velocity control fired — CORE's policy engine is the missing layer",
  };
}

async function drillPromptInjection(log: (l: string) => void): Promise<DrillResult> {
  const d = DRILLS[1];
  const attack = await obeyInjection(log);
  const pass = attack.settledTxHashes.length === 0;
  return {
    id: d.id, name: d.name, owner: d.owner,
    attemptedMinor: toMinor(ATTEMPTED_SPEND_USD) + toMinor(PRICING[TOOL_ENDPOINTS.search]),
    actualMinor: attack.spentMinor,
    control: [...attack.blockedByCode].map(([c, n]) => `${c} x${n}`).join(", ") || "none fired",
    status: pass ? "PASS" : "FAIL",
    note: pass
      ? `${attack.demandedTimes} injected purchases blocked; only the $${PRICING[TOOL_ENDPOINTS.search]} search settled`
      : `${attack.settledTxHashes.length} purchases settled — the Guard failed`,
  };
}

async function drillRogue(): Promise<{ blocked: boolean; code: string }> {
  const r = await guardedFetch("/api/sandbox/rogue", {}, "drills 5.3/5.4: buy from an unallowlisted merchant");
  return { blocked: !r.ok, code: r.blocked?.code ?? "NONE" };
}

async function drillReplay(): Promise<DrillResult> {
  const d = DRILLS[5];
  const priceMinor = toMinor(PRICING["/api/sandbox/summarize"]);
  const key = `drill-5.6-${Date.now()}`;
  const first = await guardedFetch(TOOL_ENDPOINTS.summarize, { topic: "replay" }, "drill 5.6 first", { idempotencyKey: key });
  const second = await guardedFetch(TOOL_ENDPOINTS.summarize, { topic: "replay" }, "drill 5.6 replay", { idempotencyKey: key });
  const secondCode = second.blocked?.code ?? "NONE";
  if (!first.ok && !second.ok && INFRA_CODES.has(first.blocked?.code ?? "") && INFRA_CODES.has(secondCode)) {
    return infra(d.id, first.blocked?.code ?? "UNKNOWN", 2n * priceMinor);
  }
  const settles = Number(first.ok) + Number(second.ok);
  const singleCharge = settles <= 1 && !(first.ok && second.ok);
  const control = second.ok ? "none fired" : secondCode;
  return {
    id: d.id, name: d.name, owner: d.owner,
    attemptedMinor: 2n * priceMinor, actualMinor: BigInt(settles) * priceMinor,
    control, status: singleCharge ? "PASS" : "FAIL",
    note: singleCharge
      ? `second call with the same idempotency key did not charge (${control})`
      : "both calls settled — CORE's idempotency keys are the missing layer",
  };
}

async function drillBudgetRace(): Promise<DrillResult> {
  const d = DRILLS[6];
  const racers = 50;
  const priceMinor = toMinor(PRICING["/api/sandbox/fact-check"]);
  const results = await Promise.all(
    Array.from({ length: racers }, (_, i) =>
      guardedFetch(TOOL_ENDPOINTS.factCheck, { claim: "race" }, `drill 5.7 racer ${i + 1}/${racers}`)),
  );
  const settled = results.filter((r) => r.ok).length;
  const codes = new Map<string, number>();
  for (const r of results) {
    if (!r.ok) codes.set(r.blocked?.code ?? "UNKNOWN", (codes.get(r.blocked?.code ?? "UNKNOWN") ?? 0) + 1);
  }
  const control = codes.size ? [...codes].map(([c, n]) => `${c} x${n}`).join(", ") : "none fired";
  if (settled === 0 && codes.size && [...codes.keys()].every((c) => INFRA_CODES.has(c))) {
    return infra(d.id, control, BigInt(racers) * priceMinor);
  }
  const pass = BigInt(settled) * priceMinor <= HOURLY_BUDGET_MINOR && codes.has("BUDGET_EXCEEDED");
  return {
    id: d.id, name: d.name, owner: d.owner,
    attemptedMinor: BigInt(racers) * priceMinor, actualMinor: BigInt(settled) * priceMinor,
    control, status: pass ? "PASS" : "FAIL",
    note: pass
      ? `${settled} settled within the $1.00 hourly budget, the rest blocked`
      : `${settled} settled (${formatUsd(BigInt(settled) * priceMinor)}) — CORE's budget ledger is the missing layer`,
  };
}

// C7 done-when #1: every seller answers a bare request with a real, decodable 402 quote.
export interface SellerCheck { route: SandboxRoute; ok: boolean; detail: string }

export function decodePaymentRequired(header: string): { amount: string; payTo: string } {
  const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as {
    accepts?: { amount?: string; payTo?: string }[];
  };
  const accept = decoded.accepts?.[0];
  if (!accept?.amount || !accept.payTo) throw new Error("header has no accepts[0].amount/payTo");
  return { amount: accept.amount, payTo: accept.payTo };
}

async function checkSeller(route: SandboxRoute): Promise<SellerCheck> {
  try {
    const res = await fetch(`${env.APP_URL}${route}`);
    const header = res.headers.get("payment-required");
    if (res.status !== 402 || !header) {
      return { route, ok: false, detail: `got ${res.status}, expected 402 with PAYMENT-REQUIRED` };
    }
    const quote = decodePaymentRequired(header);
    const expectedMinor = toMinor(PRICING[route]).toString();
    return quote.amount === expectedMinor
      ? { route, ok: true, detail: `$${PRICING[route]} -> ${quote.payTo.slice(0, 10)}…` }
      : { route, ok: false, detail: `quoted ${quote.amount} minor, expected ${expectedMinor}` };
  } catch (error) {
    return { route, ok: false, detail: error instanceof Error ? error.message : "unreachable" };
  }
}

export function buildMarkdown(results: DrillResult[], sellers: SellerCheck[]): string {
  const row = (r: DrillResult) =>
    `| ${r.id} | ${r.name} | ${r.owner} | ${formatUsd(r.attemptedMinor)} | ${formatUsd(r.actualMinor)} | ${r.control} | ${r.status} | ${r.note} |`;
  const sellerRow = (s: SellerCheck) => `| ${s.route} | $${PRICING[s.route]} | ${s.ok ? "PASS" : "FAIL"} | ${s.detail} |`;
  return [
    "# Attack drill results",
    "",
    `Generated by \`npm run drills\` on ${new Date().toISOString().slice(0, 10)}. Attempted vs actual spend`,
    "is the number that matters: what the attack tried to spend, and what actually left the wallet.",
    "",
    "## Seller 402 check",
    "",
    "| Seller | Price | 402 + decodable PAYMENT-REQUIRED | Detail |",
    "|---|---|---|---|",
    ...sellers.map(sellerRow),
    "",
    "## Drills (DEVELOPMENT_PLAN.md Phase 5)",
    "",
    "| Drill | Name | Owner | Attempted | Actual | Control that fired | Result | Note |",
    "|---|---|---|---|---|---|---|---|",
    ...results.map(row),
    "",
    "MANUAL drills need another lane's surface; the reproduction steps are printed by `npm run drills`.",
    "Re-run after `npm run db:reset` for clean budget/velocity windows.",
    "",
  ].join("\n");
}

async function main() {
  const log = console.log;
  log("=== Attack drills — real USDC on Algorand TestNet. Worst case without any control: ~$5.80. ===\n");

  log("[check] six sellers must answer a bare request with a decodable 402");
  const sellers: SellerCheck[] = [];
  for (const route of Object.keys(PRICING) as SandboxRoute[]) {
    const check = await checkSeller(route);
    sellers.push(check);
    log(`[check] ${check.ok ? "PASS" : "FAIL"} ${route} — ${check.detail}`);
  }

  const results: DrillResult[] = [];
  const run = async (label: string, fn: () => Promise<DrillResult>, attemptedMinor = 0n) => {
    try {
      results.push(await fn());
    } catch (error) {
      results.push(infraWith(label, error instanceof Error ? error.message : "drill crashed", attemptedMinor));
    }
  };
  const infraWith = (label: string, note: string, attemptedMinor: bigint): DrillResult => {
    const d = DRILLS.find((x) => x.id === label)!;
    return { id: d.id, name: d.name, owner: d.owner, attemptedMinor, actualMinor: 0n, control: "n/a", status: "INFRA", note };
  };

  await run("5.1", () => drillRunawayLoop(log), 20n * toMinor(PRICING["/api/sandbox/fact-check"]));
  await run("5.2", () => drillPromptInjection(log), toMinor(ATTEMPTED_SPEND_USD) + toMinor(PRICING[TOOL_ENDPOINTS.search]));

  await run("5.3", async () => {
    const d = DRILLS[2];
    const rogue = await drillRogue();
    if (rogue.blocked && INFRA_CODES.has(rogue.code)) return infra(d.id, rogue.code, toMinor(PRICING["/api/sandbox/rogue"]));
    return {
      id: d.id, name: d.name, owner: d.owner,
      attemptedMinor: toMinor(PRICING["/api/sandbox/rogue"]), actualMinor: rogue.blocked ? 0n : toMinor(PRICING["/api/sandbox/rogue"]),
      control: rogue.code, status: rogue.blocked ? "PASS" : "FAIL",
      note: rogue.blocked ? `blocked with ${rogue.code}` : "an unallowlisted merchant got paid",
    };
  });
  await run("5.4", async () => {
    const d = DRILLS[3];
    const rogue = await drillRogue();
    if (rogue.blocked && INFRA_CODES.has(rogue.code)) return infra(d.id, rogue.code, toMinor(PRICING["/api/sandbox/rogue"]));
    const pass = rogue.blocked && rogue.code === "RECIPIENT_MISMATCH";
    return {
      id: d.id, name: d.name, owner: d.owner,
      attemptedMinor: toMinor(PRICING["/api/sandbox/rogue"]), actualMinor: pass ? 0n : toMinor(PRICING["/api/sandbox/rogue"]),
      control: rogue.code, status: pass ? "PASS" : "FAIL",
      note: pass ? "PAY's recipient pinning refused the swapped wallet" : `expected RECIPIENT_MISMATCH, got ${rogue.code}`,
    };
  });

  results.push(manual("5.5", "PAY: attempt an x402 payment on a non-Base rail — the allowToken check must refuse it."));
  await run("5.6", drillReplay);
  await run("5.7", drillBudgetRace);
  results.push(manual("5.8", "curl -X POST <app>/api/sandbox/search -H 'PAYMENT-SIGNATURE: garbage' — must stay 402, never 200.", "0.02"));
  results.push(manual("5.9", "Stop the database, then npm run sim -- d1 — must block (fail closed), never allow. Restart the DB after.", "0.02"));
  results.push(manual("5.10", "Freeze the agent from the dashboard, then npm run sim -- d1 — must block immediately.", "0.02"));

  log("\n=== attempted vs actual ===");
  for (const r of results) {
    log(`[${r.id}] ${r.name}: attempted ${formatUsd(r.attemptedMinor)}, actual ${formatUsd(r.actualMinor)} — ${r.status} (${r.control})`);
  }

  const markdown = buildMarkdown(results, sellers);
  const out = path.resolve(process.cwd(), "..", "Docs", "ATTACK_DRILLS.md");
  try {
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, markdown);
    log(`\nwrote ${out}`);
  } catch {
    log(`\ncould not write ${out} — the table is above, paste it into ATTACK_DRILLS.md`);
  }
}

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
