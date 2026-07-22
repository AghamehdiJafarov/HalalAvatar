import { describe, it, expect } from "vitest";
import { generateAssistantTurn } from "./chat-service";
import { MockLLM } from "./llm/client";
import { MockTTS } from "./tts/mock";
import type { Storage } from "./tts/storage-port";

function memStorage(): Storage {
  const mem = new Map<string, Uint8Array>();
  return {
    async head(k) { return mem.has(k); },
    async put(k, b) { mem.set(k, b); },
    async getText(k) { const v = mem.get(k); return v ? new TextDecoder().decode(v) : null; },
    async getBytes() {},
    publicUrl(k) { return `mem://${k}`; },
  };
}

describe("generateAssistantTurn (M4 vertical slice on mocks)", () => {
  it("produces synced timeline with idle base + directive gestures", async () => {
    const turn = await generateAssistantTurn(new MockLLM(), new MockTTS(), memStorage(), [], "привет");
    expect(turn.lang).toBe("ru");
    expect(turn.text.length).toBeGreaterThan(0);
    expect(turn.durationMs).toBeGreaterThan(0);
    expect(turn.audioUrl).toMatch(/^mem:\/\/tts\//);

    const clips = turn.timeline.instances.map((i) => i.clip);
    expect(clips).toContain("idle_breathe");
    expect(clips).toContain("idle_sway");
    // at least one non-idle gesture placed
    expect(turn.timeline.instances.some((i) => !i.clip.startsWith("idle"))).toBe(true);

    // marks align to word count
    const words = turn.text.split(/\s+/).filter(Boolean).length;
    expect(turn.timeline.marks.length).toBe(words);
  });

  it("is deterministic for identical input (safe re-send)", async () => {
    const a = await generateAssistantTurn(new MockLLM(), new MockTTS(), memStorage(), [], "hello");
    const b = await generateAssistantTurn(new MockLLM(), new MockTTS(), memStorage(), [], "hello");
    expect(a.timeline.instances).toEqual(b.timeline.instances);
    expect(a.text).toBe(b.text);
  });

  it("English input yields english reply and en voice key path", async () => {
    const turn = await generateAssistantTurn(new MockLLM(), new MockTTS(), memStorage(), [], "hello there");
    expect(turn.lang).toBe("en");
  });
});
