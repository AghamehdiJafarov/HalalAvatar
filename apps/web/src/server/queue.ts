import { Queue } from "bullmq";
import IORedis from "ioredis";

export interface VideoJobData { jobId: string }

const g = globalThis as unknown as { videoQueue?: Queue | null };

export function getVideoQueue(): Queue | null {
  if (g.videoQueue !== undefined) return g.videoQueue;
  const url = process.env.REDIS_URL;
  if (!url) { g.videoQueue = null; return null; }
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  connection.on("error", () => {});
  g.videoQueue = new Queue("video", { connection });
  return g.videoQueue;
}
