import { parseLLM, SYSTEM_PROMPT, type LLMResult } from "./schema";

export interface ChatTurn { role: "user" | "assistant"; content: string }
export interface LLMProvider {
  complete(history: ChatTurn[], userText: string): Promise<LLMResult>;
}

// OpenAI-compatible chat-completions client (spec 12.1).
export class OpenAICompatLLM implements LLMProvider {
  constructor(
    private baseUrl = process.env.LLM_BASE_URL!,
    private apiKey = process.env.LLM_API_KEY!,
    private model = process.env.LLM_MODEL!,
  ) {}

  async complete(history: ChatTurn[], userText: string): Promise<LLMResult> {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-12),
      { role: "user", content: userText },
    ];
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages,
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    return parseLLM(raw, userText);
  }
}

// Deterministic mock for M4: canonical JSON reply.
export class MockLLM implements LLMProvider {
  async complete(_history: ChatTurn[], userText: string): Promise<LLMResult> {
    const lang = /[\u0400-\u04FF]/.test(userText) ? "ru" : "en";
    const reply = lang === "ru"
      ? "Конечно, помогу. Вот короткий ответ на твой вопрос. Скажи, если нужно подробнее."
      : "Sure, I can help. Here is a short answer to your question. Tell me if you want more detail.";
    return parseLLM(JSON.stringify({
      reply, lang,
      directives: [{ gesture: "nod", after_word_index: 1 }, { gesture: "open_palm_L", after_word_index: 6 }],
    }), userText);
  }
}
