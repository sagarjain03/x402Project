// OWNER: DEMO · POST /api/v1/agent/run · streams one agent run as newline-delimited JSON.
//
// NDJSON rather than SSE: this is a POST with a body, and EventSource cannot send one. Each line
// is one complete JSON event, so the client reads with a plain fetch reader and needs no library.
//
// Like the SSE endpoint, this does not use the API envelope — there is no single JSON body to wrap.
// A failure before the stream opens is an ordinary envelope; a failure after it opens arrives as an
// `error` event inside the stream, because by then the status code has already been sent.
import { z } from "zod";
import { runAgentStream, type RunEvent } from "@/demo/agent/runStream";
import { fail } from "@/shared/http";

const bodySchema = z.object({
  driver: z.enum(["live", "scripted"]).default("live"),
  task: z.string().max(2000).optional(),
  scenario: z.string().max(20).optional(),
  guardKey: z.string().max(200).optional(),
  agentName: z.string().max(120).optional(),
  budgetUsd: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", { issues: parsed.error.flatten().fieldErrors }, "Request body is invalid.");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (event: RunEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client navigated away mid-run. Stop writing; the run itself is already bounded.
          open = false;
        }
      };

      // runAgentStream turns its own failures into an `error` event, so this catch is only for a
      // fault in the emit path itself. Either way the stream must close, or the page hangs.
      try {
        await runAgentStream({ ...parsed.data, signal: request.signal }, emit);
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Nginx and friends buffer a streamed response into uselessness without this.
      "X-Accel-Buffering": "no",
    },
  });
}
