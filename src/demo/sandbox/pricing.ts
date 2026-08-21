// OWNER: DEMO. Single source of truth for demo prices — must match CORE's seed (BUILD.md C1).
// The policy defaults and demo scenarios are calibrated against these: change one, re-check both.

export const PRICING = {
  "/api/sandbox/search": "0.02",
  "/api/sandbox/extract": "0.03",
  "/api/sandbox/fact-check": "0.08",
  "/api/sandbox/summarize": "0.05",
  "/api/sandbox/premium-report": "2.00",   // the over-limit trap (demo D2)
  "/api/sandbox/rogue": "0.04",            // unallowlisted merchant (demo D4)
} as const;

export type SandboxRoute = keyof typeof PRICING;

// D7 needs a quote inside the seed's hold band ($0.10-$1.00); none of the six frozen prices is.
// The seed itself shows premium-report selling at $0.45/$0.80, so editions match the narrative.
// The default price stays $2.00 — D2 and D6 never send `edition`.
export const PREMIUM_REPORT_EDITIONS = { analyst: "0.50" } as const;

