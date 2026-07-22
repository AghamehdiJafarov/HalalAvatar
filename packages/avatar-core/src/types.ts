import type { RigTarget } from "./constants";

// ---- Animation runtime types (spec 9.1) ----
export type Prop = "r" | "tx" | "ty" | "sx" | "sy";
export type Easing = "lin" | "in" | "out" | "io";

export interface Key { t: number; v: number; e?: Easing }            // t in ms from clip start
export interface Track { target: RigTarget; prop: Prop; keys: Key[] } // keys sorted by t, keys[0].t === 0
export interface Clip {
  id: string;
  durationMs: number;
  loop: boolean;
  fadeInMs?: number;
  fadeOutMs?: number;
  tracks: Track[];
}
export interface Instance { clip: string; startMs: number; endMs?: number } // endMs only for loop clips

// ---- Pose / config (spec 7) ----
export type Pose = Partial<Record<RigTarget, { r?: number; tx?: number; ty?: number; sx?: number; sy?: number }>>;
export type AvatarConfig = { archetype: string; palette: string; parts: Record<string, string | null> };

// ---- Manifest (spec 6) ----
export interface ArchetypeRule {
  if: { slot: string; not?: null; eq?: string | null };
  then: { set: Record<string, string | null> };
}
export interface Archetype {
  id: string;
  zorder: string[];
  defaults: Record<string, string | null>;
  rules: ArchetypeRule[];
}
export interface PartEntry {
  id: string;
  slot: string;
  file: string;
  tags?: string[];
  bytes?: number;
  excludes?: string[];
}
export interface Manifest {
  version: string;
  archetypes: Archetype[];
  parts: PartEntry[];
  palettes: string[];
  clips: string[];
}
export interface ResolvedConfig {
  archetype: Archetype;
  palette: string;
  parts: Record<string, string | null>; // slot -> partId or null, fully resolved
}

// ---- Gestures / scheduler (spec 10, 12) ----
export type GestureId = "nod" | "tilt_L" | "tilt_R" | "beat_R" | "open_palm_L" | "point_R" | "lean_in";
export interface Directive { gesture: GestureId; after_word_index: number }
export interface WordMark { word: string; tMs: number }

// ---- TTS (spec 11) ----
export interface TTSResult {
  audioBuf: Uint8Array; // Node Buffer is assignable to this; keeps core isomorphic
  mime: "audio/mpeg";
  durationMs: number;
  marks: WordMark[];
}
