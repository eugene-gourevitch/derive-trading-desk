/**
 * Redis-backed rate limiter for distributed deployments.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const windowSeconds = 60;
const maxPerWindow = 10;

function getKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `onboarding:${ip}`;
}

let ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (!ratelimit) {
    const redis = Redis.fromEnv();
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(maxPerWindow, `${windowSeconds} s`),
    });
  }
  return ratelimit;
}

export async function checkRateLimitRedis(
  request: Request
): Promise<{ ok: boolean; retryAfter?: number }> {
  const key = getKey(request);
  const rl = getRatelimit();
  const { success, reset } = await rl.limit(key);
  if (success) return { ok: true };
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return { ok: false, retryAfter };
}

export function isRedisRateLimitAvailable(): boolean {
  return (
    typeof process.env.UPSTASH_REDIS_REST_URL === "string" &&
    process.env.UPSTASH_REDIS_REST_URL.length > 0 &&
    typeof process.env.UPSTASH_REDIS_REST_TOKEN === "string" &&
    process.env.UPSTASH_REDIS_REST_TOKEN.length > 0
  );
}
