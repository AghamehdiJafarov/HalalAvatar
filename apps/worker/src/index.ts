import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { loadAssets } from "./assets";
import { renderVideo } from "./render";
import { storageFromEnv } from "./storage";
import type { AvatarConfig, Instance } from "@faceless/avatar-core";

const ROOT = join(process.cwd(), "..", "..");
const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
const assets = loadAssets(ROOT);
const storage = storageFromEnv(ROOT);

const DEFAULT_CONFIG: AvatarConfig = { archetype: "seated_desk", palette: "ref_blue", parts: {} };

async function process(jobId: string): Promise<void> {
  const workDir = `/tmp/${jobId}`;
  try {
    const job = await prisma.videoJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`job ${jobId} not found`);
    if (job.status === "done" && job.resultKey) return; // idempotent: already rendered

    const msg = await prisma.message.findUnique({ where: { id: job.messageId } });
    if (!msg || !msg.timeline || !msg.durationMs || !msg.audioKey) throw new Error("message not renderable");

    await prisma.videoJob.update({ where: { id: jobId }, data: { status: "processing" } });

    const profile = await prisma.avatarProfile.findUnique({ where: { userId: job.userId } });
    const config = (profile?.config as AvatarConfig | undefined) ?? DEFAULT_CONFIG;

    await mkdir(workDir, { recursive: true });
    const audioPath = join(workDir, "audio.mp3");
    await storage.getBytes(msg.audioKey, audioPath);

    const timeline = msg.timeline as unknown as { instances: Instance[] };
    const outPath = join(workDir, "out.mp4");
    await renderVideo({
      instances: timeline.instances,
      durationMs: msg.durationMs,
      config, assets, audioPath, workDir, outPath,
    });

    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(outPath);
    const resultKey = `videos/${jobId}.mp4`;
    await storage.put(resultKey, bytes, "video/mp4");
    await prisma.videoJob.update({ where: { id: jobId }, data: { status: "done", resultKey } });
  } catch (e) {
    await prisma.videoJob.update({ where: { id: jobId }, data: { status: "error", error: (e as Error).message } }).catch(() => {});
    throw e;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

const worker = new Worker<{ jobId: string }>("video", async (job) => process(job.data.jobId), {
  connection, concurrency: 1,
});

worker.on("completed", (job) => console.log(JSON.stringify({ lvl: "info", ev: "video_done", jobId: job.data.jobId })));
worker.on("failed", (job, err) => console.error(JSON.stringify({ lvl: "error", ev: "video_failed", jobId: job?.data.jobId, err: err.message })));
console.log(JSON.stringify({ lvl: "info", ev: "worker_started", concurrency: 1 }));
