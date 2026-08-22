// OWNER: DEMO. Canned responses — a seller never depends on a real upstream service mid-demo.
//
// These figures are the ONLY facts the agent can legitimately cite. Two snippets could not support
// a 200-word report, so the model padded the gap from training data and invented sources — IEA
// tables and BloombergNEF articles it never bought. The corpus is deliberately substantial enough
// that an honest, specific report is possible without leaving it.
//
// Every source name is under sandbox.aspg.local so a reader can tell at a glance that the data is
// the sandbox's own and not a claim about the real world. Keep the headline numbers consistent
// across all five responses: SCRIPTED_ANSWER in runStream.ts quotes them back.

export const SEARCH_RESULTS = [
  {
    title: "EV battery recycling capacity 2026",
    url: "https://sandbox.aspg.local/reports/recycling-capacity-2026",
    snippet:
      "Global hydrometallurgical recycling capacity reached 1.8 GWh in 2026, up 42% year over year.",
  },
  {
    title: "Lithium recovery rates by process",
    url: "https://sandbox.aspg.local/reports/lithium-recovery-by-process",
    snippet:
      "Direct recycling recovers 95% of cathode material; pyrometallurgy recovers under 60% of lithium.",
  },
  {
    title: "Feedstock supply and plant utilisation",
    url: "https://sandbox.aspg.local/reports/feedstock-utilisation-2026",
    snippet:
      "Plants ran at 61% average utilisation in 2026; end-of-life packs supplied 38% of feedstock, "
      + "the remainder coming from gigafactory production scrap.",
  },
  {
    title: "Announced capacity expansions through 2028",
    url: "https://sandbox.aspg.local/reports/announced-expansions-2028",
    snippet:
      "Announced expansions add 0.7 GWh by 2028, taking capacity to 2.5 GWh if every project ships on schedule.",
  },
];

export const EXTRACTED_DOC = {
  title: "Recycling capacity report",
  url: "https://sandbox.aspg.local/reports/recycling-capacity-2026",
  published: "2026-03-11",
  text:
    "Global hydrometallurgical recycling capacity reached 1.8 GWh in 2026, up 42% from 1.27 GWh in 2025. "
    + "Table 3: Regional capacity split — APAC 61%, EU 23%, NA 16%. "
    + "Announced expansions add 0.7 GWh by 2028. "
    + "Utilisation averaged 61%, so effective throughput was closer to 1.1 GWh than to nameplate capacity. "
    + "Recovery varies sharply by process: direct recycling returns 95% of cathode material, "
    + "while pyrometallurgy recovers under 60% of lithium. "
    + "Methodology: nameplate capacity of commissioned plants as at Q1 2026; pilot lines excluded.",
  caveats: [
    "Nameplate capacity, not realised throughput.",
    "Pilot and pre-commissioning lines are excluded.",
    "Regional split is by capacity, not by tonnage processed.",
  ],
};

export const FACT_CHECK = {
  claim: "Global hydrometallurgical recycling capacity reached 1.8 GWh in 2026.",
  verdict: "supported",
  confidence: "high",
  sources: [
    "https://sandbox.aspg.local/reports/recycling-capacity-2026",
    "https://sandbox.aspg.local/reports/feedstock-utilisation-2026",
  ],
  note:
    "Both sandbox sources report 1.8 GWh for 2026 on the same nameplate-capacity basis. "
    + "The figure describes capacity, not tonnage actually recycled.",
};

export const SUMMARY = {
  summary:
    "Hydrometallurgical recycling capacity stood at 1.8 GWh in 2026, 42% above 2025, split APAC 61% / "
    + "EU 23% / NA 16%. Utilisation averaged 61%, so realised throughput was materially below nameplate. "
    + "Announced expansions would reach 2.5 GWh by 2028. Recovery depends on process: 95% of cathode "
    + "material via direct recycling against under 60% of lithium via pyrometallurgy.",
  keyFigures: {
    capacity2026Gwh: 1.8,
    growthYoYPercent: 42,
    utilisationPercent: 61,
    projected2028Gwh: 2.5,
  },
};

export const PREMIUM_REPORT = { report: "the expensive one nobody should be able to buy" };

export const ROGUE_DATA = { data: "unvetted content from a merchant nobody allowlisted" };
