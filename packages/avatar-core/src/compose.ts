import { transformFor } from "./anim";
import type { RigTarget } from "./constants";
import type { Archetype, AvatarConfig, Manifest, Pose, ResolvedConfig } from "./types";

// ---- 6. Resolve config: defaults + parts + rules + drop unknown IDs ----
export function resolveConfig(manifest: Manifest, cfg: AvatarConfig): ResolvedConfig {
  const archetype = manifest.archetypes.find((a) => a.id === cfg.archetype) ?? manifest.archetypes[0]!;
  const bySlot = new Map<string, string>(); // partId -> slot
  const known = new Set<string>();
  for (const p of manifest.parts) { bySlot.set(p.id, p.slot); known.add(p.id); }

  const parts: Record<string, string | null> = { ...archetype.defaults };

  for (const [slot, id] of Object.entries(cfg.parts ?? {})) {
    if (id === null) { parts[slot] = null; continue; }
    if (!known.has(id)) continue;             // unknown ID -> keep default (warn upstream)
    if (bySlot.get(id) !== slot) continue;    // wrong slot -> keep default
    parts[slot] = id;
  }

  // Apply rules after merge (e.g. headwear nulls hair)
  for (const rule of archetype.rules ?? []) {
    const cur = parts[rule.if.slot] ?? null;
    let match = false;
    if (Object.prototype.hasOwnProperty.call(rule.if, "not")) match = cur !== rule.if.not;
    else if (Object.prototype.hasOwnProperty.call(rule.if, "eq")) match = cur === rule.if.eq;
    if (match) for (const [s, v] of Object.entries(rule.then.set)) parts[s] = v;
  }

  const palette = manifest.palettes.includes(cfg.palette) ? cfg.palette : manifest.palettes[0]!;
  return { archetype, palette, parts };
}

// z-order sub-groupings of the fixed tree (spec 5.2)
const BG_SLOTS = ["bg_wall", "bg_decor_l", "bg_decor_r"];
const DESK_SLOTS = ["desk", "prop_desk_a", "prop_desk_b"];
const HEAD_SLOTS = ["head", "hair", "headwear", "glasses"];

function useTag(partId: string | null): string {
  return partId ? `<use href="#${partId}"/>` : "";
}

// Build inline symbol map for flat mode (resvg cannot resolve <use>/vars)
export type SymbolMap = Record<string, string>; // partId -> inner SVG markup of its <symbol>

function inlineOrUse(
  partId: string | null,
  mode: "browser" | "flat",
  symbols: SymbolMap | undefined,
  paletteMap: Record<string, string>,
): string {
  if (!partId) return "";
  if (mode === "browser") return `<use href="#${partId}"/>`;
  const inner = symbols?.[partId];
  if (inner == null) return "";
  // Replace every var(--c-X) occurrence with hex; wrap in a group.
  const flat = inner.replace(/var\((--c-[a-z0-9]+)\)/g, (_, tok: string) => paletteMap[tok] ?? "#000000");
  return `<g>${flat}</g>`;
}

function styleBlock(paletteMap: Record<string, string>): string {
  const decls = Object.entries(paletteMap).map(([k, v]) => `${k}:${v}`).join(";");
  return `<style>:root{${decls}}</style>`;
}

// ---- 7. Compose scene SVG (isomorphic). Emits the fixed tree of 5.2. ----
export function composeSceneSVG(
  _manifest: Manifest,
  cfg: ResolvedConfig,
  pose: Pose,
  opts: {
    mode: "browser" | "flat";
    paletteMap: Record<string, string>;
    symbols?: SymbolMap;
    hideSlots?: string[];   // slots omitted entirely (e.g. background for alpha export)
    viewBox?: string;       // crop region override, default full scene
  },
): string {
  const { mode, paletteMap, symbols, viewBox } = opts;
  const hidden = new Set(opts.hideSlots ?? []);
  const emit = (slot: string) => {
    if (hidden.has(slot)) return "";
    return mode === "browser" ? useTag(cfg.parts[slot] ?? null)
                              : inlineOrUse(cfg.parts[slot] ?? null, mode, symbols, paletteMap);
  };
  const tf = (t: RigTarget) => transformFor(t, pose);

  const layout = cfg.archetype.layout;
  const bg = BG_SLOTS.map(emit).join("");
  const deskzone = DESK_SLOTS.map(emit).join("");
  const under = (layout?.underSlots ?? []).map(emit).join("");
  const head = HEAD_SLOTS.map(emit).join("");

  const armL =
    `<g id="rt_arm_L" transform="${tf("rt_arm_L")}">${emit("arm_upper_L")}` +
      `<g id="rt_forearm_L" transform="${tf("rt_forearm_L")}">${emit("forearm_L")}` +
        `<g id="rt_hand_L" transform="${tf("rt_hand_L")}">${emit("hand_L")}</g>` +
      `</g>` +
    `</g>`;

  const armR =
    `<g id="rt_arm_R" transform="${tf("rt_arm_R")}">${emit("arm_upper_R")}` +
      `<g id="rt_forearm_R" transform="${tf("rt_forearm_R")}">${emit("forearm_R")}` +
        `<g id="rt_hand_R" transform="${tf("rt_hand_R")}">${emit("hand_R")}${emit("prop_hand")}</g>` +
      `</g>` +
    `</g>`;

  const headGroup = `<g id="rt_head" transform="${tf("rt_head")}">${head}</g>`;
  let torso =
    `<g id="rt_torso" transform="${tf("rt_torso")}">${emit("torso")}${headGroup}${armL}${armR}</g>`;
  if (layout?.wrap) {
    const { tx, ty, s } = layout.wrap;
    torso = `<g id="rt_wrap" transform="translate(${tx} ${ty}) scale(${s})">${torso}</g>`;
  }

  const stylePart = mode === "browser" ? styleBlock(paletteMap) : "";

  return (
    `<svg viewBox="${viewBox ?? "0 0 1600 900"}" xmlns="http://www.w3.org/2000/svg">` +
    stylePart +
    `<g id="rt_bg">${bg}</g>` +
    `<g id="rt_deskzone">${deskzone}</g>` +
    (under ? `<g id="rt_under">${under}</g>` : "") +
    torso +
    `</svg>`
  );
}
