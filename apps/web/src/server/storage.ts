import { fileStorage, s3Storage, memoryStorage } from "./storage-impl";
import type { Storage } from "./tts/storage-port";
import { join } from "node:path";

const ROOT = join(process.cwd(), "..", "..");

export function getStorage(): Storage {
  const endpoint = process.env.S3_ENDPOINT ?? "memory";
  const publicBase = process.env.S3_PUBLIC_BASE ?? process.env.APP_URL ?? "";

  if (endpoint !== "memory" && endpoint !== "file") {
    return s3Storage({
      endpoint,
      accessKey: process.env.S3_ACCESS_KEY!,
      secretKey: process.env.S3_SECRET_KEY!,
      bucket: process.env.S3_BUCKET!,
      publicBase,
    });
  }

  if (endpoint === "file") return fileStorage(ROOT, publicBase);

  return memoryStorage(publicBase);
}
