"use client";
import { useEffect } from "react";
import { AvatarStage } from "@/components/AvatarStage";
import { StudioPanel } from "@/components/StudioPanel";
import { useAppStore } from "@/store/useAppStore";
import type { AvatarConfig } from "@faceless/avatar-core";

export default function StudioPage() {
  const { config, setConfig } = useAppStore();
  useEffect(() => {
    fetch("/api/avatar").then((r) => r.ok ? r.json() : null).then((d) => d?.config && setConfig(d.config)).catch(() => {});
  }, [setConfig]);

  const save = async (c: AvatarConfig) => {
    const res = await fetch("/api/avatar", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: c }) });
    if (res.ok) { const d = await res.json(); setConfig(d.config); }
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-2">
      <div className="md:sticky md:top-4 md:self-start"><AvatarStage config={config} /></div>
      <StudioPanel config={config} onChange={setConfig} onSave={save} />
    </main>
  );
}
