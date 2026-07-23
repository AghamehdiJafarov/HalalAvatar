import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ASSETS_VERSION, extractSymbols, type Clip, type Manifest } from "@faceless/avatar-core";

// Resolve the versioned asset dir shipped into apps/web/public.
export function assetsDir(root: string): string {
  return join(root, "apps", "web", "public", "assets", `v${ASSETS_VERSION}`);
}

export interface LoadedAssets {
  manifest: Manifest;
  palettes: Record<string, Record<string, string>>;
  clips: Record<string, Clip>;
  symbols: Record<string, string>; // partId -> inner markup for flat mode
}

export function loadAssets(root: string): LoadedAssets {
  const dir = assetsDir(root);
  const manifest: Manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const palettes = JSON.parse(readFileSync(join(dir, "palettes.json"), "utf8"));
  const clips: Record<string, Clip> = JSON.parse(readFileSync(join(dir, "clips.json"), "utf8"));
  const sprites = readFileSync(join(dir, "sprites.svg"), "utf8");
  const symbols = extractSymbols(sprites);
  return { manifest, palettes, clips, symbols };
}
