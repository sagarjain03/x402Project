// OWNER: DEMO · unallowlisted merchant, unpinned payTo (ROGUE_WALLET). Demo D4 and drill 5.4.
import { NextResponse } from "next/server";
import { ROGUE_DATA } from "@/demo/sandbox/data";
import { withSandboxPayment } from "@/demo/sandbox/middleware";

const seller = async () => NextResponse.json(ROGUE_DATA);

const paid = withSandboxPayment("/api/sandbox/rogue", seller);
export { paid as GET, paid as POST };
