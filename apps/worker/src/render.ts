import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Resvg } from "@resvg/resvg-js";
import {
  composeSceneSVG, resolveConfig, samplePose,
  FPS, VIDEO_W, type AvatarConfig, type Instance,
} from "@faceless/avatar-core";
import type { LoadedAssets } from "./assets";

export interface RenderInput {
  instances: Instance[];
  durationMs: number;
  config: AvatarConfig;
  assets: LoadedAssets;
  audioPath: string;
  workDir: string;   // /tmp/<jobId>
  outPath: string;   // /tmp/<jobId>/out.mp4
}

// Compose one flat frame SVG at time t (ms). Deterministic; shared with client via samplePose.
export function frameSVG(input: Omit<RenderInput, "audioPath" | "workDir" | "outPath">, tMs: number): string {
  const { assets, config, instances } = input;
  const resolved = resolveConfig(assets.manifest, config);
  const paletteMap = assets.palettes[resolved.palette]!;
  const pose = samplePose(instances, assets.clips, tMs);
  return composeSceneSVG(assets.manifest, resolved, pose, {
    mode: "flat", paletteMap, symbols: assets.symbols,
  });
}

export function renderFramePNG(svg: string, bgHex: string): Buffer {
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: VIDEO_W }, background: bgHex }).render().asPng(),
  );
}

async function runFfmpeg(args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-500)}`))));
  });
}

// Full render: frames -> ffmpeg mux with audio. Returns nothing; writes outPath.
export async function renderVideo(input: RenderInput): Promise<void> {
  const { assets, config, durationMs, workDir, audioPath, outPath } = input;
  const resolved = resolveConfig(assets.manifest, config);
  const bgHex = assets.palettes[resolved.palette]!["--c-wall"]!;
  const framesDir = join(workDir, "frames");
  mkdirSync(framesDir, { recursive: true });

  const frames = Math.ceil((durationMs + 1500) * FPS / 1000);
  for (let f = 0; f < frames; f++) {
    const t = (f * 1000) / FPS;
    const svg = frameSVG(input, t);
    const png = renderFramePNG(svg, bgHex);
    writeFileSync(join(framesDir, `${String(f).padStart(5, "0")}.png`), png);
  }

  await runFfmpeg([
    "-y",
    "-framerate", String(FPS),
    "-i", join(framesDir, "%05d.png"),
    "-i", audioPath,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-shortest",
    outPath,
  ]);
}
