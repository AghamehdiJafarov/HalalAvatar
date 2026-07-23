import { describe, it, expect } from "vitest";
import { FRAMINGS, type FramingId } from "../src/framings.js";

// H.264 MaxFS per level (macroblocks). The browser exporter must pick a level
// that fits the frame; 1080x1924 needs 8228 MB and overflows Level 4.0 (8192).
const LEVELS = [1620, 3600, 5120, 8192, 8192, 8704, 22080, 36864, 36864];
const MAX_SUPPORTED = Math.max(...LEVELS);

describe("H.264 level headroom for every framing", () => {
  for (const id of Object.keys(FRAMINGS) as FramingId[]) {
    it(`${id} fits within an encodable level`, () => {
      const f = FRAMINGS[id];
      const mb = Math.ceil(f.width / 16) * Math.ceil(f.height / 16);
      expect(mb, `${id} needs ${mb} MB`).toBeLessThanOrEqual(MAX_SUPPORTED);
    });
  }

  it("documents that fullbody exceeds Level 4.0 (regression guard)", () => {
    const f = FRAMINGS.fullbody;
    const mb = Math.ceil(f.width / 16) * Math.ceil(f.height / 16);
    expect(mb).toBeGreaterThan(8192);   // this is why the level search exists
    expect(mb).toBeLessThanOrEqual(8704); // Level 4.2 covers it
  });
});
