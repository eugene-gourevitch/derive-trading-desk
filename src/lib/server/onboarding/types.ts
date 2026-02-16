/**
 * Onboarding state machine and record types.
 */

export const ONBOARDING_STATES = [
  "INIT",
  "ACCOUNT_CREATED",
  "SUBACCOUNT_REQUESTED",
  "DEPOSIT_PENDING",
  "COMPLETED",
  "FAILED",
] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export interface OnboardingRecord {
  id: string;
  state: OnboardingState;
  /** Wallet (owner) address. */
  wallet: string;
  /** Subaccount id once created (from get_subaccounts). */
  subaccountId?: number;
  /** Transaction id from create_subaccount. */
  transactionId?: string;
  /** Last error message if state is FAILED. */
  error?: string;
  /** Idempotency key used for create_subaccount. */
  idempotencyKey?: string;
  /** Created at (ISO). */
  createdAt: string;
  /** Updated at (ISO). */
  updatedAt: string;
}

export type OnboardingStatusForClient =
  | { state: "loading" }
  | { state: "waiting_for_chain"; transactionId?: string }
  | { state: "failed_signature"; error?: string }
  | { state: "completed"; subaccountId: number }
  | { state: "failed"; error?: string }
  | { state: OnboardingState; error?: string; subaccountId?: number; transactionId?: string };
