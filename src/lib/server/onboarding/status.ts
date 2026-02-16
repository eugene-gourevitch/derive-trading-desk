import type { OnboardingRecord, OnboardingStatusForClient } from "./types";

/**
 * Map persisted onboarding record to client-facing status.
 */
export function recordToStatus(record: OnboardingRecord | null): OnboardingStatusForClient {
  if (!record) {
    return { state: "loading" };
  }
  if (record.state === "COMPLETED" && record.subaccountId != null) {
    return { state: "completed", subaccountId: record.subaccountId };
  }
  if (record.state === "FAILED") {
    const isSignature = /signature|auth|sign/i.test(record.error ?? "");
    return isSignature
      ? { state: "failed_signature", error: record.error }
      : { state: "failed", error: record.error };
  }
  if (record.state === "DEPOSIT_PENDING" || record.state === "SUBACCOUNT_REQUESTED") {
    return { state: "waiting_for_chain", transactionId: record.transactionId };
  }
  return {
    state: record.state,
    error: record.error,
    subaccountId: record.subaccountId,
    transactionId: record.transactionId,
  };
}
