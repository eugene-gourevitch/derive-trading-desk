/**
 * Map wallet/RPC errors to user-facing messages.
 * Handles EIP-1193 and common contract revert cases.
 */

export type WalletErrorKind =
  | "user_rejected"
  | "chain_mismatch"
  | "wallet_error"
  | "network_error"
  | "server_error"
  | "unknown";

export interface WalletErrorResult {
  kind: WalletErrorKind;
  message: string;
}

/**
 * Categorize a caught error from wallet/contract calls and return a safe user message.
 */
export function getWalletErrorMessage(err: unknown, fallback: string = "Something went wrong."): WalletErrorResult {
  if (err == null) return { kind: "unknown", message: fallback };

  const e = err as Error & { code?: number; name?: string; shortMessage?: string };
  const code = e.code ?? (err as { code?: number }).code;
  const name = e.name ?? (err as { name?: string }).name;

  // EIP-1193: User rejected (4001)
  if (code === 4001 || name === "UserRejectedRequestError") {
    return { kind: "user_rejected", message: "You rejected the request in your wallet." };
  }

  // Chain disconnected / wrong network (4901, 4902)
  if (code === 4901 || code === 4902 || name === "ChainDisconnectedError" || name === "SwitchChainError") {
    return { kind: "chain_mismatch", message: "Wrong network. Please switch to Derive in your wallet." };
  }

  // Unauthorized / disconnected (4100, 4900)
  if (code === 4100 || code === 4900) {
    return { kind: "wallet_error", message: "Wallet connection issue. Try reconnecting." };
  }

  // Provider/RPC error with message
  if (e.message) {
    const msg = e.shortMessage ?? e.message;
    if (msg.includes("rejected") || msg.toLowerCase().includes("user denied")) {
      return { kind: "user_rejected", message: "You rejected the request in your wallet." };
    }
    if (msg.includes("chain") || msg.includes("network")) {
      return { kind: "chain_mismatch", message: "Wrong network. Please switch to Derive in your wallet." };
    }
    // Keep server/API errors readable but don't expose internals
    if (msg.includes("401") || msg.includes("403") || msg.includes("Replay") || msg.includes("signature")) {
      return { kind: "server_error", message: "Authentication failed. Try reconnecting your wallet." };
    }
    if (msg.length < 120) return { kind: "wallet_error", message: msg };
  }

  return { kind: "unknown", message: fallback };
}
