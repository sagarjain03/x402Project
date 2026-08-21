// OWNER: PAY. One-off. Generates the three Algorand TestNet accounts ASPG needs and prints
// them in every form the setup asks for. Run it once, paste the output into .env.local, done.
//
//   npm i -D algosdk
//   node src/payments/scripts/algo-keygen.mjs
//
// TESTNET ONLY. Never run this expecting a real wallet, never commit the output.
// Nothing here touches the network — key generation is pure local crypto.
import algosdk from "algosdk";

const ROLES = [
  { name: "AGENT", env: "AVM_PRIVATE_KEY", note: "the buyer. Needs ALGO + USDC + opt-in." },
  { name: "MERCHANT", env: "MERCHANT_ALGORAND_ADDRESS", note: "the seller. Needs ALGO + opt-in. No USDC." },
  { name: "ROGUE", env: "ROGUE_ALGORAND_ADDRESS", note: "drill D4 only. Needs nothing — the Guard blocks before signing." },
];

const out = {};

for (const role of ROLES) {
  const account = algosdk.generateAccount();
  const address = account.addr.toString();
  // toClientAvmSigner() wants base64 of the 64-byte secret key (32-byte seed + 32-byte public key),
  // which is exactly what algosdk hands back. No derivation, no algokit-utils alpha API.
  const base64 = Buffer.from(account.sk).toString("base64");
  out[role.name] = { address, base64 };

  console.log(`\n=== ${role.name} — ${role.note}`);
  console.log(`address  ${address}`);
  console.log(`base64   ${base64}`);
  console.log(`mnemonic ${algosdk.secretKeyToMnemonic(account.sk)}`);
}

console.log(`
================================================================
Paste into .env.local (git-ignored — keep it that way):

AVM_PRIVATE_KEY="${out.AGENT.base64}"
MERCHANT_ALGORAND_ADDRESS="${out.MERCHANT.address}"
ROGUE_ALGORAND_ADDRESS="${out.ROGUE.address}"
ALGORAND_ALGOD_URL="https://testnet-api.algonode.cloud"
X402_FACILITATOR_URL="https://facilitator.goplausible.xyz"

Next, and in this order:
  1. Fund with ALGO, both addresses (rogue needs nothing):
       AGENT     ${out.AGENT.address}
       MERCHANT  ${out.MERCHANT.address}
     https://lora.algokit.io/testnet/fund
  2. Opt BOTH into USDC, ASA 10458941. Skipping the merchant is the classic mistake.
  3. USDC for the AGENT only: https://faucet.circle.com  ->  Algorand Testnet
  4. Verify:  node src/payments/scripts/algo-check.mjs ${out.AGENT.address} ${out.MERCHANT.address}
================================================================`);
