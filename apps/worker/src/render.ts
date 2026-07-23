import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Resvg } from "@resvg/resvg-js";
import {
  composeSceneSVG, resolveConfig, samplePose,
  FPS, type AvatarConfig, type Instance,
} from "@faceless/avatar-core";
import type { LoadedAssets } from "./assets";

// Slots dropped for cut-out exports (character isolated on transparency).
const BACKDROP_SLOTS = ["bg_wall", "bg_decor_l", "bg_decor_r", "desk", "prop_desk_a", "prop_desk_b"];

// Standard chroma green for keyers that cannot read an alpha channel.
export const CHROMA_GREEN = "#00B140";

export type FramingId = "scene" | "overlay" | "portrait" | "square";

export interface Framing {
  viewBox: string;
  hideSlots: string[];
  width: number;
  height: number;
}

// Character content spans x 606..994, y 128..664 in scene coords.
// Cut-out crops end at y=632 so the torso meets the frame edge instead of floating.
export const FRAMINGS: Record<FramingId, Framing> = {
  scene:    { viewBox: "0 0 1600 900",    hideSlots: [],             width: 1920, height: 1080 },
  overlay:  { viewBox: "560 90 480 542",  hideSlots: BACKDROP_SLOTS, width: 1080, height: 1220 },
  portrait: { viewBox: "575 -168 450 800", hideSlots: BACKDROP_SLOTS, width: 1080, height: 1920 },
  square:   { viewBox: "530 92 540 540",  hideSlots: BACKDROP_SLOTS, width: 1080, height: 1080 },
};

export type FormatId = "mp4" | "mp4_green" | "mov_qtrle" | "mov_prores" | "png_seq";

export interface FormatSpec {
  ext: string;
  alpha: boolean;         // frames rendered with transparency
  background?: string;    // solid backdrop when not alpha
  pixFilter: string;      // format filter appended to the scale chain
  args: string[];         // ffmpeg codec args
}

// WebM/VP9 alpha is deliberately absent: libvpx in common ffmpeg builds silently
// drops the alpha layer, producing an opaque file. Verified by decoding.
export const FORMATS: Record<FormatId, FormatSpec> = {
  // Finished clip on the palette background.
  mp4:        { ext: "mp4",  alpha: false, pixFilter: "yuv420p",
                args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"] },
  // Chroma key for editors without alpha support (CapCut, mobile apps).
  mp4_green:  { ext: "mp4",  alpha: false, background: CHROMA_GREEN, pixFilter: "yuv420p",
                args: ["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p"] },
  // Default cut-out: true alpha, lossless, light on flat art, opens everywhere.
  mov_qtrle:  { ext: "mov",  alpha: true,  pixFilter: "rgba",
                args: ["-c:v", "qtrle"] },
  // Pro alpha for Premiere/FCP/Resolve pipelines. Large files.
  mov_prores: { ext: "mov",  alpha: true,  pixFilter: "yuva444p10le",
                args: ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-alpha_bits", "16", "-vendor", "apl0"] },
  // Frame sequence: universal fallback.
  png_seq:    { ext: "zip",  alpha: true,  pixFilter: "rgba", args: [] },
};

export interface RenderInput {
  instances: Instance[];
  durationMs: number;
  config: AvatarConfig;
  assets: LoadedAssets;
  audioPath?: string;
  workDir: string;
  outPath: string;
  framing?: FramingId;
  format?: FormatId;
}

// Compose one flat frame SVG at time t (ms). Deterministic; shares samplePose with the client.
export function frameSVG(
  input: Pick<RenderInput, "assets" | "config" | "instances" | "framing">,
  tMs: number,
): string {
  const { assets, config, instances } = input;
  const framing = FRAMINGS[input.framing ?? "scene"];
  const resolved = resolveConfig(assets.manifest, config);
  const paletteMap = assets.palettes[resolved.palette]!;
  const pose = samplePose(instances, assets.clips, tMs);
  return composeSceneSVG(assets.manifest, resolved, pose, {
    mode: "flat",
    paletteMap,
    symbols: assets.symbols,
    hideSlots: framing.hideSlots,
    viewBox: framing.viewBox,
  });
}

// Rasterize a frame. Omitting background yields a real alpha channel.
export function renderFramePNG(svg: string, width: number, background?: string): Buffer {
  return Buffer.from(
    new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      ...(background ? { background } : {}),
    }).render().asPng(),
  );
}

async function run(cmd: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}: ${err.slice(-600)}`))));
  });
}

// Full render: frames -> encode. Writes outPath.
export async function renderVideo(input: RenderInput): Promise<void> {
  const { assets, config, durationMs, workDir, audioPath, outPath } = input;
  const framing = FRAMINGS[input.framing ?? "scene"];
  const format = FORMATS[input.format ?? "mp4"];

  const resolved = resolveConfig(assets.manifest, config);
  const paletteWall = assets.palettes[resolved.palette]!["--c-wall"]!;
  const background = format.alpha ? undefined : (format.background ?? paletteWall);

  const framesDir = join(workDir, "frames");
  mkdirSync(framesDir, { recursive: true });

  const frames = Math.ceil((durationMs + 1500) * FPS / 1000);
  for (let f = 0; f < frames; f++) {
    const svg = frameSVG(input, (f * 1000) / FPS);
    const png = renderFramePNG(svg, framing.width, background);
    writeFileSync(join(framesDir, `${String(f).padStart(5, "0")}.png`), png);
  }

  if (input.format === "png_seq") {
    await run("zip", ["-q", "-j", "-r", outPath, framesDir]);
    return;
  }

  const args = ["-y", "-framerate", String(FPS), "-i", join(framesDir, "%05d.png")];
  if (audioPath) args.push("-i", audioPath);
  args.push("-vf", `scale=${framing.width}:${framing.height}:flags=lanczos,format=${format.pixFilter}`, ...format.args);
  if (audioPath) args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
  else args.push("-an");
  args.push(outPath);

  await run("ffmpeg", args);
}
