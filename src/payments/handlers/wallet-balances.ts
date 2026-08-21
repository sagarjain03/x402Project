// OWNER: PAY · GET /api/v1/wallets/balances — what the two demo wallets actually hold, read
// straight off algod. The dashboard shows this beside the transfer list so "the payment settled"
// is checkable against the chain instead of believed from our own database.
//
// Only addresses leave this file. The agent address is DERIVED from AVM_PRIVATE_KEY rather than
// read from its own env var, so it can never drift from the key that signs: a balance panel
// showing a wallet that is not the one paying would be worse than no panel at all.
import crypto from "crypto";
import { ALGORAND_TESTNET_NETWORK_ID, ALGORAND_TESTNET_USDC_ASA, env } from "@/shared/env";
import { explorerAccountUrl } from "@/shared/explorer";
import { ok } from "@/shared/http";
import { toUsd } from "@/shared/money";

const DEFAULT_ALGOD = "https://testnet-api.algonode.cloud";
const USDC_ASA = Number(ALGORAND_TESTNET_USDC_ASA);
/** 0.1 account minimum + 0.1 per opted-in asset. Below this the account cannot transact at all. */
const MIN_ALGO_MICRO = 200_000n;

export interface WalletBalance {
  role: "agent" | "merchant";
  label: string;
  address: string;
  /** Null whenever the node could not be read. The UI must then say "unknown", never "0.00". */
  usdc: string | null;
  algo: string | null;
  /** An address that has not opted in to the ASA cannot receive USDC, however much ALGO it holds. */
  optedIn: boolean;
  /** Enough ALGO left to pay a fee and stay above the minimum balance. */
  fundedForFees: boolean;
  explorerUrl: string | null;
  error?: string;
}

/** The 64-byte secret key is seed + public key; the address is base32 of the last 32 bytes + sha512_256 checksum. */
function encodeAlgorandAddress(publicKey: Uint8Array): string {
  const hash = crypto.createHash("sha512-256").update(publicKey).digest();
  const checksum = hash.subarray(28, 32);
  const addrBytes = Buffer.concat([publicKey, checksum]);
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < addrBytes.length; i++) {
    value = (value << 8) | addrBytes[i];
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function agentAddress(): string {
  return encodeAlgorandAddress(Buffer.from(env.AVM_PRIVATE_KEY, "base64").subarray(32));
}

/** algod hands back JSON numbers. Truncate to an integer before widening — never a float. */
function micro(value: unknown): bigint {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? BigInt(Math.trunc(n)) : 0n;
}

async function readBalance(role: WalletBalance["role"], label: string, address: string): Promise<WalletBalance> {
  const base = {
    role,
    label,
    address,
    explorerUrl: explorerAccountUrl(ALGORAND_TESTNET_NETWORK_ID, address),
  };

  try {
    const algod = env.ALGORAND_ALGOD_URL || DEFAULT_ALGOD;
    const response = await fetch(`${algod}/v2/accounts/${address}`, { cache: "no-store" });
    // 404 means the address has never been funded, so the account does not exist on chain yet.
    // That is a real, reportable state — not a failure to read one.
    if (response.status === 404) {
      return { ...base, usdc: "0.00", algo: "0.00", optedIn: false, fundedForFees: false };
    }
    if (!response.ok) throw new Error(`algod returned ${response.status}`);

    const account = (await response.json()) as {
      amount?: number;
      assets?: { "asset-id": number; amount: number }[];
    };
    const algoMicro = micro(account.amount);
    const usdcAsset = (account.assets ?? []).find((asset) => asset["asset-id"] === USDC_ASA);

    return {
      ...base,
      algo: toUsd(algoMicro),
      usdc: usdcAsset ? toUsd(micro(usdcAsset.amount)) : "0.00",
      optedIn: Boolean(usdcAsset),
      fundedForFees: algoMicro >= MIN_ALGO_MICRO,
    };
  } catch (error) {
    // A node that will not answer must not blank the page. Report the wallet as unreadable and
    // let the transfer list below it — which comes from our own database — still render.
    return {
      ...base,
      usdc: null,
      algo: null,
      optedIn: false,
      fundedForFees: false,
      error: error instanceof Error ? error.message : "Balance lookup failed.",
    };
  }
}

export const GET = async (): Promise<Response> => {
  let wallets: WalletBalance[];
  try {
    wallets = await Promise.all([
      readBalance("agent", "Agent wallet (sender)", agentAddress()),
      readBalance("merchant", "Merchant wallet (recipient)", env.MERCHANT_ALGORAND_ADDRESS),
    ]);
  } catch (error) {
    // Only a missing or malformed env var reaches here; readBalance swallows its own network faults.
    return ok({
      network: ALGORAND_TESTNET_NETWORK_ID,
      asset: ALGORAND_TESTNET_USDC_ASA,
      wallets: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Wallet configuration is incomplete.",
    });
  }

  return ok({
    network: ALGORAND_TESTNET_NETWORK_ID,
    asset: ALGORAND_TESTNET_USDC_ASA,
    wallets,
    fetchedAt: new Date().toISOString(),
  });
};
