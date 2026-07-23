import { fileStorage, s3Storage, memoryStorage } from "./storage-impl";
import type { Storage } from "./tts/storage-port";
import { join } from "node:path";

const ROOT = join(process.cwd(), "..", "..");

export function getStorage(): Storage {
  const endpoint = process.env.S3_ENDPOINT ?? "memory";
  const publicBase = process.env.S3_PUBLIC_BASE ?? process.env.APP_URL ?? "";

  // Real object storage (R2/S3) when explicitly configured.
  if (endpoint !== "memory" && endpoint !== "file") {
    return s3Storage({
      endpoint,
      accessKey: process.env.S3_ACCESS_KEY!,
      secretKey: process.env.S3_SECRET_KEY!,
      bucket: process.env.S3_BUCKET!,
      publicBase,
    });
  }

  // Local dev with real files on disk.
  if (endpoint === "file") return fileStorage(ROOT, publicBase);

  // Default (serverless / Vercel): in-memory, never writes to read-only FS.
  return memoryStorage(publicBase);
}
