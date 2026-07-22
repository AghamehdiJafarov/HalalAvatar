# Faceless Avatar Platform

Web platform for chatting with a **faceless 2D flat/vector AI avatar**. No image generation:
the avatar is composed from a validated library of layered SVG parts and animated by a
deterministic runtime. Pipeline: user input → LLM (reply + gesture directives) → TTS →
2D avatar animation synced to audio → optional server-rendered MP4.

## Architecture

- `packages/avatar-core` — isomorphic engine (constants, types, deterministic `samplePose`,
  compositor, gesture scheduler). Runs identically in browser and video worker.
- `packages/assets` — hand-written SVG parts, clips, palettes, manifest, and the validator
  (`build.ts`) that enforces the style/facelessness contract and builds `sprites.svg`.
- `apps/web` — Next.js 15 (App Router): chat, studio, library, API routes, TTS/LLM providers.
- `apps/worker` — BullMQ video worker: per-frame resvg raster + ffmpeg mux.

## Facelessness guarantees

No generative image calls exist anywhere. There are no face-feature slots. The asset
validator rejects any primitive inside the face zone (except glasses / single skin fill).
The LLM only emits closed enum gestures via zod. A CI grep invariant forbids image-gen strings.

## Local development (≤15 commands)

```
cp .env.example .env                 # 1. defaults use file storage + mock LLM/TTS
pnpm install                         # 2.
pnpm build:assets                    # 3. validate parts, build sprites.svg + versioned assets
docker compose up -d postgres redis  # 4.
pnpm --filter @faceless/web exec prisma migrate dev   # 5. create tables
node apps/web/prisma/seed.mjs        # 6. demo user
pnpm --filter @faceless/web dev      # 7. web on :3000
pnpm --filter @faceless/worker dev   # 8. video worker (separate shell)
```

Without `LLM_API_KEY` / `AZURE_SPEECH_KEY`, mock providers are used automatically (M4 slice).
Add real credentials to `.env` for live LLM + TTS.

## Production deploy

```
# on the VPS, with .env filled (real S3/R2, Azure, LLM, APP_DOMAIN):
docker compose build
docker compose up -d
```

Caddy terminates TLS and serves `/assets/*` with immutable cache. `prisma migrate deploy`
runs on web container start.

## Tests

```
pnpm -r test          # runtime determinism, scheduler snapshot, compose, validator,
                      # provider parse/cache, orchestration, video golden frame
```

## Notes

- Asset changes require a version bump in `packages/assets/src/manifest.json`
  (`/assets/vX.Y.Z/` is immutable). Run `pnpm build:assets` after any part edit.
- Video is capped at 90s. TTS reply is clipped to 600 chars before both TTS and scheduler.
