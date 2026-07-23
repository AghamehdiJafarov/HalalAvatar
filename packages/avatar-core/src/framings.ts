// Single source of truth for export crops. Both the video worker (Node/resvg)
// and the in-browser exporter (canvas) read these — duplicating them once led
// to silent drift between server and client output.

// Backdrop is never exported: the product is the character, not the room.
export const BACKDROP_SLOTS = [
  "bg_wall", "bg_decor_l", "bg_decor_r", "desk", "prop_desk_a", "prop_desk_b",
] as const;

export interface Framing {
  viewBox: string;
  hideSlots: string[];
  width: number;
  height: number;
  title: string;
}

// Character content spans x 606..994, y 128..664 in scene coordinates.
// Crops end at y=632 so the torso meets the frame edge instead of floating.
export const FRAMINGS = {
  bust:     { viewBox: "596 96 408 536",   hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1420, title: "Крупный план" },
  overlay:  { viewBox: "560 90 480 542",   hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1220, title: "Для наложения" },
  portrait: { viewBox: "575 -168 450 800", hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1920, title: "Вертикальное 9:16" },
  square:   { viewBox: "530 92 540 540",   hideSlots: [...BACKDROP_SLOTS], width: 1080, height: 1080, title: "Квадрат 1:1" },
} as const satisfies Record<string, Framing>;

export type FramingId = keyof typeof FRAMINGS;

export const CHROMA_GREEN = "#00B140";
