import { describe, it, expect, vi } from "vitest";
import { parseLLM } from "./llm/schema";
import { MockLLM } from "./llm/client";
import { synthCached } from "./tts/cache";
import { MockTTS } from "./tts/mock";
import type { Storage } from "./tts/storage-port";

describe("parseLLM", () => {
  it("accepts canonical JSON", () => {
    const r = parseLLM(JSON.stringify({ reply: "Hello there friend", lang: "en", directives: [{ gesture: "nod", after_word_index: 1 }] }), "hi");
    expect(r.reply).toBe("Hello there friend");
    expect(r.lang).toBe("en");
    expect(r.directives).toHaveLength(1);
  });

  it("strips code fences", () => {
    const r = parseLLM("```json\n{\"reply\":\"Hi\",\"lang\":\"en\",\"directives\":[]}\n```", "hi");
    expect(r.reply).toBe("Hi");
  });

  it("degrades invalid JSON to plain text with heuristic lang", () => {
    const r = parseLLM("это не json совсем", "привет");
    expect(r.lang).toBe("ru");
    expect(r.directives).toEqual([]);
    expect(r.reply.length).toBeGreaterThan(0);
  });

  it("drops out-of-range directive index", () => {
    const r = parseLLM(JSON.stringify({ reply: "one two", lang: "en", directives: [{ gesture: "nod", after_word_index: 50 }] }), "x");
    expect(r.directives).toEqual([]);
  });

  it("strips angle brackets from reply", () => {
    const r = parseLLM(JSON.stringify({ reply: "a <b> c", lang: "en", directives: [] }), "x");
    expect(r.reply).toBe("a b c");
  });
});

describe("MockLLM", () => {
  it("returns ru for cyrillic input", async () => {
    const r = await new MockLLM().complete([], "привет");
    expect(r.lang).toBe("ru");
  });
});

// In-memory storage for cache test
function memStorage(): Storage & { puts: number } {
  const mem = new Map<string, Uint8Array>();
  const s: Storage & { puts: number } = {
    puts: 0,
    async head(k) { return mem.has(k); },
    async put(k, b) { mem.set(k, b); s.puts++; },
    async getText(k) { const v = mem.get(k); return v ? new TextDecoder().decode(v) : null; },
    async getBytes() {},
    publicUrl(k) { return `mem://${k}`; },
  };
  return s;
}

describe("synthCached", () => {
  it("cache miss synthesizes, cache hit avoids provider call", async () => {
    const storage = memStorage();
    const provider = new MockTTS();
    const spy = vi.spyOn(provider, "synth");

    const opts = { lang: "en", voice: "en-US-GuyNeural" };
    const first = await synthCached(provider, storage, "hello world test", opts);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.durationMs).toBeGreaterThan(0);
    expect(first.marks.length).toBe(3);

    const second = await synthCached(provider, storage, "hello world test", opts);
    expect(spy).toHaveBeenCalledTimes(1); // NOT called again — cache hit
    expect(second.audioKey).toBe(first.audioKey);
    expect(second.durationMs).toBe(first.durationMs);
  });

  it("different text produces different key", async () => {
    const storage = memStorage();
    const provider = new MockTTS();
    const a = await synthCached(provider, storage, "aaa", { lang: "en", voice: "v" });
    const b = await synthCached(provider, storage, "bbb", { lang: "en", voice: "v" });
    expect(a.audioKey).not.toBe(b.audioKey);
  });
});
