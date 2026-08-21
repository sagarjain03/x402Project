// OWNER: DEMO. C2 done-when: all three gateway mappings, and a 402 that resolves instead of throwing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { guardedFetch } from "@/demo/agent/guardedFetch";

const envelope = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("guardedFetch", () => {
  it("posts to the Guard with the key, the url and the reason", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(200, {
      status: true, statusCode: 200,
      data: { onChain: { txHash: "0xabc" }, response: { results: [] } },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await guardedFetch("/api/sandbox/search", { query: "x402" }, "research x402 adoption");

    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toMatch(/\/api\/gw\/request$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Guard-Key"]).toBe("gk_live_researchbot_demo");
    expect(JSON.parse(init.body as string)).toEqual({
      url: expect.stringMatching(/\/api\/sandbox\/search$/),
      method: "POST",
      body: { query: "x402" },
      reason: "research x402 adoption",
    });
  });

  it("forwards the caller ceiling as maxAmountUsd when given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(envelope(402, {
      status: false, statusCode: 402, message: "blocked",
      error: { code: "PER_TRANSACTION_LIMIT_EXCEEDED" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await guardedFetch("/api/sandbox/premium-report", {}, "buy report", { maxAmountUsd: "0.10" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).maxAmountUsd).toBe("0.10");
  });

  it("maps 200 to ok with the merchant body and the tx hash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(200, {
      status: true, statusCode: 200,
      data: {
        intentId: "intent_1", decision: "ALLOW",
        onChain: { signed: true, txHash: "0xdeadbeef" },
        response: { results: [{ title: "EV battery recycling capacity 2026" }] },
      },
    })));

    const result = await guardedFetch("/api/sandbox/search", {}, "search");

    expect(result).toEqual({
      ok: true,
      data: { results: [{ title: "EV battery recycling capacity 2026" }] },
      txHash: "0xdeadbeef",
      explorerUrl: undefined,
      // Read straight off the success envelope, which is what lets the console link a settled
      // payment to its own decision trace and not only the held ones.
      intentId: "intent_1",
    });
  });

  it("maps 402 to blocked data and resolves instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(402, {
      status: false, statusCode: 402,
      message: "Transaction amount $2.00 exceeds the per-transaction limit of $0.10.",
      error: { code: "PER_TRANSACTION_LIMIT_EXCEEDED", details: { requested: "2.00" } },
    })));

    const result = await guardedFetch("/api/sandbox/premium-report", {}, "buy the premium dataset");

    expect(result).toEqual({
      ok: false,
      blocked: {
        code: "PER_TRANSACTION_LIMIT_EXCEEDED",
        message: "Transaction amount $2.00 exceeds the per-transaction limit of $0.10.",
      },
      intentId: undefined,
    });
  });

  it("maps 202 APPROVAL_REQUIRED to blocked data, still without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(envelope(202, {
      status: false, statusCode: 202,
      message: "Payment is awaiting human review.",
      error: { code: "APPROVAL_REQUIRED", details: { intentId: "intent_9", expiresAt: "2026-08-15T09:15:00Z" } },
    })));

    const result = await guardedFetch("/api/sandbox/summarize", {}, "summarise");

    expect(result).toEqual({
      ok: false,
      blocked: { code: "APPROVAL_REQUIRED", message: "Payment is awaiting human review." },
      approval: { intentId: "intent_9", expiresAt: "2026-08-15T09:15:00Z" },
      // A held payment has a record like any other; the console links to it.
      intentId: "intent_9",
    });
  });

  it("fails closed when the Guard is unreachable or unreadable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
    const offline = await guardedFetch("/api/sandbox/search", {}, "search");
    expect(offline.ok).toBe(false);
    expect(offline.blocked?.code).toBe("GUARD_UNAVAILABLE");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })));
    const garbage = await guardedFetch("/api/sandbox/search", {}, "search");
    expect(garbage.ok).toBe(false);
    expect(garbage.blocked?.code).toBe("GUARD_UNAVAILABLE");
  });
});
