import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig, composeSceneSVG, type SymbolMap } from "../src/compose.js";
import type { AvatarConfig, Manifest, Pose } from "../src/types.js";
import { ASSETS_VERSION } from "../src/assets-version.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "..", "..", "..", "apps", "web", "public", "assets", `v${ASSETS_VERSION}`);
const manifest: Manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8"));
const palettes: Record<string, Record<string, string>> = JSON.parse(readFileSync(join(ASSETS, "palettes.json"), "utf8"));

// Build a symbol map (partId -> inner markup) from the parts on disk for flat mode.
function symbolMap(): SymbolMap {
  const map: SymbolMap = {};
  const SRC = join(HERE, "..", "..", "assets", "src");
  for (const p of manifest.parts) {
    const raw = readFileSync(join(SRC, p.file), "utf8").trim();
    map[p.id] = raw.replace(/^<symbol[^>]*>/, "").replace(/<\/symbol>$/, "").trim();
  }
  return map;
}

const cfg: AvatarConfig = { archetype: "seated_desk", palette: "ref_blue", parts: {} };
const pose: Pose = {};

describe("resolveConfig", () => {
  it("fills defaults", () => {
    const r = resolveConfig(manifest, cfg);
    expect(r.parts.head).toBe("p_head_blank");
    expect(r.parts.torso).toBe("p_torso_tshirt_a");
  });

  it("unknown ID falls back to default", () => {
    const r = resolveConfig(manifest, { ...cfg, parts: { hair: "p_does_not_exist" } });
    expect(r.parts.hair).toBe("p_hair_short_a");
  });

  it("wrong-slot ID is rejected", () => {
    const r = resolveConfig(manifest, { ...cfg, parts: { hair: "p_glasses_round" } });
    expect(r.parts.hair).toBe("p_hair_short_a");
  });

  it("headwear rule nulls hair", () => {
    const r = resolveConfig(manifest, { ...cfg, parts: { headwear: "p_headwear_kufi", hair: "p_hair_short_a" } });
    expect(r.parts.headwear).toBe("p_headwear_kufi");
    expect(r.parts.hair).toBeNull();
  });

  it("unknown palette falls back to first", () => {
    const r = resolveConfig(manifest, { ...cfg, palette: "neon" });
    expect(r.parts).toBeDefined();
    expect(manifest.palettes).toContain(r.palette);
  });
});

describe("composeSceneSVG", () => {
  const resolved = resolveConfig(manifest, cfg);

  it("browser mode keeps var(--...) and uses <use>", () => {
    const svg = composeSceneSVG(manifest, resolved, pose, {
      mode: "browser", paletteMap: palettes.ref_blue!,
    });
    expect(svg).toContain("<use href=\"#p_head_blank\"/>");
    expect(svg).toContain("<style>");
    expect(svg).toContain("rt_torso");
  });

  it("flat mode contains no var(-- and no <use>", () => {
    const svg = composeSceneSVG(manifest, resolved, pose, {
      mode: "flat", paletteMap: palettes.ref_blue!, symbols: symbolMap(),
    });
    expect(svg).not.toContain("var(--");
    expect(svg).not.toContain("<use");
    expect(svg).toContain("#2E7FC1"); // wall hex substituted
  });

  it("emits all rig group ids with transforms", () => {
    const svg = composeSceneSVG(manifest, resolved, pose, {
      mode: "browser", paletteMap: palettes.ref_blue!,
    });
    for (const g of ["rt_torso", "rt_head", "rt_arm_L", "rt_forearm_L", "rt_hand_L", "rt_arm_R", "rt_forearm_R", "rt_hand_R"]) {
      expect(svg).toContain(`id="${g}" transform=`);
    }
  });

  it("is deterministic byte-for-byte", () => {
    const a = composeSceneSVG(manifest, resolved, pose, { mode: "flat", paletteMap: palettes.ref_blue!, symbols: symbolMap() });
    const b = composeSceneSVG(manifest, resolved, pose, { mode: "flat", paletteMap: palettes.ref_blue!, symbols: symbolMap() });
    expect(a).toBe(b);
  });
});
