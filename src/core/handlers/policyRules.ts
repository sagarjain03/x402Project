// OWNER: CORE. The PolicyRules request shape and the version diff, shared by every policy handler.
// Validation here is the boundary between "an operator typed something" and the money path.
import { z } from "zod";
import { canonicalJson } from "@/core/audit/chain";
import { isAddress } from "@/shared/address";
import type { PolicyRules } from "@/shared/types";

const usd = z.string().regex(/^\d+(\.\d{1,6})?$/, "must be a decimal string like \"1.00\"");
const host = z.string().min(1).max(255);

export const policyRulesSchema = z.object({
  financial: z.object({
    maxPerTransactionUsd: usd,
    hourlyBudgetUsd: usd,
    dailyBudgetUsd: usd,
    monthlyBudgetUsd: usd,
  }),
  merchant: z.object({
    allowedMerchants: z.array(host),
    blockedMerchants: z.array(host),
    pinnedRecipients: z.record(
      z.string().refine(isAddress, "must be an Algorand (58-char base32) or EVM (0x) address"),
    ),
    unknownMerchantAction: z.enum(["BLOCK", "HOLD"]),
    enforceRecipientPinning: z.boolean(),
  }),
  velocity: z.object({
    maxTxPerMinute: z.number().int().min(0).max(10_000),
    maxTxPerHour: z.number().int().min(0).max(100_000),
    maxTxPerMerchantPerMinute: z.number().int().min(0).max(10_000),
  }),
  rail: z.object({
    allowedNetworks: z.array(z.string().min(1).max(80)),
    allowedAssets: z.array(z.string().min(1).max(80)),
  }),
  risk: z.object({
    autoApproveBelowUsd: usd,
    holdBetweenUsd: z.tuple([usd, usd]),
    blockAboveUsd: usd,
    riskHoldScore: z.number().int().min(0).max(100),
    riskBlockScore: z.number().int().min(0).max(100),
  }),
});

export const policyUpdateSchema = z.object({
  rules: policyRulesSchema,
  updatedByEmail: z.string().email().optional(),
});

/** Flat dotted paths that changed, so a reviewer sees the edit rather than two blobs of JSON. */
export function diffPolicyRules(
  before: PolicyRules | undefined,
  after: PolicyRules,
): { path: string; from: string | null; to: string }[] {
  const flatten = (value: unknown, prefix = ""): Record<string, string> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { [prefix]: canonicalJson(value) };
    }
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>(
      (accumulator, [key, nested]) =>
        Object.assign(accumulator, flatten(nested, prefix ? `${prefix}.${key}` : key)),
      {},
    );
  };

  const left = before ? flatten(before) : {};
  const right = flatten(after);

  return Object.keys(right)
    .filter((path) => left[path] !== right[path])
    .map((path) => ({ path, from: left[path] ?? null, to: right[path] }));
}
