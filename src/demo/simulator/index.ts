// OWNER: DEMO. The deterministic driver: same tools as the LLM agent, no model, repeatable.
// RUN: npm run sim -- d1
import { fileURLToPath } from "node:url";
import path from "node:path";
import { run as d1 } from "@/demo/simulator/scenarios/d1-normal-payment";
import { run as d2 } from "@/demo/simulator/scenarios/d2-over-limit";
import { run as d3 } from "@/demo/simulator/scenarios/d3-velocity-loop";
import { run as d4 } from "@/demo/simulator/scenarios/d4-unknown-merchant";
import { run as d5 } from "@/demo/simulator/scenarios/d5-budget-exhaustion";
import { run as d6 } from "@/demo/simulator/scenarios/d6-prompt-injection";
import { run as d7 } from "@/demo/simulator/scenarios/d7-human-escalation";

export const SCENARIOS = [
  "D1_NORMAL_PAYMENT",
  "D2_OVER_LIMIT",
  "D3_VELOCITY_LOOP",
  "D4_UNKNOWN_MERCHANT",
  "D5_BUDGET_EXHAUSTION",
  "D6_PROMPT_INJECTION",
  "D7_HUMAN_ESCALATION",
] as const;

export type ScenarioName = (typeof SCENARIOS)[number];

export type ScenarioLog = (line: string) => void;

const RUNNERS: Record<ScenarioName, (log?: ScenarioLog) => Promise<void>> = {
  D1_NORMAL_PAYMENT: d1,
  D2_OVER_LIMIT: d2,
  D3_VELOCITY_LOOP: d3,
  D4_UNKNOWN_MERCHANT: d4,
  D5_BUDGET_EXHAUSTION: d5,
  D6_PROMPT_INJECTION: d6,
  D7_HUMAN_ESCALATION: d7,
};

export async function runScenario(name: ScenarioName, log: ScenarioLog = console.log): Promise<void> {
  await RUNNERS[name](log);
}

function resolveName(input: string | undefined): ScenarioName | undefined {
  if (!input) return undefined;
  const normalized = input.toUpperCase().replaceAll("-", "_");
  return SCENARIOS.find((s) => s === normalized || s.startsWith(`${normalized}_`));
}

async function main() {
  const name = resolveName(process.argv[2]);
  if (!name) {
    console.error(`Usage: npm run sim -- <scenario>\n\n  ${SCENARIOS.join("\n  ")}\n`);
    process.exit(1);
  }
  await runScenario(name);
}

// Only run when invoked as a CLI — the C4 simulator endpoint imports runScenario from here.
const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
