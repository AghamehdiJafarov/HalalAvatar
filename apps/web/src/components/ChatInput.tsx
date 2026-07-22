"use client";
import { useState } from "react";

interface Props { onSend: (text: string) => void; disabled?: boolean }

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);          // audio.play() is triggered downstream from this user gesture
    setText("");
  };
  return (
    <div className="flex gap-2">
      <input
        className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
        value={text}
        placeholder="Напишите сообщение…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        disabled={disabled}
      />
      <button
        className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-40"
        onClick={submit}
        disabled={disabled}
      >Отправить</button>
    </div>
  );
}
