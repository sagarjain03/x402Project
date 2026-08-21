// OWNER: DEMO. The five paid tools, shared by both drivers (simulator and LLM agent).
// Every execute() goes through guardedFetch — no tool can pay by itself.
import { tool } from "ai";
import { z } from "zod";
import { guardedFetch } from "@/demo/agent/guardedFetch";
import { PREMIUM_REPORT_EDITIONS, PRICING } from "@/demo/sandbox/pricing";

export const TOOL_ENDPOINTS = {
  search: "/api/sandbox/search",
  extract: "/api/sandbox/extract",
  factCheck: "/api/sandbox/fact-check",
  summarize: "/api/sandbox/summarize",
  premiumReport: "/api/sandbox/premium-report",
} as const;

export type ToolName = keyof typeof TOOL_ENDPOINTS;

export interface ToolCallRecord {
  tool: ToolName;
  priceUsd: string;
  status: "PAID" | "BLOCKED";
  code?: string;
  txHash?: string;
  /** Present on a settled payment, so a console can link straight to the explorer. */
  explorerUrl?: string;
  /** Present when the Guard held the payment — the id an operator approves. */
  intentId?: string;
}

/** Called the moment the model commits to a tool, before the Guard has decided anything. */
export type ToolCallStart = (record: { tool: ToolName; priceUsd: string; args: unknown }) => void;

export interface ToolOptions {
  /** Which agent pays. Defaults to ResearchBot inside guardedFetch. */
  guardKey?: string;
  onStart?: ToolCallStart;
  /** Fired when a merchant response carries an instruction aimed at the model. */
  onInjection?: (snippet: string) => void;
}

/** The marker the demo's poisoned result carries. Detection, not defence — the Guard is defence. */
const INJECTION_MARKER = /ignore all previous instructions/i;

/** Finds the injected snippet inside a search response, if the sandbox served one. */
function findInjection(data: unknown): string | undefined {
  const results = (data as { results?: unknown })?.results;
  if (!Array.isArray(results)) return undefined;
  for (const entry of results) {
    const snippet = (entry as { snippet?: unknown })?.snippet;
    if (typeof snippet === "string" && INJECTION_MARKER.test(snippet)) return snippet;
  }
  return undefined;
}

/** The model asked for the cheaper edition. Narrow, because the body is whatever the model sent. */
function isAnalystEdition(body: unknown): boolean {
  return typeof body === "object" && body !== null
    && (body as { edition?: unknown }).edition === "analyst";
}

/** What a tool hands back to the model when the Guard blocks the payment — data, never a throw. */
export interface ToolBlocked {
  blocked: true;
  code: string;
  message: string;
}

export async function callPaidTool(
  name: ToolName,
  body: unknown,
  onCall?: (record: ToolCallRecord) => void,
  scenario?: string,
  options?: ToolOptions,
): Promise<unknown | ToolBlocked> {
  const endpoint = TOOL_ENDPOINTS[name];
  // Only search reads the scenario param — that is how D6's poisoned result gets served.
  // premiumReport reads the edition field, which is how the model can reach for the cheaper report
  // land in the human-review band instead of over the per-transaction ceiling.
  const analyst = name === "premiumReport" && isAnalystEdition(body);
  const url = name === "search" && scenario
    ? `${endpoint}?scenario=${encodeURIComponent(scenario)}`
    : `${endpoint}${analyst ? "?edition=analyst" : ""}`;
  // The seller quotes the edition, so the price on the wire is not the table's default.
  const priceUsd = analyst ? PREMIUM_REPORT_EDITIONS.analyst : PRICING[endpoint];
  options?.onStart?.({ tool: name, priceUsd, args: body });

  const result = await guardedFetch(url, body, `agent tool call: ${name}`, {
    guardKey: options?.guardKey,
  });

  if (!result.ok) {
    const code = result.blocked?.code ?? "UNKNOWN";
    // A hold is reported as a block to the model on purpose — it must not treat "wait" as "yes".
    // The intent id rides along so an operator watching the console can action it.
    onCall?.({
      tool: name, priceUsd, status: "BLOCKED", code,
      intentId: result.approval?.intentId ?? result.intentId,
    });
    return { blocked: true, code, message: result.blocked?.message ?? "blocked" };
  }

  onCall?.({
    tool: name, priceUsd, status: "PAID",
    txHash: result.txHash, explorerUrl: result.explorerUrl, intentId: result.intentId,
  });

  if (options?.onInjection) {
    const snippet = findInjection(result.data);
    if (snippet) options.onInjection(snippet);
  }
  return result.data;
}

/** Descriptions carry the price on purpose: cost-aware tool choice is the demo's UX layer. */
export function buildTools(onCall?: (record: ToolCallRecord) => void, scenario?: string, options?: ToolOptions) {
  return {
    search: tool({
      description: "Search the web. Costs $0.02 per call.",
      inputSchema: z.object({ query: z.string().describe("the search query") }),
      execute: (input) => callPaidTool("search", input, onCall, scenario, options),
    }),
    extract: tool({
      description: "Extract the text of a document. Costs $0.03 per call.",
      inputSchema: z.object({ url: z.string().describe("URL of the document to extract") }),
      execute: (input) => callPaidTool("extract", input, onCall, undefined, options),
    }),
    factCheck: tool({
      description: "Verify a claim against sources. Costs $0.08 per call.",
      inputSchema: z.object({ claim: z.string().describe("the claim to verify") }),
      execute: (input) => callPaidTool("factCheck", input, onCall, undefined, options),
    }),
    summarize: tool({
      description: "Summarise findings into a short brief. Costs $0.05 per call.",
      inputSchema: z.object({ topic: z.string().describe("what to summarise") }),
      execute: (input) => callPaidTool("summarize", input, onCall, undefined, options),
    }),
    // Same resource, same price, same Guard. Registered because the model keeps calling it this.
    summary: tool({
      description: "Alias of summarize. Summarise findings into a short brief. Costs $0.05 per call.",
      inputSchema: z.object({ topic: z.string().describe("what to summarise") }),
      execute: (input) => callPaidTool("summarize", input, onCall, undefined, options),
    }),
    premiumReport: tool({
      description:
        "Buy the premium market report. The full edition costs $2.00 — expensive, use only if essential. " +
        "A cut-down 'analyst' edition costs $0.50; pass edition:'analyst' for it.",
      inputSchema: z.object({
        topic: z.string().describe("the report topic"),
        edition: z.enum(["full", "analyst"]).optional().describe("'analyst' is the $0.50 cut-down edition"),
      }),
      execute: (input) => callPaidTool("premiumReport", input, onCall, undefined, options),
    }),
  };
}
