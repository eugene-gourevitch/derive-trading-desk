/**
 * Verify X-Lyra* auth headers for private proxy calls.
 * Ensures signature is a valid signer of the timestamp, timestamp is in window, and not replayed.
 * Note: Client sends X-LyraWallet (derive wallet) but signs with EOA; we verify signature validity
 * and replay only. Derive API authorizes the signer for the wallet.
 */

import { recoverMessageAddress } from "viem";
import { consumeReplayToken, isTimestampInWindow, CLOCK_SKEW_MS, REPLAY_TTL_MS } from "./replay";
import { auditLog } from "./audit";

export type VerifyLyraAuthResult =
  | { ok: true }
  | { ok: false; status: number; code: number; message: string };

/**
 * Verify X-LyraWallet, X-LyraTimestamp, X-LyraSignature for private methods.
 * Returns { ok: true } or { ok: false, status, code, message }.
 */
export async function verifyLyraAuthHeaders(
  wallet: string | null,
  timestamp: string | null,
  signature: string | null
): Promise<VerifyLyraAuthResult> {
  if (!wallet || !timestamp || !signature) {
    auditLog("auth_verify_failed", { reason: "missing_header", wallet: wallet ?? undefined });
    return { ok: false, status: 401, code: -1, message: "Missing auth headers" };
  }

  const walletLower = wallet.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/i.test(walletLower)) {
    auditLog("auth_verify_failed", { reason: "invalid_wallet", wallet: walletLower });
    return { ok: false, status: 400, code: -1, message: "Invalid wallet address" };
  }

  const timestampMs = parseInt(timestamp, 10);
  if (Number.isNaN(timestampMs) || timestampMs <= 0) {
    auditLog("auth_verify_failed", { reason: "invalid_timestamp", wallet: walletLower });
    return { ok: false, status: 400, code: -1, message: "Invalid timestamp" };
  }

  if (!isTimestampInWindow(timestampMs, CLOCK_SKEW_MS)) {
    auditLog("auth_verify_failed", { reason: "timestamp_expired", wallet: walletLower });
    return { ok: false, status: 401, code: -1, message: "Timestamp out of window" };
  }

  if (!consumeReplayToken(wallet, timestamp, REPLAY_TTL_MS)) {
    auditLog("auth_verify_failed", { reason: "replay", wallet: walletLower });
    return { ok: false, status: 401, code: -1, message: "Replay detected" };
  }

  try {
    const recovered = await recoverMessageAddress({
      message: timestamp,
      signature: signature as `0x${string}`,
    });
    if (!recovered || recovered === "0x0000000000000000000000000000000000000000") {
      auditLog("auth_verify_failed", { reason: "invalid_signature", wallet: walletLower });
      return { ok: false, status: 401, code: -1, message: "Invalid signature" };
    }
  } catch (e) {
    auditLog("auth_verify_failed", {
      reason: "verify_error",
      wallet: walletLower,
      error: (e as Error).message,
    });
    return { ok: false, status: 400, code: -1, message: "Signature verification failed" };
  }

  return { ok: true };
}
