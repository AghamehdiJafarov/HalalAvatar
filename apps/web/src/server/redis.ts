import IORedis from "ioredis";

const g = globalThis as unknown as { redis?: IORedis | null };

// Lazily create the Redis client on first use. lazyConnect + no top-level
// connection means importing this module during `next build` never dials Redis.
export function getRedis(): IORedis | null {
  if (g.redis !== undefined) return g.redis;
  const url = process.env.REDIS_URL;
  if (!url) { g.redis = null; return null; } // no Redis configured -> feature disabled, not fatal
  const client = new IORedis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  client.on("error", () => { /* swallow: absence of Redis must not crash the app */ });
  g.redis = client;
  return client;
}

// Rate limit: N actions per window seconds (spec 13.1). Returns true if allowed.
// If Redis is unavailable, fail OPEN (allow) so the app keeps working without it.
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSec);
    return n <= limit;
  } catch {
    return true; // Redis down -> don't block the user
  }
}
