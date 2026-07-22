"use client";
import type { ChatMessage } from "@/store/useAppStore";

export function ChatList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-2">
      {messages.map((m) => (
        <div key={m.id} className={m.role === "user" ? "self-end" : "self-start"}>
          <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${m.role === "user" ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200"}`}>
            {m.text}  {/* textContent only — never innerHTML for message data */}
          </div>
        </div>
      ))}
    </div>
  );
}
