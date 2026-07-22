import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

export interface Storage {
  head(key: string): Promise<boolean>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  getText(key: string): Promise<string | null>;
  getBytes(key: string, destPath: string): Promise<void>;
  publicUrl(key: string): string;
}

// Local filesystem adapter (dev, S3_ENDPOINT=file) writing under apps/web/public/dev-storage.
export function fileStorage(root: string, publicBase: string): Storage {
  const baseDir = join(root, "apps", "web", "public", "dev-storage");
  const p = (key: string) => join(baseDir, key);
  return {
    async head(key) { return existsSync(p(key)); },
    async put(key, body) { mkdirSync(dirname(p(key)), { recursive: true }); writeFileSync(p(key), body); },
    async getText(key) { return existsSync(p(key)) ? readFileSync(p(key), "utf8") : null; },
    async getBytes(key, destPath) { mkdirSync(dirname(destPath), { recursive: true }); writeFileSync(destPath, readFileSync(p(key))); },
    publicUrl(key) { return `${publicBase}/dev-storage/${key}`; },
  };
}

// S3/R2 adapter.
export function s3Storage(opts: {
  endpoint: string; region?: string; accessKey: string; secretKey: string;
  bucket: string; publicBase: string;
}): Storage {
  const client = new S3Client({
    endpoint: opts.endpoint, region: opts.region ?? "auto",
    credentials: { accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey },
    forcePathStyle: true,
  });
  const { bucket, publicBase } = opts;
  return {
    async head(key) {
      try { await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })); return true; }
      catch { return false; }
    },
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: body, ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }));
    },
    async getText(key) {
      try {
        const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return await r.Body!.transformToString();
      } catch { return null; }
    },
    async getBytes(key, destPath) {
      const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await r.Body!.transformToByteArray();
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, bytes);
    },
    publicUrl(key) { return `${publicBase}/${key}`; },
  };
}

export function storageFromEnv(root: string): Storage {
  const endpoint = process.env.S3_ENDPOINT ?? "file";
  const publicBase = process.env.S3_PUBLIC_BASE ?? (process.env.APP_URL ?? "http://localhost:3000");
  if (endpoint === "file") return fileStorage(root, publicBase);
  return s3Storage({
    endpoint,
    accessKey: process.env.S3_ACCESS_KEY!,
    secretKey: process.env.S3_SECRET_KEY!,
    bucket: process.env.S3_BUCKET!,
    publicBase,
  });
}
