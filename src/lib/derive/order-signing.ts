import type { WalletClient } from "viem";
import { secureRandomInt } from "@/lib/utils/secure-random";

/**
 * Generate order nonce per Derive API: (UTC timestamp in ms)(random 3 digits).
 * e.g. 1695836058725001
 * Uses cryptographically secure random for the suffix.
 */
export function generateOrderNonce(): number {
  const ms = Date.now();
  const r = secureRandomInt(1000); // 0–999
  return ms * 1000 + r;
}

/**
 * Signature expiry at least 5 min from now (per Derive API).
 */
export function getSignatureExpirySec(): number {
  return Math.floor(Date.now() / 1000) + 300;
}

/**
 * Sign a canonical order message for Derive API.
 * The API may require EIP-712 typed data; this uses personal_sign of a canonical string.
 * If the API rejects, implement EIP-712 per docs.derive.xyz.
 */
export async function signOrderMessage(
  walletClient: WalletClient,
  params: {
    subaccountId: number;
    instrumentName: string;
    direction: string;
    orderType: string;
    amount: string;
    limitPrice: string;
    timeInForce: string;
    nonce: number;
    signatureExpirySec: number;
  }
): Promise<string> {
  const account = walletClient.account;
  if (!account) throw new Error("Wallet client has no account");
  const msg = [
    params.subaccountId,
    params.instrumentName,
    params.direction,
    params.orderType,
    params.amount,
    params.limitPrice,
    params.timeInForce,
    params.nonce,
    params.signatureExpirySec,
  ].join("|");
  const signature = await walletClient.signMessage({
    account,
    message: `Derive order: ${msg}`,
  });
  return signature;
}
