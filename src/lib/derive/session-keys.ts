import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { WalletClient } from "viem";
import { SESSION_KEY_EXPIRY_SECONDS, SESSION_KEY_LABEL } from "./constants";
import { deriveClient } from "./client";

export interface SessionKeyPair {
  address: `0x${string}`;
  privateKey: `0x${string}`;
  account: PrivateKeyAccount;
}

/**
 * Generate a new ephemeral session key pair
 */
export function generateSessionKey(): SessionKeyPair {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    privateKey,
    account,
  };
}

/**
 * Register a session key with the Derive API.
 * Requires the EOA owner to sign a registration message.
 */
export async function registerSessionKey(params: {
  deriveWallet: string;
  sessionKeyAddress: string;
  walletClient: WalletClient;
}): Promise<void> {
  const { deriveWallet, sessionKeyAddress, walletClient } = params;

  const expirySec = Math.floor(Date.now() / 1000) + SESSION_KEY_EXPIRY_SECONDS;

  await deriveClient.call("public/register_session_key", {
    wallet: deriveWallet,
    public_session_key: sessionKeyAddress,
    expiry_sec: expirySec,
    label: SESSION_KEY_LABEL,
  });

  // The server may require the EOA to sign a message confirming the registration.
  // This depends on Derive's current registration flow.
  // For now, the JSON-RPC call handles registration directly.
  void walletClient; // Will be used if EIP-712 signature is needed
}

/**
 * Create a sign function for REST API authentication using the session key
 */
export function createSessionSigner(
  sessionAccount: PrivateKeyAccount
): (timestamp: string) => Promise<string> {
  return async (timestamp: string) => {
    const signature = await sessionAccount.signMessage({
      message: timestamp,
    });
    return signature;
  };
}

/**
 * Resolve the Derive wallet address from an EOA address
 */
export async function resolveDeriverWallet(
  eoaAddress: string
): Promise<string | null> {
  try {
    const result = await deriveClient.call<{ wallet: string }>(
      "public/get_account",
      { wallet: eoaAddress }
    );
    return result.wallet;
  } catch {
    return null;
  }
}
