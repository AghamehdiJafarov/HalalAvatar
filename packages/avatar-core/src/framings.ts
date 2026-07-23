// Single source of truth for export crops. Both the video worker (Node/resvg)
// and the in-browser exporter (canvas) read these — duplicating them once led
// to silent drift between server and client output.

// Backdrop is never exported: the product is the character, not the room.
export const BACKDROP_SLOTS = [
  "bg_wall", "bg_decor_l", "bg_decor_r", "desk", "prop_desk_a", "prop_desk_b",
] as const;

export type ArchetypeId = "seated_desk" | "standing";

export interface Framing {
  viewBox: string;
  hideSlots: string[];
  width: number;
  height: number;
  title: string;
  archetype: ArchetypeId;
}

// seated_desk character spans x 606..994, y 128..664 in scene coords; crops
// end at y=632 so the torso meets the frame edge instead of floating.
// standing character (wrap tx=224 ty=28 s=0.72 + legs) spans x 660..944,
// y ≈114 (chef hat) .. 860 (feet); crops give the feet a small bottom margin.
export const FRAMINGS = {
  bust:     { viewBox: "596 96 408 536",   hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1420, title: "Крупный план",      archetype: "seated_desk" },
  overlay:  { viewBox: "560 90 480 542",   hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1220, title: "Для наложения",     archetype: "seated_desk" },
  portrait: { viewBox: "575 -168 450 800", hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1920, title: "Вертикальное 9:16", archetype: "seated_desk" },
  square:   { viewBox: "530 92 540 540",   hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1080, title: "Квадрат 1:1",       archetype: "seated_desk" },

  fullbody:       { viewBox: "580 88 440 784",  hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1924, title: "Полный рост 9:16",   archetype: "standing" },
  fullbody_tight: { viewBox: "648 96 304 776",  hideSlots: [...BACKDROP_SLOTS], width: 760,  height: 1940, title: "Полный рост (узко)", archetype: "standing" },
  stand_square:   { viewBox: "560 104 480 480", hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1080, title: "Портрет 1:1",        archetype: "standing" },
} as const satisfies Record<string, Framing>;

export type FramingId = keyof typeof FRAMINGS;

export const CHROMA_GREEN = "#00B140";
