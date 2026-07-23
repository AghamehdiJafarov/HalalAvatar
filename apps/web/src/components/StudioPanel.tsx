"use client";
import { useEffect, useMemo, useState } from "react";
import { resolveConfig, type AvatarConfig, type Manifest, type PartEntry } from "@faceless/avatar-core";
import { loadClientAssets, type ClientAssets } from "@/lib/avatar-client";
import { PartThumb } from "./PartThumb";
import { PaletteSwatch } from "./PaletteSwatch";

// Editable slots exposed in studio (spec 18 tabs).
const SLOTS: { slot: string; label: string; optional: boolean }[] = [
  { slot: "hair", label: "Причёска", optional: true },
  { slot: "headwear", label: "Головной убор", optional: true },
  { slot: "glasses", label: "Очки", optional: true },
  { slot: "torso", label: "Одежда", optional: false },
  { slot: "prop_hand", label: "Предмет в руке", optional: true },
  { slot: "prop_desk_a", label: "Стол: ноутбук", optional: true },
  { slot: "bg_wall", label: "Фон", optional: false },
];

export function StudioPanel({ config, onChange, onSave, animPreset, onAnimChange }: {
  config: AvatarConfig;
  onChange: (c: AvatarConfig) => void;
  onSave: (c: AvatarConfig) => void;
  animPreset: string;
  onAnimChange: (id: string) => void;
}) {
  const [assets, setAssets] = useState<ClientAssets | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { loadClientAssets().then(setAssets).catch(() => setLoadError(true)); }, []);

  const resolved = useMemo(() => assets ? resolveConfig(assets.manifest, config) : null, [assets, config]);
  if (loadError) return <div className="p-4 text-red-500">Не удалось загрузить ассеты аватара.</div>;
  if (!assets || !resolved) return <div className="p-4 text-neutral-500">Загрузка…</div>;

  const paletteMap = assets.palettes[resolved.palette]!;
  const partsBySlot = (slot: string): PartEntry[] => assets.manifest.parts.filter((p) => p.slot === slot);

  const setPart = (slot: string, id: string | null) => {
    const next: AvatarConfig = { ...config, parts: { ...config.parts, [slot]: id } };
    // client-side rule mirror: headwear nulls hair (spec pitfall 14)
    if (slot === "headwear" && id) next.parts.hair = null;
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">Анимация</h3>
        <div className="flex flex-wrap gap-2">
          {assets.animations.presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onAnimChange(p.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                animPreset === p.id
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
              }`}
            >{p.title}</button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-neutral-500">Палитра</h3>
        <div className="flex flex-wrap gap-2">
          {assets.manifest.palettes.map((name) => (
            <PaletteSwatch key={name} name={name} map={assets.palettes[name]!}
              selected={resolved.palette === name}
              onClick={() => onChange({ ...config, palette: name })} />
          ))}
        </div>
      </section>
      {SLOTS.map(({ slot, label, optional }) => (
        <section key={slot}>
          <h3 className="mb-2 text-sm font-semibold text-neutral-500">{label}</h3>
          <div className="flex flex-wrap gap-2">
            {optional && (
              <PartThumb partId={null} paletteMap={paletteMap}
                selected={resolved.parts[slot] == null} onClick={() => setPart(slot, null)} />
            )}
            {partsBySlot(slot).map((p) => (
              <PartThumb key={p.id} partId={p.id} paletteMap={paletteMap}
                selected={resolved.parts[slot] === p.id} onClick={() => setPart(slot, p.id)} />
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onSave(config)} className="rounded-lg bg-neutral-900 px-5 py-2 text-white">Сохранить</button>
        <button
          onClick={() => {
            const code = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
            navigator.clipboard?.writeText(code).then(
              () => setCopied(true),
              () => setCopied(false),
            );
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg border border-neutral-300 px-5 py-2 text-neutral-700 hover:border-neutral-500"
        >{copied ? "Скопировано" : "Скопировать код аватара"}</button>
      </div>
    </div>
  );
}
