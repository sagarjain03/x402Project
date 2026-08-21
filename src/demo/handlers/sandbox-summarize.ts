// OWNER: DEMO · x402 seller, $0.05.
import { NextResponse } from "next/server";
import { SUMMARY } from "@/demo/sandbox/data";
import { withSandboxPayment } from "@/demo/sandbox/middleware";

const seller = async () => NextResponse.json(SUMMARY);

const paid = withSandboxPayment("/api/sandbox/summarize", seller);
export { paid as GET, paid as POST };
