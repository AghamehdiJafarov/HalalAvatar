import IORedis from "ioredis";
const g = globalThis as unknown as { redis?: IORedis };
export const redis = g.redis ?? new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
if (process.env.NODE_ENV !== "production") g.redis = redis;

// Rate limit: N actions per window seconds (spec 13.1). Returns true if allowed.
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n <= limit;
}
