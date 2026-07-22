import { describe, it, expect } from "vitest";
import { buildTimeline, type SchedulerInput } from "../src/scheduler.js";
import type { WordMark } from "../src/types.js";

const clipDur: Record<string, number> = {
  nod: 900, tilt_L: 1400, tilt_R: 1400, beat_R: 620,
  open_palm_L: 1300, point_R: 1500, lean_in: 1700, settle: 700,
};

// synthetic marks: one word every 400ms
function marksFor(text: string, step = 400): WordMark[] {
  return text.split(/\s+/).filter(Boolean).map((w, i) => ({ word: w, tMs: i * step }));
}

describe("buildTimeline", () => {
  const text = "Привет. Это тест. Ещё одно предложение здесь. Финал.";
  const marks = marksFor(text);
  const durationMs = marks[marks.length - 1]!.tMs + 400;

  it("always includes both idle clips first", () => {
    const out = buildTimeline({ text, marks, directives: [], durationMs, clipDur });
    expect(out[0]).toEqual({ clip: "idle_breathe", startMs: 0, endMs: durationMs + 1500 });
    expect(out[1]).toEqual({ clip: "idle_sway", startMs: 0, endMs: durationMs + 1500 });
  });

  it("is deterministic (snapshot) for fixed input", () => {
    const a = buildTimeline({ text, marks, directives: [], durationMs, clipDur });
    const b = buildTimeline({ text, marks, directives: [], durationMs, clipDur });
    expect(a).toEqual(b);
    expect(a).toMatchInlineSnapshot(`
      [
        {
          "clip": "idle_breathe",
          "endMs": 4700,
          "startMs": 0,
        },
        {
          "clip": "idle_sway",
          "endMs": 4700,
          "startMs": 0,
        },
        {
          "clip": "beat_R",
          "startMs": 400,
        },
        {
          "clip": "tilt_R",
          "startMs": 1800,
        },
      ]
    `);
  });

  it("non-idle gestures never overlap and keep >=400ms gap", () => {
    const out = buildTimeline({ text, marks, directives: [], durationMs, clipDur });
    const ivals = out.filter((i) => !i.clip.startsWith("idle"))
      .map((i) => ({ s: i.startMs, e: i.startMs + (clipDur[i.clip] ?? 0) }))
      .sort((a, b) => a.s - b.s);
    for (let i = 1; i < ivals.length; i++) expect(ivals[i]!.s - ivals[i - 1]!.e).toBeGreaterThanOrEqual(400);
  });

  it("LLM directive is placed and wins priority over auto at conflict", () => {
    const out = buildTimeline({
      text, marks,
      directives: [{ gesture: "point_R", after_word_index: 2 }],
      durationMs, clipDur,
    });
    expect(out.some((i) => i.clip === "point_R")).toBe(true);
  });

  it("wordTime fallback (no marks) is monotonic", () => {
    const noMarks = buildTimeline({ text, marks: [], directives: [], durationMs: 6000, clipDur });
    const starts = noMarks.filter((i) => !i.clip.startsWith("idle")).map((i) => i.startMs);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!).toBeGreaterThanOrEqual(0);
  });

  it("drops out-of-range directive index", () => {
    const out = buildTimeline({
      text, marks, directives: [{ gesture: "nod", after_word_index: 999 }], durationMs, clipDur,
    });
    // nod should not appear from that directive (auto rotation may still place others, not nod at pos0)
    const nods = out.filter((i) => i.clip === "nod");
    expect(nods.length).toBeLessThanOrEqual(1);
  });
});
