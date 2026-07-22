import IORedis from "ioredis";

const g = globalThis as unknown as { redis?: IORedis | null };

export function getRedis(): IORedis | null {
  if (g.redis !== undefined) return g.redis;
  const url = process.env.REDIS_URL;
  if (!url) { g.redis = null; return null; }
  const client = new IORedis(url, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  client.on("error", () => {});
  g.redis = client;
  return client;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSec);
    return n <= limit;
  } catch {
    return true;
  }
}
