/**
 * Derive protocol constants for create_subaccount/deposit signing.
 * Testnet values from docs.derive.xyz; mainnet from protocol-constants or create_subaccount_debug.
 */

import type { DeriveEnvironment } from "@/lib/derive/constants";

export interface ProtocolConstants {
  /** EIP-712 domain separator (hex). */
  domainSeparator: `0x${string}`;
  /** SignedAction type hash. */
  actionTypeHash: `0x${string}`;
  /** Deposit module contract address. */
  depositModuleAddress: `0x${string}`;
  /** Cash (USDC) contract address. */
  cashAddress: `0x${string}`;
  /** Standard risk manager (SM); use portfolioManagerAddress for PM/PM2. */
  standardRiskManagerAddress: `0x${string}`;
  /** Portfolio manager (PM/PM2). */
  portfolioManagerAddress: `0x${string}`;
}

/** Testnet constants from docs.derive.xyz create-or-deposit example. */
const TESTNET: ProtocolConstants = {
  domainSeparator:
    "0x9bcf4dc06df5d8bf23af818d5716491b995020f377d3b7b64c29ed14e3dd1105" as `0x${string}`,
  actionTypeHash:
    "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17" as `0x${string}`,
  depositModuleAddress:
    "0x43223Db33AdA0575D2E100829543f8B04A37a1ec" as `0x${string}`,
  cashAddress: "0x6caf294DaC985ff653d5aE75b4FF8E0A66025928" as `0x${string}`,
  standardRiskManagerAddress:
    "0x28bE681F7bEa6f465cbcA1D25A2125fe7533391C" as `0x${string}`,
  portfolioManagerAddress:
    "0x28bE681F7bEa6f465cbcA1D25A2125fe7533391C" as `0x${string}`,
};

/** Mainnet: replace with values from docs.derive.xyz/reference/protocol-constants or create_subaccount_debug. */
const MAINNET: ProtocolConstants = {
  domainSeparator:
    "0x9bcf4dc06df5d8bf23af818d5716491b995020f377d3b7b64c29ed14e3dd1105" as `0x${string}`,
  actionTypeHash:
    "0x4d7a9f27c403ff9c0f19bce61d76d82f9aa29f8d6d4b0c5474607d9770d1af17" as `0x${string}`,
  depositModuleAddress:
    "0x43223Db33AdA0575D2E100829543f8B04A37a1ec" as `0x${string}`,
  cashAddress: "0x6caf294DaC985ff653d5aE75b4FF8E0A66025928" as `0x${string}`,
  standardRiskManagerAddress:
    "0x28bE681F7bEa6f465cbcA1D25A2125fe7533391C" as `0x${string}`,
  portfolioManagerAddress:
    "0x28bE681F7bEa6f465cbcA1D25A2125fe7533391C" as `0x${string}`,
};

const BY_ENV: Record<DeriveEnvironment, ProtocolConstants> = {
  testnet: TESTNET,
  mainnet: MAINNET,
};

export function getProtocolConstants(
  env: DeriveEnvironment = "mainnet"
): ProtocolConstants {
  return BY_ENV[env];
}
