// OWNER: DEMO · x402 seller, $0.08. Used by demo D3 for the velocity loop.
import { NextResponse } from "next/server";
import { FACT_CHECK } from "@/demo/sandbox/data";
import { withSandboxPayment } from "@/demo/sandbox/middleware";

const seller = async () => NextResponse.json(FACT_CHECK);

const paid = withSandboxPayment("/api/sandbox/fact-check", seller);
export { paid as GET, paid as POST };
