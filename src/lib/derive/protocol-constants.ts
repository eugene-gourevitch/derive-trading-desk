/**
 * Protocol constants for deposit/withdraw signing (client + server).
 * Testnet from docs.derive.xyz; mainnet may need updating from protocol-constants page.
 */

import type { DeriveEnvironment } from "./constants";

export interface DeriveProtocolConstants {
  domainSeparator: `0x${string}`;
  actionTypeHash: `0x${string}`;
  depositModuleAddress: `0x${string}`;
  /** Withdraw module (same as deposit if unified). */
  withdrawModuleAddress: `0x${string}`;
  cashAddress: `0x${string}`;
  standardRiskManagerAddress: `0x${string}`;
  /** Token addresses by asset name for approval (Derive chain). */
  tokenAddresses: Record<string, `0x${string}`>;
}

const TESTNET: DeriveProtocolConstants = {
  domainSeparator:
    "0x9bcf4dc06df5d8bf23af818d5716491b995020f377d3b7b64c29ed14e3dd1105" as `0x${string}`,
  actionTypeHash:
    "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17" as `0x${string}`,
  depositModuleAddress:
    "0x43223Db33AdA0575D2E100829543f8B04A37a1ec" as `0x${string}`,
  withdrawModuleAddress:
    "0x43223Db33AdA0575D2E100829543f8B04A37a1ec" as `0x${string}`,
  cashAddress: "0x6caf294DaC985ff653d5aE75b4FF8E0A66025928" as `0x${string}`,
  standardRiskManagerAddress:
    "0x28bE681F7bEa6f465cbcA1D25A2125fe7533391C" as `0x${string}`,
  tokenAddresses: {
    USDC: "0xe80F2a02398BBf1ab2C9cc52caD1978159c215BD" as `0x${string}`,
    USDT: "0xe80F2a02398BBf1ab2C9cc52caD1978159c215BD" as `0x${string}`,
    ETH: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    WBTC: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    weETH: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  },
};

const MAINNET: DeriveProtocolConstants = {
  ...TESTNET,
  // Update from docs.derive.xyz/reference/protocol-constants for production
};

const BY_ENV: Record<DeriveEnvironment, DeriveProtocolConstants> = {
  testnet: TESTNET,
  mainnet: MAINNET,
};

export function getProtocolConstants(
  env: DeriveEnvironment = "mainnet"
): DeriveProtocolConstants {
  return BY_ENV[env];
}
