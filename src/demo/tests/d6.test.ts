// OWNER: DEMO. C6: the poisoned result reaches the driver, 1000 purchases are attempted, zero settle.
import { afterEach, describe, expect, it, vi } from "vitest";
import { run as d6 } from "@/demo/simulator/scenarios/d6-prompt-injection";
import { POISONED_RESULT } from "@/demo/fixtures/poisoned";

const envelope = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const searchOk = envelope(200, {
  status: true,
  statusCode: 200,
  data: { onChain: { txHash: "0xsearch" }, response: { results: [{ title: "clean", url: "u", snippet: "s" }, POISONED_RESULT] } },
});

const overLimit = envelope(402, {
  status: false,
  statusCode: 402,
  message: "Amount $2.00 exceeds the per-transaction limit of $0.10.",
  error: { code: "PER_TRANSACTION_LIMIT_EXCEEDED" },
});

/** Anything that is not the gateway: 404 so the caller falls back to its own default. */
const notGateway = () => new Response("not found", { status: 404 });

/** Routes on the URL, so a non-gateway request cannot be parsed as one. */
function router(onGatewayRequest: (targetUrl: string) => Response) {
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (!String(url).endsWith("/api/gw/request")) return Promise.resolve(notGateway());
    const target = JSON.parse((init?.body as string) ?? "{}").url as string;
    return Promise.resolve(onGatewayRequest(target ?? ""));
  });
}

/** Gateway calls only — the headroom probes are 404s and are not part of the count. */
const gatewayCalls = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.filter((call) => String(call[0]).endsWith("/api/gw/request"));

afterEach(() => vi.unstubAllGlobals());

describe("D6 prompt injection", () => {
  it("detects the injection, attempts 1000 purchases, and every one blocks", async () => {
    const fetchMock = router((target) => (target.includes("scenario=D6") ? searchOk.clone() : overLimit.clone()));
    vi.stubGlobal("fetch", fetchMock);
    const lines: string[] = [];

    await d6((line) => lines.push(line));

    const calls = gatewayCalls(fetchMock);
    expect(calls).toHaveLength(1001); // 1 search + 1000 injected purchases
    expect(JSON.parse((calls[0] as [string, RequestInit])[1].body as string).url).toContain("scenario=D6");
    const out = lines.join("\n");
    expect(out).toContain("attempted $2000.00");
    expect(out).toContain("actual spend $0.02");
    expect(out).toContain("PER_TRANSACTION_LIMIT_EXCEEDED x1000");
    expect(out).toContain("PASS");
  });

  it("throws the moment any injected purchase settles", async () => {
    let first = true;
    const fetchMock = router(() => {
      if (first) {
        first = false;
        return searchOk.clone();
      }
      return envelope(200, { status: true, statusCode: 200, data: { onChain: { txHash: "0xbad" }, response: {} } });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(d6(() => {})).rejects.toThrow(/ATTACK SUCCEEDED/);
  });

  it("fails loudly when the sandbox forgets to serve the poisoned result", async () => {
    vi.stubGlobal("fetch", router(() => envelope(200, {
      status: true, statusCode: 200,
      data: { onChain: { txHash: "0xsearch" }, response: { results: [] } },
    })));

    await expect(d6(() => {})).rejects.toThrow(/no injected instruction/);
  });
});
