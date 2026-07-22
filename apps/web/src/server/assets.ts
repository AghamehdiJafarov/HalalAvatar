import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSETS_VERSION, type Clip, type Manifest } from "@faceless/avatar-core";

const ROOT = join(process.cwd(), "..", "..");
const DIR = join(ROOT, "apps", "web", "public", "assets", `v${ASSETS_VERSION}`);

let cache: { manifest: Manifest; clips: Record<string, Clip>; clipDur: Record<string, number> } | null = null;

export function serverAssets() {
  if (cache) return cache;
  const manifest: Manifest = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8"));
  const clips: Record<string, Clip> = JSON.parse(readFileSync(join(DIR, "clips.json"), "utf8"));
  const clipDur: Record<string, number> = {};
  for (const [id, c] of Object.entries(clips)) clipDur[id] = c.durationMs;
  cache = { manifest, clips, clipDur };
  return cache;
}
