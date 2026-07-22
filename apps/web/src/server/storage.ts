import { fileStorage, s3Storage } from "./storage-impl";
import type { Storage } from "./tts/storage-port";
import { join } from "node:path";

// repo root from apps/web: two levels up
const ROOT = join(process.cwd(), "..", "..");

export function getStorage(): Storage {
  const endpoint = process.env.S3_ENDPOINT ?? "file";
  const publicBase = process.env.S3_PUBLIC_BASE ?? process.env.APP_URL ?? "http://localhost:3000";
  if (endpoint === "file") return fileStorage(ROOT, publicBase);
  return s3Storage({
    endpoint,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
    bucket: process.env.S3_BUCKET!,
    publicBase,
  });
}
