// OWNER: CORE. The three things every control-plane handler repeats: admit an ADMIN, read a body,
// and turn an unexpected throw into an envelope rather than a Next.js stack trace.
import type { ZodTypeAny, output } from "zod";
import { fail } from "@/shared/http";

/**
 * The control plane is deliberately open. Anyone who reaches the dashboard may approve or reject a
 * held payment, freeze an agent and edit a policy — a demo decision, not an oversight.
 *
 * Kept as a pass-through rather than deleted from its twelve call sites, so the guard stays one
 * function to restore rather than twelve to re-thread.
 */
export async function requireAdmin(_request: Request): Promise<Response | null> {
  return null;
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

// Generic over the schema, not its type: a field with .default() has a different input and output
// type, and inferring from the input side makes every defaulted field look possibly-undefined.
export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<Parsed<output<S>>> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };

  return {
    ok: false,
    response: fail("VALIDATION_FAILED", {
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    }),
  };
}

/** Every handler body goes through this, so a thrown error is still a valid envelope. */
export async function handle(what: string, run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    console.error(`${what} failed:`, error);
    return fail("GUARD_UNAVAILABLE", { endpoint: what });
  }
}
