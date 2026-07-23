import { describe, it, expect } from "vitest";
import { FRAMINGS, BACKDROP_SLOTS, type FramingId } from "../src/framings.js";

// Character bounds in scene coords, measured from the reference assets:
// arms x 606..994, hijab/hair top y≈128, phone bottom y≈664.
const CHAR = { minX: 606, maxX: 994, minY: 128 };

describe("export framings", () => {
  const ids = Object.keys(FRAMINGS) as FramingId[];

  it("every framing hides the whole backdrop", () => {
    for (const id of ids) {
      for (const slot of BACKDROP_SLOTS) expect(FRAMINGS[id].hideSlots).toContain(slot);
    }
  });

  it("output dimensions are even (yuv420p requirement)", () => {
    for (const id of ids) {
      expect(FRAMINGS[id].width % 2).toBe(0);
      expect(FRAMINGS[id].height % 2).toBe(0);
    }
  });

  it("viewBox aspect matches output aspect within 1%", () => {
    for (const id of ids) {
      const [, , w, h] = FRAMINGS[id].viewBox.split(/\s+/).map(Number);
      const boxAspect = w! / h!;
      const outAspect = FRAMINGS[id].width / FRAMINGS[id].height;
      expect(Math.abs(boxAspect - outAspect) / outAspect).toBeLessThan(0.01);
    }
  });

  it("character fits horizontally in every crop", () => {
    for (const id of ids) {
      const [x, , w] = FRAMINGS[id].viewBox.split(/\s+/).map(Number);
      expect(x!).toBeLessThanOrEqual(CHAR.minX);
      expect(x! + w!).toBeGreaterThanOrEqual(CHAR.maxX);
    }
  });

  it("crop top clears the tallest headwear", () => {
    for (const id of ids) {
      const [, y] = FRAMINGS[id].viewBox.split(/\s+/).map(Number);
      expect(y!).toBeLessThanOrEqual(CHAR.minY);
    }
  });

  it("crop bottom sits at the desk line so the torso meets the frame edge", () => {
    for (const id of ids) {
      const [, y, , h] = FRAMINGS[id].viewBox.split(/\s+/).map(Number);
      expect(y! + h!).toBeGreaterThan(600);
      expect(y! + h!).toBeLessThanOrEqual(640);
    }
  });
});
