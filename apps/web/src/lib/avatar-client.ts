"use client";
import {
  ASSETS_VERSION, resolveConfig, composeSceneSVG,
  type AvatarConfig, type Clip, type Instance, type Manifest,
} from "@faceless/avatar-core";

export interface AnimPreset {
  id: string;
  title: string;
  posterMs: number;
  instances: Instance[];
  archetypes?: string[];
}
export interface AnimCatalog {
  loopDurationMs: number;
  presets: AnimPreset[];
}

export interface ClientAssets {
  manifest: Manifest;
  palettes: Record<string, Record<string, string>>;
  clips: Record<string, Clip>;
  animations: AnimCatalog;
  spritesInjected: boolean;
}

let cache: ClientAssets | null = null;
let spriteInjected = false;

const base = `/assets/v${ASSETS_VERSION}`;

export async function loadClientAssets(): Promise<ClientAssets> {
  if (cache) return cache;
  const [manifest, palettes, clips, animations, sprites] = await Promise.all([
    fetch(`${base}/manifest.json`).then((r) => r.json()),
    fetch(`${base}/palettes.json`).then((r) => r.json()),
    fetch(`${base}/clips.json`).then((r) => r.json()),
    fetch(`${base}/animations.json`).then((r) => r.json()),
    fetch(`${base}/sprites.svg`).then((r) => r.text()),
  ]);
  injectSprites(sprites);
  cache = { manifest, palettes, clips, animations, spritesInjected: true };
  return cache;
}

// Spec 16 step 2: inject the sprite sheet ONCE. This is the single allowed innerHTML,
// sourced from our own same-origin static file.
function injectSprites(spritesSvg: string): void {
  if (spriteInjected || typeof document === "undefined") return;
  if (document.getElementById("faceless-sprites")) { spriteInjected = true; return; }
  const holder = document.createElement("div");
  holder.id = "faceless-sprites";
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  holder.innerHTML = spritesSvg; // trusted, static, same-origin
  document.body.appendChild(holder);
  spriteInjected = true;
}

// Compose the browser-mode scene SVG string for a config in neutral pose.
export function composeBrowserScene(assets: ClientAssets, cfg: AvatarConfig): string {
  const resolved = resolveConfig(assets.manifest, cfg);
  const paletteMap = assets.palettes[resolved.palette]!;
  return composeSceneSVG(assets.manifest, resolved, {}, { mode: "browser", paletteMap });
}
