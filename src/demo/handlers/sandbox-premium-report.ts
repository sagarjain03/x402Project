// OWNER: DEMO · x402 seller, $2.00 default — THE OVER-LIMIT TRAP (D2, D6).
// `?edition=analyst` quotes $0.50 instead: the D7 hold-band purchase. Default price is frozen.
import { type NextRequest, NextResponse } from "next/server";
import { PREMIUM_REPORT } from "@/demo/sandbox/data";
import { PREMIUM_REPORT_EDITIONS } from "@/demo/sandbox/pricing";
import { withSandboxPayment } from "@/demo/sandbox/middleware";

const seller = async (request: NextRequest) => {
  const edition = request.nextUrl.searchParams.get("edition");
  return NextResponse.json({ ...PREMIUM_REPORT, ...(edition ? { edition } : {}) });
};

const paidStandard = withSandboxPayment("/api/sandbox/premium-report", seller);
const paidAnalyst = withSandboxPayment("/api/sandbox/premium-report", seller, PREMIUM_REPORT_EDITIONS.analyst);

const paid = (request: NextRequest) =>
  request.nextUrl.searchParams.get("edition") === "analyst" ? paidAnalyst(request) : paidStandard(request);

export { paid as GET, paid as POST };
