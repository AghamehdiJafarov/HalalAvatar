import { LIMITS, PIVOTS, type RigTarget } from "./constants";
import type { Clip, Easing, Instance, Key, Pose, Track } from "./types";

// ---- 9.2 Easings (quadratic) ----
export const ease = (e: Easing = "io", u: number): number =>
  e === "lin" ? u :
  e === "in"  ? u * u :
  e === "out" ? 1 - (1 - u) * (1 - u) :
  u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u);

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v: number) => clamp(v, 0, 1);

// ---- 9.3 Track sampling ----
export function sampleTrack(keys: Key[], t: number): number {
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  if (t <= first.t) return first.v;
  if (t >= last.t) return last.v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t >= a.t && t < b.t) {
      const u = (t - a.t) / (b.t - a.t);
      return lerp(a.v, b.v, ease(a.e, u));
    }
  }
  return last.v;
}

// ---- 9.4 Envelope ----
function env(clip: Clip, lt: number): number {
  if (clip.loop) return 1; // gating for loop clips handled by [startMs,endMs] window in samplePose
  const fin = clip.fadeInMs ? lt / clip.fadeInMs : 1;
  const fout = clip.fadeOutMs ? (clip.durationMs - lt) / clip.fadeOutMs : 1;
  return clamp01(Math.min(fin, fout));
}

const ZERO = () => ({ r: 0, tx: 0, ty: 0, sx: 0, sy: 0 });

// ---- 9.5 Additive pose summation. Pure, deterministic. ----
export function samplePose(instances: Instance[], clips: Record<string, Clip>, tMs: number): Pose {
  const acc: Record<string, { r: number; tx: number; ty: number; sx: number; sy: number }> = {};
  const touched: RigTarget[] = [];

  for (const inst of instances) {
    const clip = clips[inst.clip];
    if (!clip) continue;

    let lt: number;
    if (clip.loop) {
      const end = inst.endMs ?? Infinity;
      if (tMs < inst.startMs || tMs > end) continue;
      lt = (tMs - inst.startMs) % clip.durationMs;
    } else {
      lt = tMs - inst.startMs;
      if (lt < 0 || lt > clip.durationMs) continue;
    }

    const w = env(clip, lt);
    if (w === 0) continue;

    for (const track of clip.tracks) {
      const key = track.target as string;
      if (!acc[key]) { acc[key] = ZERO(); touched.push(track.target); }
      acc[key]![track.prop] += w * sampleTrack(track.keys, lt);
    }
  }

  const pose: Pose = {};
  for (const target of touched) {
    const a = acc[target as string]!;
    pose[target] = {
      r: clamp(a.r, -LIMITS.r, LIMITS.r),
      tx: clamp(a.tx, -LIMITS.t, LIMITS.t),
      ty: clamp(a.ty, -LIMITS.t, LIMITS.t),
      sx: clamp(a.sx, -LIMITS.s, LIMITS.s),
      sy: clamp(a.sy, -LIMITS.s, LIMITS.s),
    };
  }
  return pose;
}

// ---- 5.3 Transform string for one wrapper group ----
export function transformFor(target: RigTarget, pose: Pose): string {
  const p = PIVOTS[target];
  const s = pose[target];
  const r = s?.r ?? 0, tx = s?.tx ?? 0, ty = s?.ty ?? 0, sx = s?.sx ?? 0, sy = s?.sy ?? 0;
  // Round to keep browser/server byte-parity of the emitted string.
  const n = (x: number) => {
    const v = Math.round(x * 1000) / 1000;
    return Object.is(v, -0) ? 0 : v;
  };
  return `translate(${n(p.x + tx)},${n(p.y + ty)}) rotate(${n(r)}) scale(${n(1 + sx)},${n(1 + sy)}) translate(${n(-p.x)},${n(-p.y)})`;
}

export const RIG_TARGETS = Object.keys(PIVOTS) as RigTarget[];

// ---- 9.6 Browser player ----
export class AvatarPlayer {
  private svg: SVGSVGElement;
  private clips: Record<string, Clip>;
  private instances: Instance[] = [];
  private audio: HTMLAudioElement | null = null;
  private raf = 0;
  private t0 = 0;
  private groups: Partial<Record<RigTarget, SVGGElement>> = {};
  private loopMs = 0;   // >0 wraps playback time, so catalog loops repeat forever

  constructor(svgRoot: SVGSVGElement, clips: Record<string, Clip>, opts?: { loopMs?: number }) {
    this.svg = svgRoot;
    this.clips = clips;
    this.loopMs = opts?.loopMs ?? 0;
    for (const target of RIG_TARGETS) {
      const el = svgRoot.querySelector<SVGGElement>(`#${target}`);
      if (el) this.groups[target] = el;
    }
  }

  load(instances: Instance[]): void { this.instances = instances; }
  attachAudio(el: HTMLAudioElement): void { this.audio = el; }

  private nowMs(): number {
    let t: number;
    if (this.audio && (!this.audio.paused || this.audio.currentTime > 0)) t = this.audio.currentTime * 1000;
    else t = performance.now() - this.t0;
    return this.loopMs > 0 ? t % this.loopMs : t;
  }

  setLoopMs(ms: number): void { this.loopMs = ms; }

  private apply(tMs: number): void {
    const pose = samplePose(this.instances, this.clips, tMs);
    for (const target of RIG_TARGETS) {
      const g = this.groups[target];
      if (g) g.setAttribute("transform", transformFor(target, pose));
    }
  }

  seek(tMs: number): void { this.apply(tMs); }

  start(): void {
    this.stop();
    this.t0 = performance.now();
    const tick = () => {
      this.apply(this.nowMs());
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}
