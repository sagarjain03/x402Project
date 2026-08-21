// OWNER: PAY. One place that knows which block explorer belongs to which rail.
// It lived in six copies before, which is how a Base link ended up under an Algorand hash.
// Imported by CORE's serialisers, the gateway, the dashboard and the demo scenarios alike —
// everything may import @/shared, so nothing needs a second copy of this table.

/** What a human should read for a raw CAIP-2 network id. */
export function networkLabel(network?: string | null): string {
  if (!network) return "Unknown network";
  if (network.startsWith("algorand:") || network === "algorand-testnet") return "Algorand TestNet";
  if (network === "eip155:84532" || network === "base-sepolia") return "Base Sepolia";
  if (network === "eip155:8453" || network === "base") return "Base";
  return network;
}

/** The explorer's own name, for button text like "View on Lora". */
export function explorerName(network?: string | null): string {
  return network?.startsWith("algorand:") || network === "algorand-testnet" ? "Lora" : "BaseScan";
}

/**
 * A link to a transaction, or `null` when we cannot be sure which chain it is on.
 *
 * Returning null matters more than it looks: a BaseScan link built from an Algorand transaction id
 * renders as "transaction not found", which reads to anyone watching as a payment that failed.
 * No link at all is honest; a wrong link is a lie the UI tells confidently.
 */
export function explorerTxUrl(network?: string | null, txHash?: string | null): string | null {
  if (!txHash || !network) return null;
  if (network.startsWith("algorand:") || network === "algorand-testnet") {
    return `https://lora.algokit.io/testnet/transaction/${txHash}`;
  }
  if (network === "eip155:84532" || network === "base-sepolia") return `https://sepolia.basescan.org/tx/${txHash}`;
  if (network === "eip155:8453" || network === "base") return `https://basescan.org/tx/${txHash}`;
  return null;
}

/** The account view, for showing that a blocked payment left no trace on the agent's wallet. */
export function explorerAccountUrl(network?: string | null, address?: string | null): string | null {
  if (!address || !network) return null;
  if (network.startsWith("algorand:") || network === "algorand-testnet") {
    return `https://lora.algokit.io/testnet/account/${address}`;
  }
  if (network === "eip155:84532" || network === "base-sepolia") return `https://sepolia.basescan.org/address/${address}`;
  return null;
}
