/**
 * EIP-712 action encoding for deposit and withdraw (client + server).
 * Matches docs.derive.xyz create-or-deposit and withdraw flow.
 */

import { encodeAbiParameters, keccak256 } from "viem";
import type { Hex } from "viem";
import { getProtocolConstants } from "./protocol-constants";
import type { DeriveEnvironment } from "./constants";

const DEPOSIT_DATA_PARAMS = [
  { name: "amount", type: "uint256" },
  { name: "asset", type: "address" },
  { name: "managerForNewAccount", type: "address" },
] as const;

const ACTION_PARAMS = [
  { name: "actionTypeHash", type: "bytes32" },
  { name: "subaccountId", type: "uint256" },
  { name: "nonce", type: "uint256" },
  { name: "module", type: "address" },
  { name: "encodedDataHashed", type: "bytes32" },
  { name: "expiry", type: "uint256" },
  { name: "owner", type: "address" },
  { name: "signer", type: "address" },
] as const;

function encodeDepositDataHashed(
  amountWei: bigint,
  env: DeriveEnvironment
): Hex {
  const c = getProtocolConstants(env);
  const encoded = encodeAbiParameters(DEPOSIT_DATA_PARAMS, [
    amountWei,
    c.cashAddress,
    c.standardRiskManagerAddress,
  ]);
  return keccak256(encoded);
}

/** Build action hash for deposit (used in EIP-712). */
export function getDepositActionHash(
  params: {
    subaccountId: number;
    nonce: number;
    amountWei: bigint;
    expirySec: number;
    wallet: `0x${string}`;
    signer: `0x${string}`;
  },
  env: DeriveEnvironment = "mainnet"
): Hex {
  const c = getProtocolConstants(env);
  const encodedDataHashed = encodeDepositDataHashed(params.amountWei, env);
  const actionEncoded = encodeAbiParameters(ACTION_PARAMS, [
    c.actionTypeHash,
    BigInt(params.subaccountId),
    BigInt(params.nonce),
    c.depositModuleAddress,
    encodedDataHashed,
    BigInt(params.expirySec),
    params.wallet,
    params.signer,
  ]);
  return keccak256(actionEncoded);
}

/** EIP-712 typed data for signing deposit (signTypedData in browser). */
export function getDepositTypedData(
  params: {
    subaccountId: number;
    nonce: number;
    amountWei: bigint;
    expirySec: number;
    wallet: `0x${string}`;
    signer: `0x${string}`;
  },
  env: DeriveEnvironment = "mainnet"
) {
  const c = getProtocolConstants(env);
  const actionHash = getDepositActionHash(params, env);
  const chainId = env === "testnet" ? 901 : 957;
  return {
    domain: {
      name: "Derive",
      version: "1",
      chainId,
    },
    types: {
      Action: [{ name: "actionHash", type: "bytes32" }],
    },
    primaryType: "Action" as const,
    message: { actionHash },
  };
}

/** Withdraw: same SignedAction shape with withdraw module. encoded_data for withdraw = (amount, asset, ?). */
function encodeWithdrawDataHashed(
  amountWei: bigint,
  assetAddress: `0x${string}`,
  env: DeriveEnvironment
): Hex {
  const c = getProtocolConstants(env);
  const encoded = encodeAbiParameters(DEPOSIT_DATA_PARAMS, [
    amountWei,
    assetAddress,
    c.standardRiskManagerAddress,
  ]);
  return keccak256(encoded);
}

/** Build action hash for withdraw. */
export function getWithdrawActionHash(
  params: {
    subaccountId: number;
    nonce: number;
    amountWei: bigint;
    assetAddress: `0x${string}`;
    expirySec: number;
    wallet: `0x${string}`;
    signer: `0x${string}`;
  },
  env: DeriveEnvironment = "mainnet"
): Hex {
  const c = getProtocolConstants(env);
  const encodedDataHashed = encodeWithdrawDataHashed(
    params.amountWei,
    params.assetAddress,
    env
  );
  const actionEncoded = encodeAbiParameters(ACTION_PARAMS, [
    c.actionTypeHash,
    BigInt(params.subaccountId),
    BigInt(params.nonce),
    c.withdrawModuleAddress,
    encodedDataHashed,
    BigInt(params.expirySec),
    params.wallet,
    params.signer,
  ]);
  return keccak256(actionEncoded);
}

/** EIP-712 typed data for signing withdraw. */
export function getWithdrawTypedData(
  params: {
    subaccountId: number;
    nonce: number;
    amountWei: bigint;
    assetAddress: `0x${string}`;
    expirySec: number;
    wallet: `0x${string}`;
    signer: `0x${string}`;
  },
  env: DeriveEnvironment = "mainnet"
) {
  const actionHash = getWithdrawActionHash(params, env);
  const chainId = env === "testnet" ? 901 : 957;
  return {
    domain: {
      name: "Derive",
      version: "1",
      chainId,
    },
    types: {
      Action: [{ name: "actionHash", type: "bytes32" }],
    },
    primaryType: "Action" as const,
    message: { actionHash },
  };
}

export function getSignatureExpirySec(): number {
  return Math.floor(Date.now() / 1000) + 600;
}

export function generateActionNonce(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
