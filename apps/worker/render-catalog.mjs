// Catalog batch renderer. Run from apps/worker:
//   npx tsx render-catalog.mjs --out ../web/public/catalog \
//     --framings overlay --formats mp4_green --posters \
//     [--chars murad,aisha] [--anims greeting,idle_calm] [--force]
//
// Idempotent: existing files are skipped unless --force. Writes
// <out>/catalog-manifest.json describing every rendered artifact.
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { renderVideo, frameSVG, renderFramePNG, FORMATS, FRAMINGS } from "./src/render.ts";
import { loadAssets, assetsDir } from "./src/assets.ts";

const ROOT = resolve(process.cwd(), "..", "..");

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
const OUT = resolve(arg("out", join(ROOT, "apps", "web", "public", "catalog")));
const framings = String(arg("framings", "overlay")).split(",");
const formats = String(arg("formats", "mp4_green")).split(",");
const onlyChars = arg("chars", null)?.split?.(",") ?? null;
const onlyAnims = arg("anims", null)?.split?.(",") ?? null;
const wantPosters = process.argv.includes("--posters");
const force = process.argv.includes("--force");

for (const f of framings) if (!FRAMINGS[f]) { console.error(`unknown framing: ${f}`); process.exit(1); }
for (const f of formats) if (!FORMATS[f]) { console.error(`unknown format: ${f}`); process.exit(1); }

const assets = loadAssets(ROOT);
const anims = JSON.parse(readFileSync(join(assetsDir(ROOT), "animations.json"), "utf8"));
const chars = JSON.parse(readFileSync(join(assetsDir(ROOT), "characters.json"), "utf8")).characters;

const charList = onlyChars ? chars.filter((c) => onlyChars.includes(c.id)) : chars;
const animList = onlyAnims ? anims.presets.filter((p) => onlyAnims.includes(p.id)) : anims.presets;

const total = charList.length * animList.length * framings.length * formats.length;
console.log(`catalog: ${charList.length} chars × ${animList.length} anims × ${framings.length} framings × ${formats.length} formats = ${total} clips`);

const manifest = { generatedAt: new Date().toISOString(), loopDurationMs: anims.loopDurationMs, items: [] };
let done = 0, skipped = 0;
const t0 = Date.now();

for (const ch of charList) {
  const charDir = join(OUT, ch.id);
  mkdirSync(charDir, { recursive: true });

  if (wantPosters) {
    const posterPath = join(charDir, "poster.png");
    if (force || !existsSync(posterPath)) {
      const preset = animList[0] ?? anims.presets[0];
      const svg = frameSVG(
        { assets, config: ch.config, instances: preset.instances, framing: "overlay" },
        preset.posterMs,
      );
      const wall = assets.palettes[ch.config.palette]["--c-wall"];
      writeFileSync(posterPath, renderFramePNG(svg, 540, wall));
      console.log(`  poster ${ch.id}`);
    }
  }

  for (const preset of animList) {
    for (const framing of framings) {
      for (const format of formats) {
        const file = `${preset.id}_${framing}.${FORMATS[format].ext}`;
        const outPath = join(charDir, file);
        const rel = `${ch.id}/${file}`;
        if (!force && existsSync(outPath)) {
          skipped++;
          manifest.items.push({ char: ch.id, anim: preset.id, framing, format, file: rel, bytes: statSync(outPath).size });
          continue;
        }
        const work = join(tmpdir(), `cat-${ch.id}-${preset.id}-${framing}-${format}`);
        rmSync(work, { recursive: true, force: true });
        mkdirSync(work, { recursive: true });
        const tJob = Date.now();
        await renderVideo({
          instances: preset.instances,
          durationMs: anims.loopDurationMs,
          tailMs: 0,                       // seamless loop: exact D, no tail
          config: ch.config,
          assets, workDir: work, outPath, framing, format,
        });
        rmSync(work, { recursive: true, force: true });
        done++;
        manifest.items.push({ char: ch.id, anim: preset.id, framing, format, file: rel, bytes: statSync(outPath).size });
        console.log(`  [${done + skipped}/${total}] ${rel}  ${((Date.now() - tJob) / 1000).toFixed(0)}s`);
      }
    }
  }
}

writeFileSync(join(OUT, "catalog-manifest.json"), JSON.stringify(manifest, null, 1));
const mb = manifest.items.reduce((s, i) => s + i.bytes, 0) / 1048576;
console.log(`done: rendered ${done}, skipped ${skipped}, total size ${mb.toFixed(1)} MB, wall ${(((Date.now() - t0) / 1000) / 60).toFixed(1)} min`);
