/**
 * Production signer abstraction (KMS/HSM).
 * Implement this with AWS KMS, GCP Secret Manager, HashiCorp Vault, or HSM
 * so that private keys never live in process memory or env.
 *
 * Set ONBOARDING_SIGNER_KMS=1 and configure the chosen backend to enable.
 * When enabled, this signer is used instead of env-signer for onboarding.
 */

import type { ICustodialSigner } from "./types";

/**
 * Returns a production signer when KMS/HSM is configured; otherwise null.
 * Example backend: AWS KMS with ONBOARDING_SIGNER_KMS_KEY_ID and AWS credentials.
 */
export function getProductionSigner(): ICustodialSigner | null {
  if (process.env.ONBOARDING_SIGNER_KMS !== "1") return null;

  // Placeholder: wire your KMS/HSM here. Example pattern:
  //
  // import { KmsSigner } from "./kms-signer-aws"; // or gcp, vault, etc.
  // return KmsSigner.fromEnv();
  //
  // KMS signer must implement:
  // - signMessage(timestamp: string) -> personal_sign of timestamp
  // - signActionHash(digestHex: `0x${string}`) -> sign digest for EIP-712
  // - getAddress() -> derive wallet address (from key id or config)
  return null;
}
