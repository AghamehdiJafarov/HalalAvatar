"use client";
import { useRef, useState } from "react";
import { AvatarStage } from "@/components/AvatarStage";
import { SubtitleBar } from "@/components/SubtitleBar";
import { ChatList } from "@/components/ChatList";
import { ChatInput } from "@/components/ChatInput";
import { VideoButton } from "@/components/VideoButton";
import { useAppStore, type ChatMessage } from "@/store/useAppStore";
import type { Instance } from "@faceless/avatar-core";

export default function ChatPage() {
  const { config, messages, addMessage, conversationId, setConversationId } = useAppStore();
  const [instances, setInstances] = useState<Instance[] | undefined>();
  const [current, setCurrent] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const [needPlay, setNeedPlay] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const send = async (text: string) => {
    setBusy(true);
    addMessage({ id: `u_${Date.now()}`, role: "user", text }); // optimistic
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text }),
      });
      if (!res.ok) { setBusy(false); return; }
      const data = await res.json();
      setConversationId(data.conversationId);
      const msg = data.message as ChatMessage;
      addMessage({ ...msg, role: "assistant" });
      setCurrent(msg);

      const audio = new Audio(msg.audioUrl ?? undefined);
      audio.preload = "auto";
      audioRef.current = audio;
      setInstances((msg.timeline?.instances as Instance[]) ?? undefined);
      // Playback started from this user-gesture chain (spec 18.2)
      audio.play().then(() => setNeedPlay(false)).catch(() => setNeedPlay(true));
    } finally { setBusy(false); }
  };

  const manualPlay = () => { audioRef.current?.play().then(() => setNeedPlay(false)).catch(() => {}); };

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4">
      <AvatarStage config={config} instances={instances} audio={audioRef.current} />
      <div className="min-h-[2rem]">
        {current && <SubtitleBar text={current.text} marks={current.timeline?.marks} audio={audioRef.current} />}
      </div>
      {needPlay && <button onClick={manualPlay} className="self-center rounded bg-neutral-900 px-3 py-1 text-white">Воспроизвести</button>}
      <div className="flex-1 overflow-y-auto"><ChatList messages={messages} /></div>
      {current && <div className="self-start"><VideoButton messageId={current.id} /></div>}
      <ChatInput onSend={send} disabled={busy} />
    </main>
  );
}
