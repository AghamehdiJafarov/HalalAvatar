"use client";
import { useState } from "react";

export function VideoButton({ messageId }: { messageId: string }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);

  const run = async () => {
    setState("working");
    const res = await fetch("/api/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) });
    if (!res.ok) { setState("error"); return; }
    const { jobId } = await res.json();
    const poll = async () => {
      const r = await fetch(`/api/video/${jobId}`);
      const j = await r.json();
      if (j.status === "done") { setUrl(j.url); setState("done"); }
      else if (j.status === "error") setState("error");
      else setTimeout(poll, 2000);
    };
    poll();
  };

  if (state === "done" && url) return <a className="text-sm text-blue-600 underline" href={url} target="_blank" rel="noreferrer">Скачать видео</a>;
  return (
    <button className="text-sm text-neutral-500 underline disabled:opacity-40" onClick={run} disabled={state === "working"}>
      {state === "working" ? "Рендер…" : state === "error" ? "Ошибка, повторить" : "Сделать видео"}
    </button>
  );
}
