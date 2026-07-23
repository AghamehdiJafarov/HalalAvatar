"use client";
import { useEffect, useMemo, useState } from "react";
import { AvatarStage } from "@/components/AvatarStage";
import { StudioPanel } from "@/components/StudioPanel";
import { DownloadPanel } from "@/components/DownloadPanel";
import { useAppStore } from "@/store/useAppStore";
import { loadClientAssets, type ClientAssets } from "@/lib/avatar-client";
import type { AvatarConfig } from "@faceless/avatar-core";

export default function StudioPage() {
  const { config, setConfig, animPreset, setAnimPreset } = useAppStore();
  const [assets, setAssets] = useState<ClientAssets | null>(null);

  useEffect(() => { loadClientAssets().then(setAssets).catch(() => {}); }, []);
  useEffect(() => {
    fetch("/api/avatar").then((r) => (r.ok ? r.json() : null)).then((d) => d?.config && setConfig(d.config)).catch(() => {});
  }, [setConfig]);

  // Instances of the selected animation preset; falls back to plain idle.
  const preset = useMemo(() => {
    const ok = assets?.animations.presets.filter(
      (p) => !p.archetypes || p.archetypes.includes(config.archetype),
    );
    return ok?.find((p) => p.id === animPreset) ?? ok?.[0];
  }, [assets, animPreset, config.archetype]);

  const save = async (c: AvatarConfig) => {
    const res = await fetch("/api/avatar", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: c }),
    });
    if (res.ok) { const d = await res.json(); setConfig(d.config); }
  };

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-2">
      <div className="md:sticky md:top-4 md:self-start">
        <AvatarStage
          config={config}
          instances={preset?.instances}
          loopMs={assets?.animations.loopDurationMs ?? 0}
        />
      </div>
      <div className="flex flex-col gap-6">
        <StudioPanel
          config={config}
          onChange={setConfig}
          onSave={save}
          animPreset={animPreset}
          onAnimChange={setAnimPreset}
        />
        {preset && assets && (
          <DownloadPanel
            config={config}
            instances={preset.instances}
            durationMs={assets.animations.loopDurationMs}
            presetId={preset.id}
          />
        )}
      </div>
    </main>
  );
}
