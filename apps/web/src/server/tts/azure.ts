import {
  SpeechConfig, SpeechSynthesizer, SpeechSynthesisOutputFormat,
  ResultReason, AudioConfig,
} from "microsoft-cognitiveservices-speech-sdk";
import { MAX_TTS_CHARS, type TTSResult, type WordMark } from "@faceless/avatar-core";
import type { TTSProvider, TTSOpts } from "./provider";

const TICKS_PER_MS = 10_000; // Azure offsets are in 100ns ticks

export class AzureTTS implements TTSProvider {
  private key: string;
  private region: string;
  constructor(key = process.env.AZURE_SPEECH_KEY!, region = process.env.AZURE_SPEECH_REGION!) {
    this.key = key; this.region = region;
  }

  async synth(text: string, opts: TTSOpts): Promise<TTSResult> {
    const clipped = text.slice(0, MAX_TTS_CHARS);
    const cfg = SpeechConfig.fromSubscription(this.key, this.region);
    cfg.speechSynthesisOutputFormat = SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    cfg.speechSynthesisVoiceName = opts.voice;

    const marks: WordMark[] = [];
    // No default speaker output; capture bytes from result.
    const synth = new SpeechSynthesizer(cfg, AudioConfig.fromDefaultSpeakerOutput());

    synth.wordBoundary = (_s, e) => {
      marks.push({ word: e.text, tMs: Math.round(e.audioOffset / TICKS_PER_MS) });
    };

    const result = await new Promise<{ buf: Buffer; durationMs: number }>((resolve, reject) => {
      synth.speakTextAsync(
        clipped,
        (r) => {
          if (r.reason === ResultReason.SynthesizingAudioCompleted) {
            const buf = Buffer.from(r.audioData);
            let durationMs = r.audioDuration ? Math.round(r.audioDuration / TICKS_PER_MS) : 0;
            if (!durationMs) durationMs = Math.round((buf.length * 8) / 48); // 48 kbps CBR fallback
            resolve({ buf, durationMs });
          } else {
            reject(new Error(`TTS failed: ${r.errorDetails ?? r.reason}`));
          }
          synth.close();
        },
        (err) => { synth.close(); reject(new Error(String(err))); },
      );
    });

    marks.sort((a, b) => a.tMs - b.tMs);
    return { audioBuf: result.buf, mime: "audio/mpeg", durationMs: result.durationMs, marks };
  }
}
