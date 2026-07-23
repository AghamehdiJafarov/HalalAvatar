import { describe, it, expect } from "vitest";
import { FRAMINGS, BACKDROP_SLOTS, type FramingId } from "../src/framings.js";

// Character bounds in scene coords per archetype (measured from assets).
const BOUNDS = {
  seated_desk: { minX: 606, maxX: 994, minY: 128, bottomMin: 600, bottomMax: 640 },
  standing:    { minX: 648, maxX: 944, minY: 114, bottomMin: 560, bottomMax: 900 },
} as const;

describe("export framings", () => {
  const ids = Object.keys(FRAMINGS) as FramingId[];

  it("every framing hides the whole backdrop", () => {
    for (const id of ids)
      for (const slot of BACKDROP_SLOTS) expect(FRAMINGS[id].hideSlots).toContain(slot);
  });

  it("output dimensions are even (yuv420p requirement)", () => {
    for (const id of ids) {
      expect(FRAMINGS[id].width % 2, id).toBe(0);
      expect(FRAMINGS[id].height % 2, id).toBe(0);
    }
  });

  it("viewBox aspect matches output aspect within 1%", () => {
    for (const id of ids) {
      const [, , w, h] = FRAMINGS[id].viewBox.split(/\s+/).map(Number);
      const diff = Math.abs(w! / h! - FRAMINGS[id].width / FRAMINGS[id].height) / (FRAMINGS[id].width / FRAMINGS[id].height);
      expect(diff, id).toBeLessThan(0.01);
    }
  });

  it("character fits horizontally in every crop of its archetype", () => {
    for (const id of ids) {
      const f = FRAMINGS[id];
      const b = BOUNDS[f.archetype];
      const [x, , w] = f.viewBox.split(/\s+/).map(Number);
      expect(x!, id).toBeLessThanOrEqual(b.minX);
      expect(x! + w!, id).toBeGreaterThanOrEqual(b.maxX);
    }
  });

  it("crop top clears the tallest headwear of its archetype", () => {
    for (const id of ids) {
      const f = FRAMINGS[id];
      const [, y] = f.viewBox.split(/\s+/).map(Number);
      expect(y!, id).toBeLessThanOrEqual(BOUNDS[f.archetype].minY);
    }
  });

  it("crop bottom lands in the sanctioned band of its archetype", () => {
    for (const id of ids) {
      const f = FRAMINGS[id];
      const b = BOUNDS[f.archetype];
      const [, y, , h] = f.viewBox.split(/\s+/).map(Number);
      expect(y! + h!, id).toBeGreaterThan(b.bottomMin);
      expect(y! + h!, id).toBeLessThanOrEqual(b.bottomMax);
    }
  });

  it("full-body crops include the feet (y=860) with margin", () => {
    for (const id of ["fullbody", "fullbody_tight"] as FramingId[]) {
      const [, y, , h] = FRAMINGS[id].viewBox.split(/\s+/).map(Number);
      expect(y! + h!, id).toBeGreaterThanOrEqual(866);
    }
  });
});
