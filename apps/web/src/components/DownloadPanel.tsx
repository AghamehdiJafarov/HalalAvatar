"use client";
import { useState } from "react";
import type { AvatarConfig, Instance } from "@faceless/avatar-core";
import {
  BROWSER_FRAMINGS, exportPngZip, exportGreenMp4, exportGreenWebmRealtime,
  webCodecsSupported, saveBlob, type BrowserFraming,
} from "@/lib/browser-render";

type FormatId = "mp4_green" | "png_alpha" | "webm_green";

const FORMATS: { id: FormatId; title: string; hint: string; ext: string }[] = [
  { id: "mp4_green", title: "MP4, зелёный фон", hint: "Для CapCut: эффект «Хромакей» → пипетка в зелёный", ext: "mp4" },
  { id: "png_alpha", title: "PNG-кадры с прозрачностью (ZIP)", hint: "Без потерь, открывается везде. Файл крупный", ext: "zip" },
  { id: "webm_green", title: "WebM, зелёный фон (запасной)", hint: "Если MP4 не работает. На слабом ПК возможны пропуски кадров", ext: "webm" },
];

export function DownloadPanel({ config, instances, durationMs, presetId }: {
  config: AvatarConfig;
  instances: Instance[];
  durationMs: number;
  presetId: string;
}) {
  const [framing, setFraming] = useState<BrowserFraming>("overlay");
  const [format, setFormat] = useState<FormatId>("mp4_green");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setPct(0); setError(null);
    const job = {
      config, instances, durationMs, framing,
      onProgress: (done: number, total: number) => setPct(Math.round((done / total) * 100)),
    };
    try {
      let blob: Blob;
      if (format === "png_alpha") blob = await exportPngZip(job);
      else if (format === "mp4_green") {
        if (!webCodecsSupported()) throw new Error("Этот браузер не умеет MP4. Выбери PNG-кадры или WebM");
        blob = await exportGreenMp4(job);
      } else blob = await exportGreenWebmRealtime(job);

      const ext = FORMATS.find((f) => f.id === format)!.ext;
      saveBlob(blob, `halalavatar_${presetId}_${framing}.${ext}`);
    } catch (e) {
      setError((e as Error).message || "Не удалось создать файл");
    } finally {
      setBusy(false); setPct(0);
    }
  };

  const active = FORMATS.find((f) => f.id === format)!;

  return (
    <section className="rounded-xl border border-neutral-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-500">Скачать аватара</h3>

      <p className="mb-1 text-xs text-neutral-500">Кадр</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(BROWSER_FRAMINGS) as BrowserFraming[]).map((k) => (
          <button
            key={k}
            onClick={() => setFraming(k)}
            disabled={busy}
            className={`rounded-full border px-3 py-1 text-sm disabled:opacity-40 ${
              framing === k ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700"
            }`}
          >{BROWSER_FRAMINGS[k].title}</button>
        ))}
      </div>

      <p className="mb-1 text-xs text-neutral-500">Формат</p>
      <div className="mb-2 flex flex-col gap-1">
        {FORMATS.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm text-neutral-800">
            <input
              type="radio" name="fmt" checked={format === f.id}
              onChange={() => setFormat(f.id)} disabled={busy}
            />
            {f.title}
          </label>
        ))}
      </div>
      <p className="mb-3 text-xs text-neutral-500">{active.hint}</p>

      <button
        onClick={run}
        disabled={busy}
        className="w-full rounded-lg bg-neutral-900 px-5 py-2 text-white disabled:opacity-50"
      >{busy ? `Готовлю файл… ${pct}%` : "Скачать"}</button>

      {busy && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-neutral-200">
          <div className="h-full bg-neutral-900 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-neutral-400">
        Файл собирается прямо в браузере: {(durationMs / 1000).toFixed(1)} сек, {Math.round(durationMs * 30 / 1000)} кадров.
      </p>
    </section>
  );
}
