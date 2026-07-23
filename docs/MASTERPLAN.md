# HalalAvatar — мастер-план реализации (для модели-исполнителя)

Продукт: каталог безликих 2D flat-аватаров с анимациями для видеомейкеров.
Человек листает каталог → скачивает готовый луп (хромакей MP4 для CapCut) →
или собирает своего в студии и рендерит в браузере. Всё бесплатно: Vercel
Hobby + Neon + статика в repo/Releases + рендер каталога в Codespaces +
браузерный рендер для кастомов. Чат вторичен, не удалять, убрать из фокуса.

Ниша: гарантированная безликость (структурно, валидатором), скромный
мужской гардероб, анатомические жесты (FK-цепочка) вместо послойных
эффектов как у Storyset.

РЕШЕНИЯ ВЛАДЕЛЬЦА (обязательны, не оспаривать):
- ТОЛЬКО МУЖСКИЕ персонажи. Женских не добавлять. Хиджаб как женский
  головной убор из каталога исключён (ассет p_headwear_hijab_a оставлен
  в библиотеке, но НИ ОДИН персонаж каталога его не носит).
- БЕЗ ФОНА. bg_wall/bg_decor_l/bg_decor_r в defaults = null. Все кадрирования
  вырезают персонажа на прозрачность. Стол и настольные пропсы входят в
  BACKDROP_SLOTS и в вырезы НЕ попадают.
- Аксессуары (очки и пр.) не приоритет: расширять в последнюю очередь.

## Состояние после K1 (уже в репо, НЕ переделывать)
- `avatar-core`: экспортирован `extractSymbols` (общий для worker и браузера).
- `worker/render.ts`: `tailMs` (0 = точный луп); FRAMINGS bust/overlay/portrait/square
  (scene удалён: без фона кадр 16:9 был на 86% пуст); дефолт framing = overlay;
  FORMATS mp4/mp4_green/mov_qtrle/mov_prores/png_seq. WebM-альфы НЕТ намеренно
  (libvpx молча теряет альфу — проверено декодированием).
- 17 клипов (7 новых: idle_sway2 7200мс, wave_R, nod_double, shake_no,
  think_hold, celebrate, typing — с антиципацией/лагом/овершутом).
- `packages/assets/src/catalog/{animations.json,characters.json}`:
  10 луп-пресетов ×7200мс, 6 МУЖСКИХ персонажей (murad, kamran, tural,
  elvin, rashad, orxan) — различаются палитрой, очками, наличием телефона. build.ts валидирует луп-математику
  (idle: 0..D, D % period == 0; жест целиком в окне) и конфиги персонажей;
  копирует оба файла в `public/assets/v{V}/`.
- `worker/render-catalog.mjs`: CLI-матрица chars×anims×framings×formats,
  идемпотентен (skip existing), `--posters`, пишет catalog-manifest.json.
- Тест `loop.test.ts`: frameSVG(0) === frameSVG(D) побайтно для всех пресетов.
- 6 палитр (добавлены emerald/ivory/midnight).

## Жёсткие правила для исполнителя
1. Не менять контракты ядра (samplePose, composeSceneSVG, типы, LIMITS).
2. Пределы рантайма: r ±25°, t ±40px, s ±0.05 (авторский кап ×1.5).
   Из этого СЛЕДУЕТ: жесты «рука к лицу», «рука вверх над головой»
   физически недостижимы — не пытаться, не поднимать лимиты.
3. Клипы: keys[0].t === 0, ключи по возрастанию t, значения в капах,
   id === имя файла. После правки ассетов/клипов — `pnpm build:assets`
   обязателен; версия каталога = manifest.version (bump при новых частях).
4. Безликость: никаких примитивов в лицевой зоне (круг 800,295 r62),
   кроме очков и одиночной skin-заливки в head/headwear. Валидатор отклонит.
5. Цвета ТОЛЬКО var(--c-*). Никаких raw hex в частях.
6. Тесты не удалять; после каждого этапа `pnpm -r test` зелёный.
7. Текст пользователя — только textContent, единственный innerHTML —
   инжект спрайтшита и compose-вывод (доверенный).

---

## K2 — Студия: пресеты анимаций + share-конфиг (Опус)

### 2.1 Данные
Клиент грузит `/assets/v{V}/animations.json` (уже собирается) рядом с
manifest/clips в `loadClientAssets()` (`apps/web/src/lib/avatar-client.ts`):
добавить в Promise.all fetch animations.json, расширить тип ClientAssets
полем `animations: { loopDurationMs: number; presets: Preset[] }`.
Тип Preset: `{ id: string; title: string; posterMs: number; instances: Instance[] }`.

### 2.2 UI
В `StudioPanel` добавить секцию «Анимация» ПЕРЕД палитрой: кнопки-чипы по
presets (title), выбранный хранится в `useAppStore` (новое поле
`animPreset: string`, default "idle_calm", + setter). Страница studio
передаёт в `<AvatarStage instances={...}>` инстансы выбранного пресета.
ВАЖНО: у AvatarStage instances эффект уже есть; экземпляры пресета — 
loop-инстансы idle с endMs=7200, а плеер играет по performance.now без
границы — луп идёт естественно, т.к. clip.loop сэмплируется по модулю,
НО endMs=7200 обрежет idle после первого круга. Решение: при передаче в
плеер маппить пресет: для loop-клипов endMs -> Infinity замена
(`{...i, endMs: i.endMs === animations.loopDurationMs ? 10_000_000 : i.endMs}`),
для жестов размножать по кругу НЕ нужно — вместо этого зациклить время:
проще всего добавить в AvatarPlayer опцию loopMs: в nowMs() возвращать
`t % loopMs`. Минимальная правка ядра допустима: конструктор
AvatarPlayer(svg, clips, opts?: { loopMs?: number }) и в nowMs()
`const t = raw; return this.loopMs ? t % this.loopMs : t;`
Это НЕ меняет samplePose/контракты — только клиентский плеер. Обнови
AvatarStage: new AvatarPlayer(svg, assets.clips, { loopMs: animations.loopDurationMs }).

### 2.3 Share-конфиг
Кнопка «Скопировать код аватара» в студии: 
`btoa(unescape(encodeURIComponent(JSON.stringify(config))))` → в буфер
(navigator.clipboard.writeText) с toast «Скопировано». Обратно не парсим
нигде пока (пригодится CLI later). 

DoD K2: в студии выбирается любой из 10 пресетов, аватар играет его
бесконечным бесшовным лупом; смена персонажа не сбрасывает пресет;
`pnpm -r test` зелёный; на Vercel работает.

---

## K3 — Браузерный экспорт (Опус; код ниже готовый, интегрировать)

Зависимости: `pnpm --filter @faceless/web add mp4-muxer@5 jszip@3`.
Файл `apps/web/src/lib/browser-render.ts` — вставить ЦЕЛИКОМ:

```ts
"use client";
import {
  composeSceneSVG, resolveConfig, samplePose, extractSymbols,
  ASSETS_VERSION, FPS_ as _unused, // FPS не экспортирован под этим именем — см. ниже
} from "@faceless/avatar-core";
```
СТОП: точные импорты такие:
```ts
"use client";
import {
  composeSceneSVG, resolveConfig, samplePose, extractSymbols, ASSETS_VERSION,
  type AvatarConfig, type Clip, type Instance, type Manifest,
} from "@faceless/avatar-core";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import JSZip from "jszip";

const FPS = 30;
const CHROMA_GREEN = "#00B140";

// Кадрирования дублируем константой (ядро их не экспортирует — они в worker).
// Держать В СИНХРОНЕ с apps/worker/src/render.ts.
const BACKDROP = ["bg_wall","bg_decor_l","bg_decor_r","desk","prop_desk_a","prop_desk_b"];
export const BROWSER_FRAMINGS = {
  bust:     { viewBox: "596 96 408 536",  hideSlots: BACKDROP, width: 1080, height: 1419 },
  overlay:  { viewBox: "560 90 480 542",  hideSlots: BACKDROP, width: 1080, height: 1220 },
  portrait: { viewBox: "575 -168 450 800", hideSlots: BACKDROP, width: 1080, height: 1920 },
  square:   { viewBox: "530 92 540 540",  hideSlots: BACKDROP, width: 1080, height: 1080 },
} as const;
export type BrowserFraming = keyof typeof BROWSER_FRAMINGS;

interface FlatAssets {
  manifest: Manifest;
  palettes: Record<string, Record<string,string>>;
  clips: Record<string, Clip>;
  symbols: Record<string, string>;
}
let flatCache: FlatAssets | null = null;
export async function loadFlatAssets(): Promise<FlatAssets> {
  if (flatCache) return flatCache;
  const base = `/assets/v${ASSETS_VERSION}`;
  const [manifest, palettes, clips, spritesTxt] = await Promise.all([
    fetch(`${base}/manifest.json`).then(r=>r.json()),
    fetch(`${base}/palettes.json`).then(r=>r.json()),
    fetch(`${base}/clips.json`).then(r=>r.json()),
    fetch(`${base}/sprites.svg`).then(r=>r.text()),
  ]);
  flatCache = { manifest, palettes, clips, symbols: extractSymbols(spritesTxt) };
  return flatCache;
}

function flatFrameSVG(a: FlatAssets, config: AvatarConfig, instances: Instance[],
                      framing: BrowserFraming, tMs: number): string {
  const fr = BROWSER_FRAMINGS[framing];
  const resolved = resolveConfig(a.manifest, config);
  const pose = samplePose(instances, a.clips, tMs);
  return composeSceneSVG(a.manifest, resolved, pose, {
    mode: "flat", paletteMap: a.palettes[resolved.palette]!,
    symbols: a.symbols, hideSlots: fr.hideSlots as string[], viewBox: fr.viewBox,
  });
}

async function svgToBitmap(svg: string, w: number, h: number): Promise<ImageBitmap> {
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(w, h);
    img.src = url;
    await img.decode();
    return await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" });
  } finally { URL.revokeObjectURL(url); }
}

export interface ExportJob {
  config: AvatarConfig;
  instances: Instance[];
  durationMs: number;         // = animations.loopDurationMs
  framing: BrowserFraming;
  onProgress?: (done: number, total: number) => void;
}

// ---- Экспорт 1: PNG-секвенция с НАСТОЯЩЕЙ альфой (работает везде) ----
export async function exportPngZip(job: ExportJob): Promise<Blob> {
  const a = await loadFlatAssets();
  const fr = BROWSER_FRAMINGS[job.framing];
  const canvas = document.createElement("canvas");
  canvas.width = fr.width; canvas.height = fr.height;
  const ctx = canvas.getContext("2d", { alpha: true })!;
  const zip = new JSZip();
  const total = Math.round(job.durationMs * FPS / 1000);
  for (let f = 0; f < total; f++) {
    const svg = flatFrameSVG(a, job.config, job.instances, job.framing, f * 1000 / FPS);
    const bmp = await svgToBitmap(svg, fr.width, fr.height);
    ctx.clearRect(0, 0, fr.width, fr.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), "image/png"));
    zip.file(`${String(f).padStart(5,"0")}.png`, blob);
    job.onProgress?.(f + 1, total);
    if (f % 10 === 0) await new Promise(r => setTimeout(r, 0)); // не вешать UI
  }
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}

// ---- Экспорт 2: хромакей MP4 через WebCodecs (Chrome/Edge) ----
export function webCodecsSupported(): boolean {
  return typeof window !== "undefined" && "VideoEncoder" in window;
}
export async function exportGreenMp4(job: ExportJob): Promise<Blob> {
  const a = await loadFlatAssets();
  const fr = BROWSER_FRAMINGS[job.framing];
  const canvas = document.createElement("canvas");
  canvas.width = fr.width; canvas.height = fr.height;
  const ctx = canvas.getContext("2d")!;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target, fastStart: "in-memory",
    video: { codec: "avc", width: fr.width, height: fr.height, frameRate: FPS },
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  encoder.configure({
    codec: "avc1.42001f", width: fr.width, height: fr.height,
    framerate: FPS, bitrate: 4_000_000,
  });
  const total = Math.round(job.durationMs * FPS / 1000);
  for (let f = 0; f < total; f++) {
    const svg = flatFrameSVG(a, job.config, job.instances, job.framing, f * 1000 / FPS);
    const bmp = await svgToBitmap(svg, fr.width, fr.height);
    ctx.fillStyle = CHROMA_GREEN;
    ctx.fillRect(0, 0, fr.width, fr.height);
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const frame = new VideoFrame(canvas, { timestamp: Math.round(f * 1e6 / FPS) });
    encoder.encode(frame, { keyFrame: f % 60 === 0 });
    frame.close();
    if (encoder.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 0));
    job.onProgress?.(f + 1, total);
  }
  await encoder.flush();
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}

// ---- Экспорт 3 (fallback): realtime MediaRecorder → WebM хромакей ----
export async function exportGreenWebmRealtime(job: ExportJob): Promise<Blob> {
  const a = await loadFlatAssets();
  const fr = BROWSER_FRAMINGS[job.framing];
  const canvas = document.createElement("canvas");
  canvas.width = fr.width; canvas.height = fr.height;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(FPS);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9", videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const doneRec = new Promise<Blob>(res => { rec.onstop = () => res(new Blob(chunks, { type: "video/webm" })); });
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const tick = async () => {
      const t = performance.now() - t0;
      if (t >= job.durationMs) { resolve(); return; }
      const svg = flatFrameSVG(a, job.config, job.instances, job.framing, t);
      const bmp = await svgToBitmap(svg, fr.width, fr.height);
      ctx.fillStyle = CHROMA_GREEN; ctx.fillRect(0, 0, fr.width, fr.height);
      ctx.drawImage(bmp, 0, 0); bmp.close();
      job.onProgress?.(Math.min(t, job.durationMs), job.durationMs);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  return doneRec;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement("a");
  aEl.href = url; aEl.download = filename; aEl.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
```

Замечания исполнителю по этому модулю:
- svgToBitmap: `img.decode()` обязателен до drawImage; blob-URL SVG
  same-origin — canvas НЕ taint'ится, toBlob/VideoFrame легальны.
- Скорость: узкое место — растеризация SVG браузером. На 1080-ширине
  ~10-25 кадров/с; 216 кадров ≈ 10-25 с. Прогресс-бар обязателен.
- Если WebCodecs недоступен (Safari/Firefox старые) — предлагать PNG-ZIP
  (всегда) и realtime-WebM (может дропать кадры на слабых машинах —
  предупредить текстом «на слабом устройстве возможны рывки»).
- Проверка H.264 профиля: если `VideoEncoder.isConfigSupported` вернул
  не supported для avc1.42001f — попробовать "avc1.4d001f", иначе fallback.
  (Опус: обернуть configure в try + isConfigSupported.)

### 3.2 UI «Скачать» в студии
Компонент `DownloadPanel.tsx`: селект пресета (тот же, что в K2 — брать
из стора), радио формат: «MP4 хромакей (для CapCut)» / «PNG-секвенция
с прозрачностью (ZIP)» / «WebM (запасной)», радио кадрирование
overlay/portrait/square, кнопка со спиннером и полосой прогресса
(done/total из onProgress). Имя файла: `halalavatar_{presetId}_{framing}.{ext}`.
Кнопку дизейблить на время рендера. Показ подсказки под MP4: «В CapCut:
эффект Хромакей → пипеткой в зелёный».

DoD K3: в проде на Chrome скачивается MP4 7.2с, в CapCut ключуется чисто;
PNG-ZIP содержит 216 прозрачных кадров; Safari получает ZIP-путь.

---

## K4 — Рендер каталога v1 (делает ПОЛЬЗОВАТЕЛЬ в Codespaces)

Команды для пользователя (в Codespace репозитория):
```
sudo apt-get update && sudo apt-get install -y ffmpeg zip
pnpm install
pnpm build:assets
cd apps/worker
npx tsx render-catalog.mjs --posters
cd ../..
du -sh apps/web/public/catalog
git add apps/web/public/catalog
git commit -m "Catalog v1: 6 characters x 10 loops, green-screen"
git push
```
Оценка: 60 клипов × ~30с ≈ 30-35 мин; размер ≈ 6×10×0.25МБ ≈ 15-20 МБ
(наши замеры: 7.2с overlay green ≈ 0.2-0.3 МБ) + 6 постеров. В бюджете
репозитория. Порог миграции на GitHub Releases: суммарно > 80 МБ
(команда: `gh release create catalog-vX apps/web/public/catalog/**/*.mp4`,
на сайте `NEXT_PUBLIC_CATALOG_BASE=https://github.com/USER/REPO/releases/download/catalog-vX`).

DoD K4: файлы в репо, `https://.../catalog/aisha/greeting_overlay.mp4`
открывается с прод-домена.

---

## K5 — Страницы каталога (Опус)

### 5.1 Главная = каталог
`app/page.tsx` переделать: грид карточек персонажей из
`/assets/v{V}/characters.json` + постер `/catalog/{id}/poster.png`
(next/image unoptimized или обычный img), имя, теги. Клик → `/c/[id]`.
Ссылки в шапке: «Каталог» (/), «Студия» (/studio). Чат убрать из шапки
(роут оставить).

### 5.2 Страница персонажа `app/c/[id]/page.tsx` (client)
Данные: characters.json (найти по id; нет — notFound()), animations.json,
`/catalog/catalog-manifest.json` (какие файлы реально есть).
Верх: `<video src autoplay loop muted playsInline>` выбранного пресета
(default idle_calm). Ниже — чипы пресетов (переключают src). Кнопки:
«Скачать MP4 (хромакей)» = <a download href=файл>; «Другие форматы» →
ссылка в студию с предзаполнением: `/studio?char={id}` — студия при
наличии query подхватывает config персонажа (после загрузки characters.json)
и открывает DownloadPanel. База (`NEXT_PUBLIC_CATALOG_BASE ?? "/catalog"`).
Файл может отсутствовать (не отрендерен) — кнопку скрывать по манифесту.

DoD K5: с прод-домена: главная-каталог, страница Айши, видео лупится,
MP4 скачивается, переход в студию с предвыбранным персонажем работает.

---

## K6 — Мужской гардероб-пак (Опус рисует SVG по рецептам)

Общие правила: symbol id `p_{slot}_{name}`, viewBox "0 0 1600 900",
только whitelisted теги/атрибуты, цвета var(--c-*), ≤8КБ, вне лицевой
зоны (круг 800,295 r62; исключение — очки и одиночная skin-заливка).
После добавления: файл `parts/{slot}/{name}.svg`, запись в manifest.parts,
bump version → "1.1.0", `pnpm build:assets`, тесты.

ТОЛЬКО МУЖСКИЕ элементы. Хиджаб/абайю НЕ добавлять.

Рецепты (координаты выверены: голова circle c=(800,290) r=85,
шея x 776..824 y 352..428, плечи торса y≈420, низ торса y=640):

1) `p_hair_short_b` (короткий ёжик, выше и площе чем short_a):
   path M 716 254 Q 736 196 800 190 Q 864 196 884 254 Q 890 274 884 288
   Q 872 250 800 244 Q 728 250 716 288 Q 710 274 716 254 Z fill var(--c-hair)

2) `p_hair_side_part` (косой пробор — ближе к референсу, но своя геометрия):
   path M 714 260 Q 728 190 800 182 Q 878 188 890 258 Q 894 286 886 306
   Q 880 258 838 246 Q 806 268 762 258 Q 728 262 716 306 Q 708 284 714 260 Z
   fill var(--c-hair)

3) `p_headwear_kufi` (тюбетейка — мужской головной убор):
   купол: path M 726 250 Q 800 174 874 250 L 874 266 Q 800 220 726 266 Z
   fill var(--c-headwear)
   ободок: rect x=726 y=256 width=148 height=10 rx=5 fill var(--c-dark)
   ПРОВЕРКА зоны: угол (726,256) → dist до (800,295) = √(74²+39²) = 83.6 > 62 — вне. OK.

4) `p_torso_shirt_collar` (рубашка с воротником):
   база: path M 662 640 L 662 522 Q 662 434 748 420 L 852 420 Q 938 434 938 522
   L 938 640 Z fill var(--c-shirt)
   воротник: path M 756 420 L 800 458 L 844 420 L 852 420 L 800 476 L 748 420 Z
   fill var(--c-shirt2)
   планка: rect x=794 y=458 width=12 height=182 fill var(--c-shirt2)

5) `p_torso_thobe` (тоб — длинная мужская роба):
   path M 640 640 L 648 470 Q 660 424 748 420 L 852 420 Q 940 424 952 470
   L 960 640 Z fill var(--c-shirt)
   ворот-планка: rect x=786 y=424 width=28 height=96 rx=6 fill var(--c-shirt2)
   пуговицы: circle cx=800 cy={448,478,508} r=4 fill var(--c-dark)

6) `p_torso_vest` (жилет поверх рубашки):
   рубашка: path M 662 640 L 662 522 Q 662 434 748 420 L 852 420 Q 938 434
   938 522 L 938 640 Z fill var(--c-shirt2)
   жилет: path M 690 640 L 690 500 Q 700 440 752 424 L 782 424 L 800 470
   L 818 424 L 848 424 Q 900 440 910 500 L 910 640 Z fill var(--c-shirt)

7) `p_prop_desk_b_tasbih` (чётки; slot prop_desk_b, замена кружке):
   11 circle r=7 fill var(--c-accent) по дуге центр (1180,600) R=52,
   θ от 200° до 340° шагом 14°: cx=1180+52cosθ, cy=600+52sinθ.
   кисточка: line x1=1216 y1=610 x2=1216 y2=634 stroke var(--c-accent)
   stroke-width=5 stroke-linecap=round

8) `p_prop_desk_a_book` (книга; slot prop_desk_a, замена ноутбуку):
   обложка: rect x=360 y=596 width=180 height=44 rx=6 fill var(--c-dark)
   страницы: rect x=368 y=588 width=164 height=14 rx=4 fill var(--c-white)
   корешок: rect x=360 y=596 width=12 height=44 fill var(--c-accent)
   БЕЗ надписей (<text> запрещён).

Новые персонажи после пака (добавить в characters.json, ТОЛЬКО мужские):
- `imam`: thobe + kufi, палитра ivory, book вместо laptop, tasbih вместо cup,
  glasses null, prop_hand null
- `yusuf`: shirt_collar + hair_side_part, палитра sand, prop_hand null
- `samir`: vest + hair_short_b, палитра midnight

DoD K6: build:assets зелёный на v1.1.0, новые части видны в студии,
лицевая зона чиста, 3 новых мужских персонажа; пере-рендер каталога — в K4.

## K7 — Гигиена (Опус)
- next → последний 15.x: `pnpm --filter @faceless/web add next@15`,
  `pnpm install`, локально `pnpm --filter @faceless/web build` в Codespaces
  (там prisma качается), пуш. Наш код совместим (params уже Promise).
- В чате VideoButton заменить ссылкой «Скачать аватара в студии» (/studio).
- README: раздел «Каталог» + команды K4.

## Отложено сознательно (не делать без запроса)
- Воркер на VPS/Redis (платно), настоящая авторизация, WebM-альфа,
  пер-таргетные лимиты, деформация форм (изгиб рук), lip-sync (лица нет).

## Порядок и зависимости
K2 → K3 (нужен выбор пресета) → K4 (пользователь) → K5 (нужны файлы K4)
→ K6 → повтор K4 для новых персонажей → K7 в любой момент после K2.
