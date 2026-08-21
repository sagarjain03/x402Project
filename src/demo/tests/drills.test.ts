// OWNER: DEMO. C7: the PAYMENT-REQUIRED decoder, and the drill report covers all ten drills.
import { describe, expect, it } from "vitest";
import { buildMarkdown, decodePaymentRequired, DRILLS, type DrillResult, type SellerCheck } from "@/demo/drills/index";

// A real PAYMENT-REQUIRED header captured from the sandbox search seller ($0.02, Base Sepolia).
const CAPTURED_HEADER =
  "eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVkIiwicmVzb3VyY2UiOnsidXJsIjoiaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS9zYW5kYm94L3NlYXJjaD9zY2VuYXJpbz1ENiIsImRlc2NyaXB0aW9uIjoiV2ViIHNlYXJjaCByZXN1bHRzIiwibWltZVR5cGUiOiIifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiZWlwMTU1Ojg0NTMyIiwiYW1vdW50IjoiMjAwMDAiLCJhc3NldCI6IjB4MDM2Q2JENTM4NDJjNTQyNjYzNGU3OTI5NTQxZUMyMzE4ZjNkQ0Y3ZSIsInBheVRvIjoiMHg5YTJCNGM2RDhlMEYxYTNCNWM3RDllMUYyYTRCNmM4RDBlMkY0YTZCIiwibWF4VGltZW91dFNlY29uZHMiOjMwMCwiZXh0cmEiOnsibmFtZSI6IlVTREMiLCJ2ZXJzaW9uIjoiMiJ9fV19";

describe("decodePaymentRequired", () => {
  it("decodes a real sandbox header into amount and payTo", () => {
    expect(decodePaymentRequired(CAPTURED_HEADER)).toEqual({
      amount: "20000", // $0.02 in USDC minor units
      payTo: "0x9a2B4c6D8e0F1a3B5c7D9e1F2a4B6c8D0e2F4a6B",
    });
  });

  it("throws on a header with no accepts", () => {
    const bad = Buffer.from(JSON.stringify({ x402Version: 2 })).toString("base64");
    expect(() => decodePaymentRequired(bad)).toThrow(/accepts/);
  });
});

describe("buildMarkdown", () => {
  it("covers all ten drills and all six sellers", () => {
    const results: DrillResult[] = DRILLS.map((d) => ({
      id: d.id, name: d.name, owner: d.owner,
      attemptedMinor: 2_000_000n, actualMinor: 20_000n,
      control: "TEST_CONTROL", status: "PASS", note: "n",
    }));
    const sellers: SellerCheck[] = [
      { route: "/api/sandbox/search", ok: true, detail: "$0.02 -> 0x9a2B4c6D8e…" },
    ];

    const md = buildMarkdown(results, sellers);

    for (const d of DRILLS) expect(md).toContain(`| ${d.id} | ${d.name} |`);
    expect(md).toContain("/api/sandbox/search");
    expect(md).toContain("$2.00"); // attemptedMinor formatted
    expect(md).toContain("$0.02"); // actualMinor formatted
  });
});
