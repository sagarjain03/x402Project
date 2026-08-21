// OWNER: PAY · live Algorand balances for the sender and merchant wallets.
export { GET } from "@/payments/handlers/wallet-balances";

// Reads the chain on every request; a cached balance is a wrong balance.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
