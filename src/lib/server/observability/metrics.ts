/**
 * Simple in-memory metrics for onboarding.
 * Replace with Prometheus/DataDog/etc in production.
 */

let onboardingStarted = 0;
let onboardingCompleted = 0;
let onboardingFailed = 0;
const failureReasons: Record<string, number> = {};
const completionTimes: number[] = [];
const MAX_TIMES = 1000;

export function recordOnboardingStarted(): void {
  onboardingStarted++;
}

export function recordOnboardingCompleted(durationMs: number): void {
  onboardingCompleted++;
  completionTimes.push(durationMs);
  if (completionTimes.length > MAX_TIMES) completionTimes.shift();
}

export function recordOnboardingFailed(reason: string): void {
  onboardingFailed++;
  failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
}

export function getOnboardingMetrics(): {
  started: number;
  completed: number;
  failed: number;
  successRate: number;
  medianDurationMs: number;
  failureReasons: Record<string, number>;
} {
  const total = onboardingCompleted + onboardingFailed;
  const successRate = total > 0 ? onboardingCompleted / total : 0;
  const sorted = [...completionTimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianDurationMs =
    sorted.length > 0 ? (sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2) : 0;
  return {
    started: onboardingStarted,
    completed: onboardingCompleted,
    failed: onboardingFailed,
    successRate,
    medianDurationMs,
    failureReasons: { ...failureReasons },
  };
}
