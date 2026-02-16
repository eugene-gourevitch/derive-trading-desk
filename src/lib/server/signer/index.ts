import type { ICustodialSigner } from "./types";
import { getEnvSigner } from "./env-signer";
import { getProductionSigner } from "./kms-signer";

export type { ICustodialSigner } from "./types";
export { getEnvSigner } from "./env-signer";
export { getProductionSigner } from "./kms-signer";

/**
 * Prefer production (KMS/HSM) signer when configured; otherwise fall back to env signer.
 */
export function getOnboardingSigner(): ICustodialSigner | null {
  return getProductionSigner() ?? getEnvSigner();
}
