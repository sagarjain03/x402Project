// OWNER: PAY. Finishes TestNet setup without touching a faucet: moves a little ALGO from the
// agent to the merchant, then opts BOTH accounts into USDC. Idempotent — every action is skipped
// if it has already happened, so re-running after a partial failure is safe.
//
//   node src/payments/scripts/algo-setup.mjs <AGENT_BASE64> <MERCHANT_BASE64>
//
// Keys are passed as arguments, not read from .env.local, on purpose: the merchant key is needed
// exactly once (its opt-in) and must never end up somewhere runtime code can reach it.
// TESTNET ONLY.
import algosdk from "algosdk";

const ALGOD = process.env.ALGORAND_ALGOD_URL ?? "https://testnet-api.algonode.cloud";
const USDC_ASA = 10458941;
const TOP_UP_MICRO = 1_000_000n; // 1 ALGO — covers the 0.1 account + 0.1 asset minimum, with room
const MERCHANT_FLOOR_MICRO = 500_000n; // below this the merchant gets topped up
const AGENT_FLOOR_MICRO = 1_500_000n; // refuse to send if it would strand the agent

const [agentKey, merchantKey] = process.argv.slice(2);
if (!agentKey || !merchantKey) {
  console.error("usage: node algo-setup.mjs <AGENT_BASE64> <MERCHANT_BASE64>");
  console.error("       both values are the 88-character `base64` lines printed by algo-keygen.mjs");
  process.exit(2);
}

/** algosdk wants the raw 64-byte secret key; algo-keygen prints it base64-encoded. */
function accountFromBase64(base64, label) {
  const sk = Buffer.from(base64.trim(), "base64");
  if (sk.length !== 64) {
    console.error(`${label} key is ${sk.length} bytes, expected 64. Did you paste the address by mistake?`);
    process.exit(2);
  }
  return { sk: new Uint8Array(sk), addr: algosdk.encodeAddress(sk.subarray(32)) };
}

const agent = accountFromBase64(agentKey, "AGENT");
const merchant = accountFromBase64(merchantKey, "MERCHANT");
const algod = new algosdk.Algodv2("", ALGOD, "");

async function readAccount(address) {
  const response = await fetch(`${ALGOD}/v2/accounts/${address}`);
  if (!response.ok) return { micro: 0n, optedIn: false };
  const account = await response.json();
  return {
    micro: BigInt(account.amount),
    optedIn: (account.assets ?? []).some((asset) => asset["asset-id"] === USDC_ASA),
  };
}

async function submit(txn, sk, description) {
  const { txid } = await algod.sendRawTransaction(txn.signTxn(sk)).do();
  await algosdk.waitForConfirmation(algod, txid, 4);
  console.log(`  done — ${description}`);
  console.log(`  https://lora.algokit.io/testnet/transaction/${txid}`);
}

const algo = (micro) => (Number(micro) / 1e6).toFixed(6);

console.log(`AGENT    ${agent.addr}`);
console.log(`MERCHANT ${merchant.addr}\n`);

let agentState = await readAccount(agent.addr);
let merchantState = await readAccount(merchant.addr);
console.log(`before: agent ${algo(agentState.micro)} ALGO · merchant ${algo(merchantState.micro)} ALGO\n`);

// --- 1. top the merchant up out of the agent's balance -----------------------------------------
if (merchantState.micro >= MERCHANT_FLOOR_MICRO) {
  console.log("[1/3] merchant already funded — skipped");
} else if (agentState.micro < AGENT_FLOOR_MICRO + TOP_UP_MICRO) {
  console.error(`[1/3] agent has only ${algo(agentState.micro)} ALGO — too little to share. Use a faucet.`);
  process.exit(1);
} else {
  console.log(`[1/3] sending 1 ALGO: agent -> merchant`);
  await submit(
    algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: agent.addr,
      receiver: merchant.addr,
      amount: TOP_UP_MICRO,
      suggestedParams: await algod.getTransactionParams().do(),
    }),
    agent.sk,
    "merchant funded",
  );
  merchantState = await readAccount(merchant.addr);
}

// --- 2 & 3. opt each account into USDC ----------------------------------------------------------
// An opt-in is a zero-amount transfer of the asset from an account to itself. That is the whole
// trick — there is no special "opt-in" transaction type.
for (const [step, account, state] of [["2/3", agent, agentState], ["3/3", merchant, merchantState]]) {
  const label = account === agent ? "agent" : "merchant";
  if (state.optedIn) {
    console.log(`[${step}] ${label} already opted in to USDC — skipped`);
    continue;
  }
  console.log(`[${step}] opting ${label} in to USDC (ASA ${USDC_ASA})`);
  await submit(
    algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender: account.addr,
      receiver: account.addr,
      assetIndex: USDC_ASA,
      amount: 0,
      suggestedParams: await algod.getTransactionParams().do(),
    }),
    account.sk,
    `${label} opted in`,
  );
}

agentState = await readAccount(agent.addr);
merchantState = await readAccount(merchant.addr);
console.log(`\nafter:  agent ${algo(agentState.micro)} ALGO (USDC ${agentState.optedIn ? "opted in" : "NOT opted in"})`);
console.log(`        merchant ${algo(merchantState.micro)} ALGO (USDC ${merchantState.optedIn ? "opted in" : "NOT opted in"})`);
console.log(`\nNext: get USDC for the AGENT only at https://faucet.circle.com (choose Algorand Testnet),`);
console.log(`then: node src/payments/scripts/algo-check.mjs ${agent.addr} ${merchant.addr}`);
