// OWNER: DEMO. C5: every tool pays through the Guard, and a block comes back as data the model can use.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTools, callPaidTool, TOOL_ENDPOINTS, type ToolCallRecord } from "@/demo/agent/tools";

const envelope = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const gatewayOk = (response: unknown, txHash = "0xabc") =>
  envelope(200, { status: true, statusCode: 200, data: { onChain: { txHash }, response } });

afterEach(() => vi.unstubAllGlobals());

describe("buildTools", () => {
  it("exposes every paid endpoint as a tool", () => {
    const exposed = Object.keys(buildTools());
    for (const name of Object.keys(TOOL_ENDPOINTS)) {
      expect(exposed).toContain(name);
    }
  });

  // gpt-oss-120b calls summarize "summary" and Groq rejects the unknown name, ending the run.
  // The alias exists so a synonym cannot kill a live demo; it must stay pointed at a real tool.
  it("aliases summary onto summarize without inventing a sixth paid endpoint", () => {
    const exposed = Object.keys(buildTools());
    expect(exposed).toContain("summary");
    expect(Object.keys(TOOL_ENDPOINTS)).not.toContain("summary");
    expect(exposed.filter((name) => !(name in TOOL_ENDPOINTS))).toEqual(["summary"]);
  });

  it("search returns the merchant body on success and records the spend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(gatewayOk({ results: [{ title: "t" }] }, "0xfeed"));
    vi.stubGlobal("fetch", fetchMock);
    const calls: ToolCallRecord[] = [];

    const output = await buildTools((r) => calls.push(r)).search.execute!(
      { query: "x402" },
      { toolCallId: "t1", messages: [], context: {} },
    );

    expect(output).toEqual({ results: [{ title: "t" }] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).url).toMatch(/\/api\/sandbox\/search$/);
    // data carries the merchant body so the console can show what the payment bought.
    expect(calls).toEqual([
      { tool: "search", priceUsd: "0.02", status: "PAID", txHash: "0xfeed", data: { results: [{ title: "t" }] } },
    ]);
  });

  it("a 402 comes back as { blocked: true, code } so the model can adapt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(402, {
      status: false, statusCode: 402,
      message: "Amount $2.00 exceeds the per-transaction limit of $0.10.",
      error: { code: "PER_TRANSACTION_LIMIT_EXCEEDED" },
    })));
    const calls: ToolCallRecord[] = [];

    const output = await buildTools((r) => calls.push(r)).premiumReport.execute!(
      { topic: "EV batteries" },
      { toolCallId: "t2", messages: [], context: {} },
    );

    expect(output).toEqual({
      blocked: true,
      code: "PER_TRANSACTION_LIMIT_EXCEEDED",
      message: "Amount $2.00 exceeds the per-transaction limit of $0.10.",
    });
    expect(calls).toEqual([
      { tool: "premiumReport", priceUsd: "2.00", status: "BLOCKED", code: "PER_TRANSACTION_LIMIT_EXCEEDED" },
    ]);
  });

  it("callPaidTool reports a dead Guard as a block, never a throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const output = await callPaidTool("summarize", { topic: "x" });
    expect(output).toMatchObject({ blocked: true, code: "GUARD_UNAVAILABLE" });
  });
});
