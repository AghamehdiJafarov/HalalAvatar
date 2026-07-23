"use client";
import {
  composeSceneSVG, resolveConfig, samplePose, extractSymbols, ASSETS_VERSION,
  FRAMINGS, CHROMA_GREEN,
  type AvatarConfig, type Clip, type FramingId, type Instance, type Manifest,
} from "@faceless/avatar-core";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import JSZip from "jszip";

const FPS = 30;

// Crops come from the core so browser and worker always agree.
export { FRAMINGS as BROWSER_FRAMINGS, CHROMA_GREEN };
export type BrowserFraming = FramingId;

interface FlatAssets {
  manifest: Manifest;
  palettes: Record<string, Record<string, string>>;
  clips: Record<string, Clip>;
  symbols: Record<string, string>;
}

let flatCache: FlatAssets | null = null;

export async function loadFlatAssets(): Promise<FlatAssets> {
  if (flatCache) return flatCache;
  const base = `/assets/v${ASSETS_VERSION}`;
  const [manifest, palettes, clips, spritesTxt] = await Promise.all([
    fetch(`${base}/manifest.json`).then((r) => r.json()),
    fetch(`${base}/palettes.json`).then((r) => r.json()),
    fetch(`${base}/clips.json`).then((r) => r.json()),
    fetch(`${base}/sprites.svg`).then((r) => r.text()),
  ]);
  flatCache = { manifest, palettes, clips, symbols: extractSymbols(spritesTxt) };
  return flatCache;
}

// Flat SVG (hex colours inlined, no <use>) — same path the video worker uses.
function flatFrameSVG(
  a: FlatAssets, config: AvatarConfig, instances: Instance[],
  framing: BrowserFraming, tMs: number,
): string {
  const fr = FRAMINGS[framing];
  const resolved = resolveConfig(a.manifest, config);
  const pose = samplePose(instances, a.clips, tMs);
  return composeSceneSVG(a.manifest, resolved, pose, {
    mode: "flat",
    paletteMap: a.palettes[resolved.palette]!,
    symbols: a.symbols,
    hideSlots: fr.hideSlots,
    viewBox: fr.viewBox,
  });
}

// Same-origin blob SVG does not taint the canvas, so toBlob/VideoFrame stay legal.
async function svgToBitmap(svg: string, w: number, h: number): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(w, h);
    img.src = url;
    await img.decode();
    return await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface ExportJob {
  config: AvatarConfig;
  instances: Instance[];
  durationMs: number;
  framing: BrowserFraming;
  onProgress?: (done: number, total: number) => void;
}

// ---- PNG sequence with a real alpha channel. Works in every browser. ----
export async function exportPngZip(job: ExportJob): Promise<Blob> {
  const a = await loadFlatAssets();
  const fr = FRAMINGS[job.framing];
  const canvas = document.createElement("canvas");
  canvas.width = fr.width; canvas.height = fr.height;
  const ctx = canvas.getContext("2d", { alpha: true })!;
  const zip = new JSZip();
  const total = Math.round(job.durationMs * FPS / 1000);

  for (let f = 0; f < total; f++) {
    const svg = flatFrameSVG(a, job.config, job.instances, job.framing, (f * 1000) / FPS);
    const bmp = await svgToBitmap(svg, fr.width, fr.height);
    ctx.clearRect(0, 0, fr.width, fr.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
    zip.file(`${String(f).padStart(5, "0")}.png`, blob);
    job.onProgress?.(f + 1, total);
    if (f % 8 === 0) await new Promise((r) => setTimeout(r, 0)); // keep the UI alive
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

// ---- Chroma-key MP4 via WebCodecs (Chrome/Edge). Faster than realtime. ----
export function webCodecsSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window;
}

// H.264 levels by MaxFS (macroblocks). A 1080x1924 frame needs 8228 MB, which
// overflows Level 4.0 (8192) — hence levels up to 5.2 and a size-driven search
// instead of a fixed guess.
const AVC_LEVELS: { hex: string; maxMB: number }[] = [
  { hex: "1e", maxMB: 1620 },  // 3.0
  { hex: "1f", maxMB: 3600 },  // 3.1
  { hex: "20", maxMB: 5120 },  // 3.2
  { hex: "28", maxMB: 8192 },  // 4.0
  { hex: "29", maxMB: 8192 },  // 4.1
  { hex: "2a", maxMB: 8704 },  // 4.2
  { hex: "32", maxMB: 22080 }, // 5.0
  { hex: "33", maxMB: 36864 }, // 5.1
  { hex: "34", maxMB: 36864 }, // 5.2
];

async function pickAvcCodec(width: number, height: number): Promise<string | null> {
  const mb = Math.ceil(width / 16) * Math.ceil(height / 16);
  // Try levels that actually fit this frame, smallest first; High then Baseline.
  const fitting = AVC_LEVELS.filter((l) => mb <= l.maxMB);
  const candidates: string[] = [];
  for (const l of fitting) candidates.push(`avc1.6400${l.hex}`); // High profile
  for (const l of fitting) candidates.push(`avc1.4200${l.hex}`); // Baseline
  for (const l of fitting) candidates.push(`avc1.4d00${l.hex}`); // Main

  for (const codec of candidates) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec, width, height, framerate: FPS, bitrate: 5_000_000,
      });
      if (supported) return codec;
    } catch { /* try next */ }
  }
  return null;
}

// Some Chrome builds ship without an H.264 encoder at all (licensing). VP9 is
// royalty-free, always present alongside WebCodecs, and valid inside MP4.
async function pickVp9(width: number, height: number): Promise<string | null> {
  for (const codec of ["vp09.00.51.08", "vp09.00.41.08", "vp09.00.10.08"]) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec, width, height, framerate: FPS, bitrate: 5_000_000,
      });
      if (supported) return codec;
    } catch { /* try next */ }
  }
  return null;
}

export async function exportGreenMp4(job: ExportJob): Promise<Blob> {
  const a = await loadFlatAssets();
  const fr = FRAMINGS[job.framing];
  let codec = await pickAvcCodec(fr.width, fr.height);
  let muxCodec: "avc" | "vp9" = "avc";
  if (!codec) {
    codec = await pickVp9(fr.width, fr.height);
    muxCodec = "vp9";
  }
  if (!codec) throw new Error(
    `Браузер не смог закодировать MP4 в размере ${fr.width}x${fr.height}. ` +
    "Выбери PNG-кадры с прозрачностью или WebM.",
  );

  const canvas = document.createElement("canvas");
  canvas.width = fr.width; canvas.height = fr.height;
  const ctx = canvas.getContext("2d")!;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    fastStart: "in-memory",
    video: { codec: muxCodec, width: fr.width, height: fr.height, frameRate: FPS },
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e; },
  });
  encoder.configure({ codec, width: fr.width, height: fr.height, framerate: FPS, bitrate: 5_000_000 });

  const total = Math.round(job.durationMs * FPS / 1000);
  for (let f = 0; f < total; f++) {
    if (failure) throw failure;
    const svg = flatFrameSVG(a, job.config, job.instances, job.framing, (f * 1000) / FPS);
    const bmp = await svgToBitmap(svg, fr.width, fr.height);
    ctx.fillStyle = CHROMA_GREEN;
    ctx.fillRect(0, 0, fr.width, fr.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
    encoder.encode(frame, { keyFrame: f % 30 === 0 });
    frame.close();
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 0));
    job.onProgress?.(f + 1, total);
  }
  await encoder.flush();
  encoder.close();
  muxer.finalize();
  if (failure) throw failure;
  return new Blob([target.buffer], { type: "video/mp4" });
}

// ---- Fallback: realtime capture to WebM (may drop frames on slow devices). ----
export async function exportGreenWebmRealtime(job: ExportJob): Promise<Blob> {
  const a = await loadFlatAssets();
  const fr = FRAMINGS[job.framing];
  const canvas = document.createElement("canvas");
  canvas.width = fr.width; canvas.height = fr.height;
  const ctx = canvas.getContext("2d")!;

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9" : "video/webm";
  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const finished = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: "video/webm" })); });

  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = async () => {
      const t = performance.now() - t0;
      if (t >= job.durationMs) { resolve(); return; }
      const svg = flatFrameSVG(a, job.config, job.instances, job.framing, t);
      const bmp = await svgToBitmap(svg, fr.width, fr.height);
      ctx.fillStyle = CHROMA_GREEN;
      ctx.fillRect(0, 0, fr.width, fr.height);
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      job.onProgress?.(Math.round(t), Math.round(job.durationMs));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  return finished;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const el = document.createElement("a");
  el.href = url;
  el.download = filename;
  el.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
