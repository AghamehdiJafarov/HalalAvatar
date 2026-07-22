import { MAX_TTS_CHARS, type TTSResult, type WordMark } from "@faceless/avatar-core";
import type { TTSProvider, TTSOpts } from "./provider";

// Deterministic mock: silent buffer, evenly spaced marks. For M4 vertical slice.
export class MockTTS implements TTSProvider {
  async synth(text: string, _opts: TTSOpts): Promise<TTSResult> {
    const clipped = text.slice(0, MAX_TTS_CHARS);
    const words = clipped.split(/\s+/).filter(Boolean);
    const perWord = 320;
    const durationMs = Math.max(1000, words.length * perWord);
    const marks: WordMark[] = words.map((w, i) => ({ word: w, tMs: i * perWord }));
    // 1-byte placeholder buffer (real audio provided by fixture in tests)
    return { audioBuf: new Uint8Array([0]), mime: "audio/mpeg", durationMs, marks };
  }
}
