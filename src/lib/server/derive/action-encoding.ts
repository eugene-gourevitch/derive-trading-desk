/**
 * Encode DepositModuleData and compute EIP-712 typed data hash for create_subaccount.
 * Server-only; matches docs.derive.xyz create-or-deposit-to-subaccount.
 */

import { encodeAbiParameters, keccak256, concat } from "viem";
import type { Hex } from "viem";
import { getProtocolConstants } from "./protocol-constants";
import type { DeriveEnvironment } from "@/lib/derive/constants";

const DEPOSIT_PARAMS = [
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

/** Encode deposit params and return keccak256(encoded) for SignedAction. */
export function encodeDepositDataHashed(
  amountWei: bigint,
  env: DeriveEnvironment = "mainnet"
): Hex {
  const c = getProtocolConstants(env);
  const encoded = encodeAbiParameters(
    DEPOSIT_PARAMS,
    [amountWei, c.cashAddress, c.standardRiskManagerAddress]
  );
  return keccak256(encoded);
}

/**
 * Build EIP-712 typed data hash for create_subaccount.
 * Returns digest hex to pass to signer.signActionHash(digest).
 */
export function getCreateSubaccountTypedDataHash(
  params: {
    subaccountId: number;
    nonce: number;
    encodedDataHashed: Hex;
    expirySec: number;
    wallet: `0x${string}`;
    signer: `0x${string}`;
  },
  env: DeriveEnvironment = "mainnet"
): `0x${string}` {
  const c = getProtocolConstants(env);
  const actionEncoded = encodeAbiParameters(ACTION_PARAMS, [
    c.actionTypeHash,
    BigInt(params.subaccountId),
    BigInt(params.nonce),
    c.depositModuleAddress,
    params.encodedDataHashed,
    BigInt(params.expirySec),
    params.wallet,
    params.signer,
  ]);
  const actionHash = keccak256(actionEncoded);
  // typed_data_hash = keccak256("\x19\x01" || domain_separator || action_hash)
  const domainSep = c.domainSeparator.startsWith("0x")
    ? (c.domainSeparator as Hex)
    : (`0x${c.domainSeparator}` as Hex);
  const payload = concat([
    "0x1901" as Hex,
    domainSep,
    actionHash as Hex,
  ]);
  return keccak256(payload) as `0x${string}`;
}
