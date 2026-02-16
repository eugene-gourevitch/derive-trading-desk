/**
 * Custodial signer backed by a private key in env (dev / single-tenant).
 * Production should use KMS/HSM and implement ICustodialSigner.
 */

import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import type { ICustodialSigner } from "./types";

const ENV_KEY = "ONBOARDING_SIGNER_PRIVATE_KEY";
const ENV_KEY_VERSION = "ONBOARDING_SIGNER_KEY_VERSION";

export function getEnvSigner(): ICustodialSigner | null {
  const raw = process.env[ENV_KEY];
  if (!raw || typeof raw !== "string") return null;
  const hex = raw.startsWith("0x") ? (raw as Hex) : (`0x${raw}` as Hex);
  const account = privateKeyToAccount(hex);

  return {
    async signMessage(timestamp: string): Promise<string> {
      const sig = await account.signMessage({ message: timestamp });
      return sig;
    },
    async signActionHash(digestHex: `0x${string}`): Promise<`0x${string}`> {
      const sig = await account.sign({ hash: digestHex });
      return sig;
    },
    async getAddress(): Promise<string> {
      return account.address;
    },
    getKeyVersion(): string {
      return process.env[ENV_KEY_VERSION] ?? "1";
    },
  };
}
