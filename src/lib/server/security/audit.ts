/**
 * Audit log for signing and onboarding actions.
 * Do not log secrets, private keys, or full signatures.
 */

export type AuditAction =
  | "onboarding_start"
  | "onboarding_retry"
  | "onboarding_completed"
  | "onboarding_failed"
  | "signer_invoked";

export function auditLog(
  action: AuditAction,
  data: {
    onboardingId?: string;
    wallet?: string;
    state?: string;
    error?: string;
    keyVersion?: string;
    [key: string]: unknown;
  }
): void {
  const payload = {
    ts: new Date().toISOString(),
    action,
    ...data,
  };
  console.log(JSON.stringify({ audit: payload }));
}
