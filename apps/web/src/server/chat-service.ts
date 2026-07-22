import { buildTimeline, MAX_TTS_CHARS, type AvatarConfig, type Instance, type WordMark } from "@faceless/avatar-core";
import { serverAssets } from "./assets";
import { voiceForLang } from "./tts/provider";
import { synthCached } from "./tts/cache";
import type { TTSProvider } from "./tts/provider";
import type { LLMProvider, ChatTurn } from "./llm/client";
import type { Storage } from "./tts/storage-port";

export const DEFAULT_CONFIG: AvatarConfig = { archetype: "seated_desk", palette: "ref_blue", parts: {} };

export interface AssistantTurn {
  text: string;
  lang: string;
  audioKey: string;
  audioUrl: string;
  durationMs: number;
  timeline: { instances: Instance[]; marks: WordMark[] };
}

// Steps 3-6 of spec 13: LLM -> TTS -> scheduler. Pure of DB; caller persists.
export async function generateAssistantTurn(
  llm: LLMProvider,
  tts: TTSProvider,
  storage: Storage,
  history: ChatTurn[],
  userText: string,
): Promise<AssistantTurn> {
  const { clipDur } = serverAssets();

  // 3. LLM
  const out = await llm.complete(history, userText);

  // Clip reply identically before TTS and scheduler (spec pitfall 17)
  const reply = out.reply.slice(0, MAX_TTS_CHARS);
  const voice = voiceForLang(out.lang);

  // 4. TTS (cache-then-synth)
  const ttsRes = await synthCached(tts, storage, reply, { lang: out.lang, voice });

  // 5. Scheduler
  const instances = buildTimeline({
    text: reply,
    marks: ttsRes.marks,
    directives: out.directives,
    durationMs: ttsRes.durationMs,
    clipDur,
  });

  return {
    text: reply,
    lang: out.lang,
    audioKey: ttsRes.audioKey,
    audioUrl: ttsRes.audioUrl,
    durationMs: ttsRes.durationMs,
    timeline: { instances, marks: ttsRes.marks },
  };
}
