"use client";
import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AvatarStage } from "@/components/AvatarStage";
import { DownloadPanel } from "@/components/DownloadPanel";
import { loadClientAssets, type ClientAssets } from "@/lib/avatar-client";
import { ASSETS_VERSION, type AvatarConfig } from "@faceless/avatar-core";

interface Character { id: string; title: string; tags?: string[]; config: AvatarConfig }

export default function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assets, setAssets] = useState<ClientAssets | null>(null);
  const [chars, setChars] = useState<Character[] | null>(null);
  const [presetId, setPresetId] = useState("greeting");

  useEffect(() => { loadClientAssets().then(setAssets).catch(() => {}); }, []);
  useEffect(() => {
    fetch(`/assets/v${ASSETS_VERSION}/characters.json`)
      .then((r) => r.json())
      .then((d) => setChars(d.characters ?? []))
      .catch(() => setChars([]));
  }, []);

  const character = useMemo(() => chars?.find((c) => c.id === id) ?? null, [chars, id]);
  const preset = useMemo(
    () => assets?.animations.presets.find((p) => p.id === presetId) ?? assets?.animations.presets[0],
    [assets, presetId],
  );

  if (chars && !character) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-neutral-600">Такого аватара нет.</p>
        <Link href="/" className="mt-3 inline-block text-blue-600 underline">Вернуться в каталог</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-4 md:grid-cols-2">
      <div className="md:sticky md:top-4 md:self-start">
        <Link href="/" className="mb-3 inline-block text-sm text-neutral-500 hover:text-neutral-900">← Каталог</Link>
        {character && assets ? (
          <AvatarStage
            config={character.config}
            instances={preset?.instances}
            loopMs={assets.animations.loopDurationMs}
          />
        ) : (
          <div className="aspect-video w-full animate-pulse rounded-xl bg-neutral-100" />
        )}
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{character?.title ?? "…"}</h1>
          {character?.tags?.length ? (
            <p className="mt-1 text-sm text-neutral-500">{character.tags.join(" · ")}</p>
          ) : null}
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-neutral-500">Анимация</h3>
          <div className="flex flex-wrap gap-2">
            {assets?.animations.presets.map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  presetId === p.id
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
                }`}
              >{p.title}</button>
            ))}
          </div>
        </section>

        {character && assets && preset && (
          <DownloadPanel
            config={character.config}
            instances={preset.instances}
            durationMs={assets.animations.loopDurationMs}
            presetId={preset.id}
          />
        )}

        <p className="text-sm text-neutral-500">
          Нужны другие детали — причёска, одежда, цвет?{" "}
          <Link href="/studio" className="text-blue-600 underline">Настрой в студии</Link>.
        </p>
      </div>
    </main>
  );
}
