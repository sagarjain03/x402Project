// OWNER: shared. What a wallet address looks like on each rail, in one place.
//
// This existed twice before and the two copies disagreed: the gateway had learned Algorand while
// the agent-registration endpoint still demanded `0x…`, so an agent could be paid at an address
// the control plane refused to let you register. Everything may import @/shared, so nothing needs
// a second copy of these.
//
// Shape only. A well-formed address is not a known address — allowlisting and recipient pinning
// are policy decisions and live in the engine.

/** 20 bytes hex, EVM. Kept because a Base offer must stay *readable* in order to be refused. */
export const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** 58 characters of base32 (RFC 4648, no padding), Algorand. */
export const AVM_ADDRESS = /^[A-Z2-7]{58}$/;

/** 52 characters of the same alphabet. An Algorand transaction id. */
export const AVM_TX_ID = /^[A-Z2-7]{52}$/;

/** 32 bytes hex, EVM. */
export const EVM_TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** True for an address on any rail this project recognises. */
export function isAddress(value: string): boolean {
  return EVM_ADDRESS.test(value) || AVM_ADDRESS.test(value);
}

/** True for a transaction id on any rail this project recognises. */
export function isTxId(value: string): boolean {
  return EVM_TX_HASH.test(value) || AVM_TX_ID.test(value);
}
