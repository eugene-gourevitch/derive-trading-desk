/**
 * Custodial signer interface for Derive auth and self-custodial actions.
 * Back with KMS/HSM in production; env-key implementation for dev.
 */

export interface ICustodialSigner {
  /** Sign a timestamp string for X-LyraSignature (personal_sign). */
  signMessage(timestamp: string): Promise<string>;
  /** Sign the EIP-712 digest (32-byte hex) for create_subaccount/deposit. Returns signature hex. */
  signActionHash(digestHex: `0x${string}`): Promise<`0x${string}`>;
  /** Wallet address (Derive wallet / owner). */
  getAddress(): Promise<string>;
  /** Optional key version for rotation. */
  getKeyVersion?(): string;
}
