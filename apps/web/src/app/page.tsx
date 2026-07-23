"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ASSETS_VERSION } from "@faceless/avatar-core";

interface Character {
  id: string;
  title: string;
  tags?: string[];
}

export default function CatalogPage() {
  const [chars, setChars] = useState<Character[]>([]);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch(`/assets/v${ASSETS_VERSION}/characters.json`)
      .then((r) => r.json())
      .then((d) => setChars(d.characters ?? []))
      .catch(() => setErr(true));
  }, []);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Безликие аватары для видео</h1>
        <p className="mt-2 max-w-2xl text-neutral-600">
          Готовые 2D-персонажи с анимациями. Выбери аватара, настрой детали и скачай
          ролик с зелёным фоном или прозрачностью — для монтажа в любой программе.
          Без генерации изображений: только проверенная библиотека слоёв.
        </p>
        <nav className="mt-4 flex gap-3 text-sm">
          <Link href="/studio" className="rounded-lg bg-neutral-900 px-4 py-2 text-white">Открыть студию</Link>
        </nav>
      </header>

      {err && <p className="text-red-600">Не удалось загрузить каталог.</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {chars.map((c) => (
          <Link
            key={c.id}
            href={`/c/${c.id}`}
            className="group overflow-hidden rounded-xl border border-neutral-200 transition hover:border-neutral-400"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/catalog/${c.id}.png`}
              alt={c.title}
              width={480}
              height={480}
              className="aspect-square w-full object-cover"
            />
            <div className="p-3">
              <p className="font-medium">{c.title}</p>
              {c.tags?.length ? (
                <p className="mt-0.5 text-xs text-neutral-500">{c.tags.join(" · ")}</p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>

      {!chars.length && !err && <p className="text-neutral-500">Загрузка…</p>}
    </main>
  );
}
