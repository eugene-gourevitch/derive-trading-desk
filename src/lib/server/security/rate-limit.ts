/**
 * Rate limiter for onboarding/signing endpoints.
 * Uses Redis (Upstash) when UPSTASH_REDIS_REST_URL is set; otherwise in-memory (single-instance).
 */

const windowMs = 60 * 1000; // 1 minute
const maxPerWindow = 10; // max requests per key per window

const hits = new Map<string, { count: number; resetAt: number }>();

function getKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `onboarding:${ip}`;
}

function checkRateLimitInMemory(request: Request): { ok: boolean; retryAfter?: number } {
  const key = getKey(request);
  const now = Date.now();
  let entry = hits.get(key);

  if (!entry) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    hits.set(key, entry);
    return { ok: true };
  }

  entry.count++;
  if (entry.count > maxPerWindow) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { ok: true };
}

export type RateLimitResult = { ok: boolean; retryAfter?: number };

/**
 * Check rate limit. Uses Redis when UPSTASH_REDIS_REST_* is set; otherwise in-memory.
 */
export async function checkRateLimit(request: Request): Promise<RateLimitResult> {
  try {
    const { isRedisRateLimitAvailable, checkRateLimitRedis } = await import("./rate-limit-redis");
    if (isRedisRateLimitAvailable()) {
      return await checkRateLimitRedis(request);
    }
  } catch {
    // Redis not configured or @upstash packages not installed
  }
  return checkRateLimitInMemory(request);
}
