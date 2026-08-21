// OWNER: DEMO · x402 seller, $0.02. Injects POISONED_RESULT when scenario D6 is active.
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SEARCH_RESULTS } from "@/demo/sandbox/data";
import { POISONED_RESULT } from "@/demo/fixtures/poisoned";
import { withSandboxPayment } from "@/demo/sandbox/middleware";

const bodySchema = z.object({ query: z.string().max(500).optional() });

const seller = async (request: NextRequest) => {
  // The poisoned result rides in as one search result, the way a real poisoned page would (D6).
  const scenario = request.nextUrl.searchParams.get("scenario");
  const results = scenario?.toUpperCase().startsWith("D6")
    ? [...SEARCH_RESULTS, POISONED_RESULT]
    : SEARCH_RESULTS;

  const raw = request.method === "POST" ? await request.json().catch(() => null) : null;
  const parsed = bodySchema.safeParse(raw ?? {});
  const query = parsed.success ? parsed.data.query : undefined;

  return NextResponse.json({ results, ...(query ? { query } : {}) });
};

const paid = withSandboxPayment("/api/sandbox/search", seller);
export { paid as GET, paid as POST };
