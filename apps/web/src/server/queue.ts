import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface VideoJobData { jobId: string }

const g = globalThis as unknown as { videoQueue?: Queue | null };

// Lazily create the BullMQ queue. Returns null if REDIS_URL is not set, so the
// video feature degrades gracefully instead of crashing the build or runtime.
export function getVideoQueue(): Queue | null {
  if (g.videoQueue !== undefined) return g.videoQueue;
  const url = process.env.REDIS_URL;
  if (!url) { g.videoQueue = null; return null; }
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null, // BullMQ requires null here
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  connection.on("error", () => { /* swallow */ });
  g.videoQueue = new Queue("video", { connection });
  return g.videoQueue;
}
