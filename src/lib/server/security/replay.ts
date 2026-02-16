/**
 * Replay protection for Lyra auth: one-time use of (wallet, timestamp) pairs.
 * In-memory store with TTL; use Redis in production for multi-instance.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 min
const DEFAULT_CLOCK_SKEW_MS = 60 * 1000; // 1 min

const used = new Map<string, number>();

function replayKey(wallet: string, timestamp: string): string {
  return `replay:${wallet.toLowerCase()}:${timestamp}`;
}

function prune(): void {
  const now = Date.now();
  for (const [key, expiresAt] of used.entries()) {
    if (expiresAt <= now) used.delete(key);
  }
}

/**
 * Record (wallet, timestamp) as used. Returns true if this is the first use (allowed),
 * false if already seen (replay).
 */
export function consumeReplayToken(
  wallet: string,
  timestamp: string,
  ttlMs: number = DEFAULT_TTL_MS
): boolean {
  const key = replayKey(wallet, timestamp);
  if (used.has(key)) return false;
  used.set(key, Date.now() + ttlMs);
  // Occasional prune to avoid unbounded growth
  if (used.size % 100 === 0) prune();
  return true;
}

/**
 * Check if timestamp is within allowed window (now - skew, now + skew).
 */
export function isTimestampInWindow(
  timestampMs: number,
  skewMs: number = DEFAULT_CLOCK_SKEW_MS
): boolean {
  const now = Date.now();
  return timestampMs >= now - skewMs && timestampMs <= now + skewMs;
}

export const REPLAY_TTL_MS = DEFAULT_TTL_MS;
export const CLOCK_SKEW_MS = DEFAULT_CLOCK_SKEW_MS;
