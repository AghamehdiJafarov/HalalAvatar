"use client";
import { create } from "zustand";
import type { AvatarConfig } from "@faceless/avatar-core";

const DEFAULT_CONFIG: AvatarConfig = { archetype: "seated_desk", palette: "ref_blue", parts: {} };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  lang?: string;
  audioUrl?: string | null;
  durationMs?: number | null;
  timeline?: { instances: unknown[]; marks: { word: string; tMs: number }[] } | null;
}

interface AppState {
  config: AvatarConfig;
  animPreset: string;
  conversationId: string | null;
  messages: ChatMessage[];
  playback: "idle" | "speaking";
  setConfig: (c: AvatarConfig) => void;
  setAnimPreset: (id: string) => void;
  setConversationId: (id: string | null) => void;
  addMessage: (m: ChatMessage) => void;
  setMessages: (m: ChatMessage[]) => void;
  setPlayback: (p: "idle" | "speaking") => void;
}

export const useAppStore = create<AppState>((set) => ({
  config: DEFAULT_CONFIG,
  animPreset: "idle_calm",
  conversationId: null,
  messages: [],
  playback: "idle",
  setConfig: (config) => set({ config }),
  setAnimPreset: (animPreset) => set({ animPreset }),
  setConversationId: (conversationId) => set({ conversationId }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setMessages: (messages) => set({ messages }),
  setPlayback: (playback) => set({ playback }),
}));
