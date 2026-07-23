import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { validatePart, type ValErr } from "./validator";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "src");
const PARTS_DIR = join(SRC, "parts");
const CLIPS_DIR = join(SRC, "clips");
const LIMITS = { r: 25, t: 40, s: 0.05 };

function fail(msg: string): never { console.error(`\n✗ build:assets FAILED\n${msg}\n`); process.exit(1); }

function listSvgs(dir: string): string[] {
  const out: string[] = [];
  for (const slot of readdirSync(dir)) {
    const slotDir = join(dir, slot);
    if (!statSync(slotDir).isDirectory()) continue;
    for (const f of readdirSync(slotDir)) if (f.endsWith(".svg")) out.push(join(slotDir, f));
  }
  return out;
}

// ---- 1-2. Read + validate parts ----
const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
const errors: string[] = [];
const seenIds = new Set<string>();
const idToInner: Record<string, string> = {};
const idBytes: Record<string, number> = {};

for (const file of listSvgs(PARTS_DIR)) {
  const slot = basename(dirname(file));
  const name = basename(file, ".svg");
  const expectedId = `p_${slot}_${name}`;
  const raw = readFileSync(file, "utf8");
  const bytes = Buffer.byteLength(raw, "utf8");
  const errs: ValErr[] = validatePart(raw, expectedId, slot, bytes);

  if (seenIds.has(expectedId)) errs.push({ code: "BAD_ID", detail: `duplicate id ${expectedId}` });
  seenIds.add(expectedId);
  idBytes[expectedId] = bytes;

  // capture inner markup of the <symbol> for sprite assembly
  const inner = raw.replace(/^\s*<symbol[^>]*>/, "").replace(/<\/symbol>\s*$/, "").trim();
  idToInner[expectedId] = raw.trim();

  for (const e of errs) errors.push(`${file.replace(HERE + "/", "")}: ${e.code} — ${e.detail}`);
}

// ---- 3. Manifest cross-checks ----
const partIds = new Set<string>(manifest.parts.map((p: any) => p.id));
for (const p of manifest.parts) {
  const abs = join(SRC, p.file);
  if (!existsSync(abs)) errors.push(`manifest: part ${p.id} file missing (${p.file})`);
  if (!seenIds.has(p.id)) errors.push(`manifest: part ${p.id} has no matching svg`);
}
for (const id of seenIds) if (!partIds.has(id)) errors.push(`manifest: svg ${id} not listed in manifest.parts`);

for (const arch of manifest.archetypes) {
  for (const [slot, id] of Object.entries<string | null>(arch.defaults)) {
    if (id !== null && !partIds.has(id)) errors.push(`manifest: default ${slot}=${id} unknown`);
  }
  for (const rule of arch.rules ?? []) {
    for (const [slot, id] of Object.entries<string | null>(rule.then.set)) {
      if (id !== null && !partIds.has(id)) errors.push(`manifest: rule sets ${slot}=${id} unknown`);
    }
  }
}

// ---- 3b. Clip validation ----
const clipFiles = readdirSync(CLIPS_DIR).filter((f) => f.endsWith(".json"));
const clipObjs: Record<string, any> = {};
for (const f of clipFiles) {
  const c = JSON.parse(readFileSync(join(CLIPS_DIR, f), "utf8"));
  clipObjs[c.id] = c;
  if (c.id !== basename(f, ".json")) errors.push(`clip ${f}: id "${c.id}" != filename`);
  if (typeof c.durationMs !== "number" || c.durationMs <= 0) errors.push(`clip ${c.id}: bad durationMs`);
  for (const tr of c.tracks) {
    const keys = tr.keys;
    if (!keys.length || keys[0].t !== 0) errors.push(`clip ${c.id}/${tr.target}.${tr.prop}: keys[0].t must be 0`);
    for (let i = 1; i < keys.length; i++) if (keys[i].t < keys[i - 1].t) errors.push(`clip ${c.id}/${tr.target}.${tr.prop}: keys not sorted`);
    const cap = (tr.prop === "r" ? LIMITS.r : (tr.prop === "sx" || tr.prop === "sy") ? LIMITS.s : LIMITS.t) * 1.5;
    for (const k of keys) if (Math.abs(k.v) > cap + 1e-9) errors.push(`clip ${c.id}/${tr.target}.${tr.prop}: |v=${k.v}| exceeds authoring cap ${cap}`);
  }
}
for (const cid of manifest.clips) if (!clipObjs[cid]) errors.push(`manifest: clip ${cid} missing in src/clips`);


// ---- 3c. Catalog validation (loop math + character configs) ----
const CATALOG = join(SRC, "catalog");
const anims = JSON.parse(readFileSync(join(CATALOG, "animations.json"), "utf8"));
const chars = JSON.parse(readFileSync(join(CATALOG, "characters.json"), "utf8"));

for (const p of anims.presets) {
  const D = anims.loopDurationMs;
  for (const inst of p.instances) {
    const c = clipObjs[inst.clip];
    if (!c) { errors.push(`preset ${p.id}: unknown clip ${inst.clip}`); continue; }
    if (c.loop) {
      if (inst.startMs !== 0 || inst.endMs !== D)
        errors.push(`preset ${p.id}: loop clip ${inst.clip} must span 0..${D}`);
      if (D % c.durationMs !== 0)
        errors.push(`preset ${p.id}: ${D} not a multiple of ${inst.clip} period ${c.durationMs} — loop will jump`);
    } else {
      if (inst.startMs < 100 || inst.startMs + c.durationMs > D)
        errors.push(`preset ${p.id}: gesture ${inst.clip}@${inst.startMs} exits window (dur ${c.durationMs}, D ${D})`);
    }
  }
  if (typeof p.posterMs !== "number" || p.posterMs < 0 || p.posterMs > anims.loopDurationMs)
    errors.push(`preset ${p.id}: bad posterMs`);
  for (const aid of p.archetypes ?? [])
    if (!manifest.archetypes.some((x: any) => x.id === aid))
      errors.push(`preset ${p.id}: unknown archetype ${aid}`);
}

const slotOf = new Map<string, string>(manifest.parts.map((p: any) => [p.id, p.slot]));
for (const ch of chars.characters) {
  const cfg = ch.config;
  if (!manifest.archetypes.some((a: any) => a.id === cfg.archetype))
    errors.push(`character ${ch.id}: unknown archetype ${cfg.archetype}`);
  if (!manifest.palettes.includes(cfg.palette))
    errors.push(`character ${ch.id}: unknown palette ${cfg.palette}`);
  for (const [slot, id] of Object.entries<string | null>(cfg.parts ?? {})) {
    if (id === null) continue;
    if (!slotOf.has(id)) errors.push(`character ${ch.id}: unknown part ${id}`);
    else if (slotOf.get(id) !== slot) errors.push(`character ${ch.id}: ${id} is not slot ${slot}`);
  }
}

if (errors.length) fail(errors.join("\n"));

// ---- 4. Assemble sprites.svg (no SVGO; trim only) ----
const symbols = manifest.parts.map((p: any) => idToInner[p.id]!.replace(/\s+/g, " ").replace(/> </g, "><")).join("");
const sprites = `<svg xmlns="http://www.w3.org/2000/svg"><defs>${symbols}</defs></svg>`;

// ---- 5. Write versioned outputs ----
const version: string = manifest.version;
const OUT = join(HERE, "..", "..", "apps", "web", "public", "assets", `v${version}`);
mkdirSync(OUT, { recursive: true });

const enrichedParts = manifest.parts.map((p: any) => ({ ...p, bytes: idBytes[p.id] ?? 0 }));
const enrichedManifest = { ...manifest, parts: enrichedParts };

writeFileSync(join(OUT, "sprites.svg"), sprites);
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(enrichedManifest, null, 2));
writeFileSync(join(OUT, "clips.json"), JSON.stringify(clipObjs));
writeFileSync(join(OUT, "palettes.json"), readFileSync(join(SRC, "palettes.json"), "utf8"));
writeFileSync(join(OUT, "animations.json"), JSON.stringify(anims));
writeFileSync(join(OUT, "characters.json"), JSON.stringify(chars));

const versionTs = `// Auto-generated by packages/assets/build.ts. Do not edit by hand.\nexport const ASSETS_VERSION = "${version}";\n`;
writeFileSync(join(HERE, "..", "avatar-core", "src", "assets-version.ts"), versionTs);

const spriteBytes = Buffer.byteLength(sprites, "utf8");
console.log(`✓ assets built  version=${version}  parts=${manifest.parts.length}  clips=${Object.keys(clipObjs).length}  presets=${anims.presets.length}  chars=${chars.characters.length}  sprites.svg=${spriteBytes}B`);
if (spriteBytes > 60 * 1024) fail(`sprites.svg ${spriteBytes}B exceeds 60KB budget`);
