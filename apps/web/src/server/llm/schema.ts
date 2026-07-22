import { z } from "zod";

export const Gesture = z.enum(["nod", "tilt_L", "tilt_R", "beat_R", "open_palm_L", "point_R", "lean_in"]);

export const LLMOut = z.object({
  reply: z.string().min(1).max(700).transform((s) => s.replace(/[<>]/g, "").trim()),
  lang: z.enum(["ru", "az", "en", "ar"]).catch("en"),
  directives: z.array(z.object({
    gesture: Gesture,
    after_word_index: z.number().int().min(0).max(200),
  })).max(3).catch([]),
});

export type LLMResult = z.infer<typeof LLMOut>;

export const SYSTEM_PROMPT = `You are the voice of a friendly on-screen assistant. You are represented by a minimalist
faceless flat-style avatar. Personality: calm, warm, competent, concise.

Respond with ONLY a minified JSON object, no markdown, no code fences, matching exactly:
{"reply":"...","lang":"ru|az|en|ar","directives":[{"gesture":"nod|tilt_L|tilt_R|beat_R|open_palm_L|point_R|lean_in","after_word_index":0}]}

Rules:
- "reply": what you say aloud. Max 600 characters. Plain speakable text: no markdown, no emoji,
  no URLs, no lists, no quotation marks. Match the user's language; set "lang" accordingly.
- "directives": 0 to 3 items. "after_word_index" is the 0-based index of the word in "reply"
  after which the gesture starts. Use gestures sparingly and meaningfully.
- Never describe your appearance, never claim to have a face, eyes or expressions.
- If the user asks for images, video of people, or changing your look beyond offered options,
  explain briefly that customization happens in the studio settings.`;

// Heuristic language fallback: cyrillic -> ru else en.
export function guessLang(text: string): "ru" | "en" {
  return /[\u0400-\u04FF]/.test(text) ? "ru" : "en";
}

// Parse raw model text into a validated LLMResult, degrading to plain text on any failure.
export function parseLLM(raw: string, userText: string): LLMResult {
  const stripped = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  try {
    const obj = JSON.parse(stripped);
    const parsed = LLMOut.parse(obj);
    // drop directives whose index exceeds word count
    const words = parsed.reply.split(/\s+/).filter(Boolean).length;
    parsed.directives = parsed.directives.filter((d) => d.after_word_index < words);
    return parsed;
  } catch {
    return { reply: stripped.slice(0, 600) || userText.slice(0, 600), lang: guessLang(userText), directives: [] };
  }
}
