/**
 * Simple in-memory rate limiter for onboarding/signing endpoints.
 * Replace with Redis or upstream rate limiting in production.
 */

const windowMs = 60 * 1000; // 1 minute
const maxPerWindow = 10; // max requests per key per window

const hits = new Map<string, { count: number; resetAt: number }>();

function getKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `onboarding:${ip}`;
}

export function checkRateLimit(request: Request): { ok: boolean; retryAfter?: number } {
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
