import { describe, it, expect } from "vitest";
import { ease, sampleTrack, samplePose, transformFor } from "../src/anim.js";
import type { Clip, Instance, Key } from "../src/types.js";

const keys: Key[] = [
  { t: 0, v: 0, e: "io" },
  { t: 1000, v: 10, e: "io" },
  { t: 2000, v: 0 },
];

describe("easings", () => {
  it("hits control points", () => {
    for (const e of ["lin", "in", "out", "io"] as const) {
      expect(ease(e, 0)).toBeCloseTo(0, 6);
      expect(ease(e, 1)).toBeCloseTo(1, 6);
    }
    expect(ease("lin", 0.5)).toBeCloseTo(0.5, 6);
    expect(ease("in", 0.5)).toBeCloseTo(0.25, 6);
    expect(ease("out", 0.5)).toBeCloseTo(0.75, 6);
    expect(ease("io", 0.5)).toBeCloseTo(0.5, 6);
  });
});

describe("sampleTrack", () => {
  it("clamps at ends", () => {
    expect(sampleTrack(keys, -100)).toBe(0);
    expect(sampleTrack(keys, 5000)).toBe(0);
  });
  it("hits exact key values", () => {
    expect(sampleTrack(keys, 0)).toBe(0);
    expect(sampleTrack(keys, 1000)).toBe(10);
    expect(sampleTrack(keys, 2000)).toBe(0);
  });
  it("interpolates within segment", () => {
    const v = sampleTrack(keys, 500); // io ease at u=0.5 -> 0.5 -> 5
    expect(v).toBeCloseTo(5, 6);
  });
});

const breathe: Clip = {
  id: "idle_breathe", durationMs: 2000, loop: true,
  tracks: [{ target: "rt_torso", prop: "ty", keys: [
    { t: 0, v: 0, e: "io" }, { t: 1000, v: -4, e: "io" }, { t: 2000, v: 0 },
  ] }],
};

describe("samplePose", () => {
  it("is deterministic (deep equal on repeat)", () => {
    const inst: Instance[] = [{ clip: "idle_breathe", startMs: 0, endMs: 10000 }];
    const a = samplePose(inst, { idle_breathe: breathe }, 1234);
    const b = samplePose(inst, { idle_breathe: breathe }, 1234);
    expect(a).toEqual(b);
  });

  it("loops correctly (t and t+duration match)", () => {
    const inst: Instance[] = [{ clip: "idle_breathe", startMs: 0, endMs: 10000 }];
    const a = samplePose(inst, { idle_breathe: breathe }, 500);
    const b = samplePose(inst, { idle_breathe: breathe }, 2500);
    expect(a.rt_torso!.ty).toBeCloseTo(b.rt_torso!.ty, 6);
  });

  it("gates loop clip outside [startMs,endMs]", () => {
    const inst: Instance[] = [{ clip: "idle_breathe", startMs: 1000, endMs: 2000 }];
    expect(samplePose(inst, { idle_breathe: breathe }, 500)).toEqual({});
    expect(samplePose(inst, { idle_breathe: breathe }, 3000)).toEqual({});
  });

  it("clamps a synthetic amplitude-100 clip to LIMITS", () => {
    const big: Clip = { id: "big", durationMs: 1000, loop: false, tracks: [
      { target: "rt_head", prop: "r", keys: [{ t: 0, v: 100 }, { t: 1000, v: 100 }] },
      { target: "rt_head", prop: "tx", keys: [{ t: 0, v: 100 }, { t: 1000, v: 100 }] },
      { target: "rt_head", prop: "sx", keys: [{ t: 0, v: 100 }, { t: 1000, v: 100 }] },
    ] };
    const pose = samplePose([{ clip: "big", startMs: 0 }], { big }, 500);
    expect(pose.rt_head!.r).toBe(25);
    expect(pose.rt_head!.tx).toBe(40);
    expect(pose.rt_head!.sx).toBe(0.05);
  });

  it("sums two additive clips on same target", () => {
    const c1: Clip = { id: "c1", durationMs: 1000, loop: false, tracks: [
      { target: "rt_head", prop: "r", keys: [{ t: 0, v: 3 }, { t: 1000, v: 3 }] }] };
    const c2: Clip = { id: "c2", durationMs: 1000, loop: false, tracks: [
      { target: "rt_head", prop: "r", keys: [{ t: 0, v: 4 }, { t: 1000, v: 4 }] }] };
    const pose = samplePose(
      [{ clip: "c1", startMs: 0 }, { clip: "c2", startMs: 0 }], { c1, c2 }, 500);
    expect(pose.rt_head!.r).toBe(7);
  });
});

describe("transformFor", () => {
  it("neutral pose yields identity-ish string around pivot", () => {
    const s = transformFor("rt_head", {});
    expect(s).toBe("translate(800,400) rotate(0) scale(1,1) translate(-800,-400)");
  });
  it("applies additive delta", () => {
    const s = transformFor("rt_head", { rt_head: { r: 5, ty: 6 } });
    expect(s).toBe("translate(800,406) rotate(5) scale(1,1) translate(-800,-400)");
  });
});
