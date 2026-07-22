import { OpenAICompatLLM, MockLLM, type LLMProvider } from "./llm/client";
import { AzureTTS } from "./tts/azure";
import { MockTTS } from "./tts/mock";
import type { TTSProvider } from "./tts/provider";

// Use mocks when real credentials are absent (dev / M4). Real providers otherwise.
export function getLLM(): LLMProvider {
  return process.env.LLM_API_KEY ? new OpenAICompatLLM() : new MockLLM();
}
export function getTTS(): TTSProvider {
  return process.env.AZURE_SPEECH_KEY ? new AzureTTS() : new MockTTS();
}
