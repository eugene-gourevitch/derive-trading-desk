/**
 * Onboarding orchestrator: state machine and Derive API calls.
 * INIT -> ACCOUNT_CREATED -> SUBACCOUNT_REQUESTED -> DEPOSIT_PENDING -> COMPLETED | FAILED
 */

import { parseUnits } from "viem";
import type { DeriveEnvironment } from "@/lib/derive/constants";
import { BackendDeriveClient } from "@/lib/server/derive/client";
import { encodeDepositDataHashed, getCreateSubaccountTypedDataHash } from "@/lib/server/derive/action-encoding";
import type { ICustodialSigner } from "@/lib/server/signer/types";
import { secureRandomInt, secureRandomHex } from "@/lib/utils/secure-random";
import {
  getOnboarding,
  setOnboarding,
  updateOnboarding,
} from "./store";
import type { OnboardingRecord } from "./types";
import {
  recordOnboardingStarted,
  recordOnboardingCompleted,
  recordOnboardingFailed,
} from "@/lib/server/observability";

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 60; // ~3 min

function generateNonce(): number {
  const ms = Date.now();
  const r = secureRandomInt(1000);
  return ms * 1000 + r;
}

function getSignatureExpirySec(): number {
  return Math.floor(Date.now() / 1000) + 600; // 10 min
}

function log(level: string, id: string, message: string, data?: Record<string, unknown>): void {
  const payload = { level, onboardingId: id, message, ...data };
  console.log(JSON.stringify(payload));
}

/**
 * Run onboarding from current state until terminal or transient failure.
 */
export async function runOnboarding(
  id: string,
  signer: ICustodialSigner,
  env: DeriveEnvironment = "mainnet"
): Promise<OnboardingRecord> {
  const record = await getOnboarding(id);
  if (!record) throw new Error(`Onboarding not found: ${id}`);

  const startMs = Date.now();
  const client = new BackendDeriveClient(env);
  const wallet = await signer.getAddress();
  client.setAuth({
    wallet,
    signMessage: (ts) => signer.signMessage(ts),
  });

  let state = record.state;
  let doc = record;

  if (state === "INIT") recordOnboardingStarted();

  try {
    // ── INIT -> ACCOUNT_CREATED ──
    if (state === "INIT") {
      log("info", id, "create_account");
      const result = await client.createAccount(wallet);
      log("info", id, "create_account_result", { status: result.status });
      doc = (await updateOnboarding(id, { state: "ACCOUNT_CREATED" })) ?? doc;
      state = "ACCOUNT_CREATED";
    }

    // ── ACCOUNT_CREATED -> SUBACCOUNT_REQUESTED ──
    if (state === "ACCOUNT_CREATED") {
      const amount = "0"; // initial deposit: 0 for empty subaccount; can be parameterized via API later
      const amountWei = parseUnits(amount, 6);
      const nonce = generateNonce();
      const expirySec = getSignatureExpirySec();
      const encodedDataHashed = encodeDepositDataHashed(amountWei, env);
      const digest = getCreateSubaccountTypedDataHash(
        {
          subaccountId: 0,
          nonce,
          encodedDataHashed,
          expirySec,
          wallet: wallet as `0x${string}`,
          signer: wallet as `0x${string}`,
        },
        env
      );
      const signature = await signer.signActionHash(digest);
      const idempotencyKey = doc.idempotencyKey ?? `onboard-${id}`;

      log("info", id, "create_subaccount");
      const result = await client.createSubaccount(
        {
          wallet,
          signer: wallet,
          margin_type: "SM",
          amount,
          asset_name: "USDC",
          nonce,
          signature,
          signature_expiry_sec: expirySec,
        },
        idempotencyKey
      );

      doc = (await updateOnboarding(id, {
        state: "SUBACCOUNT_REQUESTED",
        transactionId: result.transaction_id,
        idempotencyKey,
        error: undefined,
      })) ?? doc;
      state = "SUBACCOUNT_REQUESTED";
    }

    // ── SUBACCOUNT_REQUESTED / DEPOSIT_PENDING -> poll until subaccount appears ──
    if (state === "SUBACCOUNT_REQUESTED") {
      doc = (await updateOnboarding(id, { state: "DEPOSIT_PENDING" })) ?? doc;
      state = "DEPOSIT_PENDING";
    }

    if (state === "DEPOSIT_PENDING") {
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        const { subaccounts } = await client.getSubaccounts();
        const before = (doc.subaccountId ?? 0);
        const nextId = subaccounts.length > 0 ? subaccounts[subaccounts.length - 1].subaccount_id : undefined;
        if (nextId !== undefined && nextId !== before) {
          doc = (await updateOnboarding(id, { state: "COMPLETED", subaccountId: nextId, error: undefined })) ?? doc;
          recordOnboardingCompleted(Date.now() - startMs);
          log("info", id, "onboarding_completed", { subaccountId: nextId });
          return doc;
        }
        await sleep(POLL_INTERVAL_MS);
      }
      log("warn", id, "poll_timeout");
      // Leave in DEPOSIT_PENDING; client can retry
      return doc;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    recordOnboardingFailed(message);
    log("error", id, "onboarding_error", { error: message });
    await updateOnboarding(id, { state: "FAILED", error: message });
    const updated = await getOnboarding(id);
    return updated ?? doc;
  }

  return doc;
}

/**
 * Start a new onboarding: create record in INIT and run.
 */
export async function startOnboarding(
  signer: ICustodialSigner,
  env: DeriveEnvironment = "mainnet"
): Promise<OnboardingRecord> {
  const id = `ob-${Date.now()}-${secureRandomHex(4)}`;
  const now = new Date().toISOString();
  const record: OnboardingRecord = {
    id,
    state: "INIT",
    wallet: await signer.getAddress(),
    createdAt: now,
    updatedAt: now,
  };
  await setOnboarding(record);
  log("info", id, "onboarding_started");
  return runOnboarding(id, signer, env);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
