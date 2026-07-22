import type { Directive, GestureId, Instance, WordMark } from "./types";

// Fixed rotation order (spec 10). Length 6.
const ROTATION: GestureId[] = ["beat_R", "tilt_R", "open_palm_L", "nod", "tilt_L", "lean_in"];

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export interface SchedulerInput {
  text: string;
  marks: WordMark[];
  directives: Directive[];
  durationMs: number;
  clipDur: Record<string, number>; // gesture id -> durationMs
}

interface Busy { start: number; end: number }

export function buildTimeline(input: SchedulerInput): Instance[] {
  const { text, marks, directives, durationMs, clipDur } = input;
  const words = text.split(/\s+/).filter(Boolean);

  // cumulative char length (+1 per space) for fallback word timing
  const cum: number[] = [];
  let run = 0;
  for (let i = 0; i < words.length; i++) { run += words[i]!.length + 1; cum[i] = run; }
  const cumLast = cum.length ? cum[cum.length - 1]! : 1;

  const wordTime = (i: number): number => {
    if (marks.length) return marks[Math.min(i, marks.length - 1)]!.tMs;
    if (!words.length) return 0;
    const idx = clamp(i, 0, words.length - 1);
    return durationMs * (cum[idx]! / cumLast);
  };

  const out: Instance[] = [
    { clip: "idle_breathe", startMs: 0, endMs: durationMs + 1500 },
    { clip: "idle_sway", startMs: 0, endMs: durationMs + 1500 },
  ];
  const busy: Busy[] = [];

  const dur = (g: string) => clipDur[g] ?? 800;

  const place = (g: string, tRaw: number): boolean => {
    const d = dur(g);
    const t = clamp(tRaw, 0, Math.max(0, durationMs - d));
    const start = t, end = t + d;
    for (const b of busy) {
      const overlap = start < b.end && end > b.start;
      const gap = Math.min(Math.abs(start - b.end), Math.abs(b.start - end));
      if (overlap || gap < 400) return false;
    }
    out.push({ clip: g, startMs: Math.round(t) });
    busy.push({ start, end });
    return true;
  };

  // 1) LLM directives — priority, ascending after_word_index
  const sorted = [...directives].sort((a, b) => a.after_word_index - b.after_word_index);
  for (const d of sorted) {
    if (d.after_word_index >= words.length) continue; // out-of-range dropped
    place(d.gesture, wordTime(d.after_word_index) + 80);
  }

  // 2) auto gestures at sentence boundaries
  const sentences = splitSentences(words, text);
  let ri = 0;
  let lastAuto = -Infinity;
  for (let s = 1; s < sentences.length; s++) {
    const t = wordTime(sentences[s]!.firstWordIdx);
    if (t - lastAuto >= 1400) {
      if (place(ROTATION[ri % 6]!, t)) { ri++; lastAuto = t; }
    }
  }

  // 3) closing settle
  place("settle", durationMs - 500);

  return out;
}

interface Sentence { firstWordIdx: number }

// Split by . ! ? … and record first word index of each sentence.
function splitSentences(words: string[], text: string): Sentence[] {
  const sentences: Sentence[] = [];
  let firstWordIdx = 0;
  let started = false;
  for (let i = 0; i < words.length; i++) {
    if (!started) { firstWordIdx = i; started = true; }
    if (/[.!?…]$/.test(words[i]!)) { sentences.push({ firstWordIdx }); started = false; }
  }
  if (started) sentences.push({ firstWordIdx });
  if (!sentences.length && words.length) sentences.push({ firstWordIdx: 0 });
  void text;
  return sentences;
}
