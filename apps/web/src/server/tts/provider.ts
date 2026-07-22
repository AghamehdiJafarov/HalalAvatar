import type { TTSResult, WordMark } from "@faceless/avatar-core";

export interface TTSOpts { lang: string; voice: string }
export interface TTSProvider {
  synth(text: string, opts: TTSOpts): Promise<TTSResult>;
}

// Pick a voice for a language from TTS_VOICES env: "ru:ru-RU-DmitryNeural,az:az-AZ-BabekNeural,..."
export function voiceForLang(lang: string): string {
  const raw = process.env.TTS_VOICES ?? "ru:ru-RU-DmitryNeural,az:az-AZ-BabekNeural,en:en-US-GuyNeural,ar:ar-SA-HamedNeural";
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [l, v] = pair.split(":");
    if (l && v) map[l.trim()] = v.trim();
  }
  return map[lang] ?? map.en ?? "en-US-GuyNeural";
}

export type { TTSResult, WordMark };
