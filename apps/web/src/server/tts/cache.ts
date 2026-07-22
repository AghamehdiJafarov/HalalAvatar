import { createHash } from "node:crypto";
import type { TTSProvider, TTSOpts } from "./provider";
import type { TTSResult, WordMark } from "@faceless/avatar-core";
import type { Storage } from "./storage-port";

export interface CachedTTS {
  audioKey: string;
  audioUrl: string;
  durationMs: number;
  marks: WordMark[];
}

function ttsKey(voice: string, lang: string, text: string): string {
  const h = createHash("sha256").update(`${voice}|${lang}|${text}`).digest("hex");
  return `tts/${h}.mp3`;
}

// Cache-then-synth. A cache hit MUST avoid any provider call (spec 11.3).
export async function synthCached(
  provider: TTSProvider,
  storage: Storage,
  text: string,
  opts: TTSOpts,
): Promise<CachedTTS> {
  const audioKey = ttsKey(opts.voice, opts.lang, text);
  const metaKey = audioKey.replace(/\.mp3$/, ".json");

  if (await storage.head(audioKey)) {
    const metaRaw = await storage.getText(metaKey);
    if (metaRaw) {
      const meta = JSON.parse(metaRaw) as { durationMs: number; marks: WordMark[] };
      return { audioKey, audioUrl: storage.publicUrl(audioKey), durationMs: meta.durationMs, marks: meta.marks };
    }
  }

  const res: TTSResult = await provider.synth(text, opts);
  await storage.put(audioKey, res.audioBuf, "audio/mpeg");
  await storage.put(
    metaKey,
    new TextEncoder().encode(JSON.stringify({ durationMs: res.durationMs, marks: res.marks })),
    "application/json",
  );
  return { audioKey, audioUrl: storage.publicUrl(audioKey), durationMs: res.durationMs, marks: res.marks };
}
