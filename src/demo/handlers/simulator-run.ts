// OWNER: DEMO · POST /api/v1/simulator/run · API_DOCS 5.8
// Backs UI's simulator page: one button per scenario, the transcript is what the judge reads.
import { z } from "zod";
import { fail, ok } from "@/shared/http";
import { runScenario, SCENARIOS, type ScenarioName } from "@/demo/simulator";

const bodySchema = z.object({
  scenario: z.string().min(1),
});

function resolveName(input: string): ScenarioName | undefined {
  const normalized = input.toUpperCase().replaceAll("-", "_");
  return SCENARIOS.find((s) => s === normalized || s.startsWith(`${normalized}_`));
}

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail("INVALID_PAYMENT_REQUIREMENTS", { issues: parsed.error.flatten().fieldErrors }, "Request body is invalid.");
  }

  const name = resolveName(parsed.data.scenario);
  if (!name) {
    return fail("INVALID_PAYMENT_REQUIREMENTS", { scenario: parsed.data.scenario, known: SCENARIOS }, "Unknown scenario.");
  }

  const transcript: string[] = [];
  let passed = true;
  try {
    await runScenario(name, (line) => transcript.push(line));
  } catch (error) {
    // A scenario that misses its expectation is a demo result, not a server fault — 200 either way.
    passed = false;
    transcript.push(error instanceof Error ? error.message : String(error));
  }

  return ok({ scenario: name, passed, transcript });
}
