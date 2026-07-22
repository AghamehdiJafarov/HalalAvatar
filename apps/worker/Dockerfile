FROM node:20-slim
RUN apt-get update && apt-get install -y ffmpeg openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
# web assets (sprites/manifest/clips) are needed by the worker at runtime
COPY apps/web/public/assets ./apps/web/public/assets
COPY apps/web/prisma ./apps/web/prisma
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @faceless/worker exec prisma generate --schema ./prisma/schema.prisma
RUN pnpm --filter @faceless/avatar-core build && pnpm --filter @faceless/worker build
CMD ["node", "apps/worker/dist/index.js"]
