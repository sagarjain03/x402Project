// OWNER: DEMO · x402 seller, $0.03.
import { NextResponse } from "next/server";
import { EXTRACTED_DOC } from "@/demo/sandbox/data";
import { withSandboxPayment } from "@/demo/sandbox/middleware";

const seller = async () => NextResponse.json(EXTRACTED_DOC);

const paid = withSandboxPayment("/api/sandbox/extract", seller);
export { paid as GET, paid as POST };
