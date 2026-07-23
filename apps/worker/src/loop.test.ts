import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frameSVG } from "./render";
import { loadAssets, assetsDir } from "./assets";
import type { Instance } from "@faceless/avatar-core";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const assets = loadAssets(ROOT);
const anims = JSON.parse(readFileSync(join(assetsDir(ROOT), "animations.json"), "utf8"));
const config = { archetype: "seated_desk", palette: "ref_blue", parts: {} };

describe("catalog loop seamlessness", () => {
  const D: number = anims.loopDurationMs;

  for (const preset of anims.presets) {
    it(`preset "${preset.id}": frame(0) === frame(${D}) byte-for-byte`, () => {
      const base = { assets, config, instances: preset.instances as Instance[], framing: "overlay" as const };
      expect(frameSVG(base, 0)).toBe(frameSVG(base, D));
    });
  }

  it("mid-loop frames differ from frame 0 (animation actually moves)", () => {
    const preset = anims.presets.find((p: { id: string }) => p.id === "greeting");
    const base = { assets, config, instances: preset.instances as Instance[], framing: "overlay" as const };
    expect(frameSVG(base, 1100)).not.toBe(frameSVG(base, 0));
  });
});
