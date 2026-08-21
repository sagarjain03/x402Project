// OWNER: PAY. Reads TestNet balances straight off the public algod node. Zero dependencies —
// deliberately plain fetch, so it stays a check independent of whatever the SDK believes.
//
//   node src/payments/scripts/algo-check.mjs <ADDRESS> [<ADDRESS> ...]
//
// Gate for phase A1: every address must show ALGO > 0 and USDC "opted in".
// A merchant reading 0.000000 USDC is correct — it only has to be able to receive.
const ALGOD = process.env.ALGORAND_ALGOD_URL ?? "https://testnet-api.algonode.cloud";
const USDC_ASA = 10458941;
const MIN_ALGO = 0.2; // 0.1 account minimum + 0.1 per opted-in asset, both locked not spent

const addresses = process.argv.slice(2);
if (addresses.length === 0) {
  console.error("usage: node algo-check.mjs <ADDRESS> [<ADDRESS> ...]");
  process.exit(2);
}

let failed = false;

for (const address of addresses) {
  const response = await fetch(`${ALGOD}/v2/accounts/${address}`);
  if (!response.ok) {
    // 404 here means the address has never been funded, so the account does not exist yet.
    console.log(`\n${address}\n  UNFUNDED — algod returned ${response.status}. Run the faucet first.`);
    failed = true;
    continue;
  }

  const account = await response.json();
  const algo = account.amount / 1e6;
  const usdc = (account.assets ?? []).find((asset) => asset["asset-id"] === USDC_ASA);

  console.log(`\n${address}`);
  console.log(`  ALGO  ${algo.toFixed(6)}${algo < MIN_ALGO ? `  LOW — need at least ${MIN_ALGO}` : ""}`);
  console.log(`  USDC  ${usdc ? `${(usdc.amount / 1e6).toFixed(6)}  (opted in)` : "NOT OPTED IN — payments to this address cannot settle"}`);

  if (algo < MIN_ALGO || !usdc) failed = true;
}

console.log(failed ? "\nNOT READY — fix the lines above before starting phase A2." : "\nREADY.");
process.exit(failed ? 1 : 0);
