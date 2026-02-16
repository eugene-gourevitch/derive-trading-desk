/**
 * Feature flags for quote pipeline and rollout control.
 * Toggle via env or runtime for canary rollout and instant rollback.
 */

const env: Record<string, string | undefined> =
  typeof process !== "undefined" && process.env ? process.env : {};

export const quotePipelineFlags = {
  /** Use bulk ticker store updates and rAF coalescing (default on). */
  get wsBulkCoalescing(): boolean {
    return env.NEXT_PUBLIC_WS_BULK_COALESCING !== "0";
  },
  /** Use adaptive concurrency and in-flight dedupe for ticker prefetch (default on). */
  get adaptiveTickerPrefetch(): boolean {
    return env.NEXT_PUBLIC_ADAPTIVE_TICKER_PREFETCH !== "0";
  },
  /** Reject stale and future-dated ticker updates in normalization (default on). */
  get strictStaleGuard(): boolean {
    return env.NEXT_PUBLIC_STRICT_STALE_GUARD !== "0";
  },
} as const;
