// OWNER: PAY. Typed environment access, read through getters so a missing key fails
// at first use rather than at import time — importing must never break the build.

function required(name: string): string {
  const value = process.env[name];
  // .env.example ships "0x..." placeholders. Treat them as unset, so the error names the
  // variable instead of surfacing as a curve or address error deep inside a library.
  if (!value || value === "0x...") throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  get DATABASE_URL() { return required("DATABASE_URL"); },
  /** Base64 of the 64-byte Algorand secret key (32-byte seed + 32-byte public key). */
  get AVM_PRIVATE_KEY() { return required("AVM_PRIVATE_KEY"); },
  /** Unset is fine — the SDK falls back to AlgoNode's public TestNet node, which needs no token. */
  get ALGORAND_ALGOD_URL() { return process.env.ALGORAND_ALGOD_URL ?? ""; },
  get MERCHANT_ALGORAND_ADDRESS() { return required("MERCHANT_ALGORAND_ADDRESS"); },
  get ROGUE_ALGORAND_ADDRESS() { return required("ROGUE_ALGORAND_ADDRESS"); },
  get X402_FACILITATOR_URL() { return required("X402_FACILITATOR_URL"); },
  get GUARD_HMAC_SECRET() { return required("GUARD_HMAC_SECRET"); },
  get APP_URL() { return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"; },
  get GROQ_API_KEY() { return process.env.GROQ_API_KEY ?? ""; },
  get USE_MOCKS() { return process.env.USE_MOCKS === "1"; },
};

// Base is no longer a rail we pay on. These stay because the header decoder still recognises an
// EVM offer: a seller quoting Base is then refused by the policy engine as NETWORK_NOT_ALLOWED,
// which is a decision we can show, rather than an unreadable-header error we cannot explain.
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// The values the x402 wire actually carries. Policies allowlist these exact strings, so a symbol
// like "USDC" must never appear in an allowlist — it is merchant-supplied and therefore forgeable.
export const BASE_SEPOLIA_NETWORK_ID = "eip155:84532";
export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Algorand TestNet, captured off a live PAYMENT-REQUIRED header rather than copied from a constant.
// The SDK's ALGORAND_TESTNET_CAIP2 is the truncated form it uses internally after normalising, and
// it never reaches the wire — allowlisting that one instead blocks every payment. See fixtures.ts.
export const ALGORAND_TESTNET_NETWORK_ID = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";
/** USDC on Algorand is an ASA, identified by a number, not a contract address. 6 decimals, as on Base. */
export const ALGORAND_TESTNET_USDC_ASA = "10458941";

