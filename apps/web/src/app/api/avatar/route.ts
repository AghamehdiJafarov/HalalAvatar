import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { serverAssets } from "@/server/assets";
import { resolveConfig, type AvatarConfig } from "@faceless/avatar-core";
import { DEFAULT_CONFIG } from "@/server/chat-service";

const ConfigZ = z.object({
  archetype: z.string(),
  palette: z.string(),
  parts: z.record(z.string(), z.string().nullable()),
});

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "" } }, { status: 401 });
  const prof = await prisma.avatarProfile.findUnique({ where: { userId } });
  const config = (prof?.config as AvatarConfig | undefined) ?? DEFAULT_CONFIG;
  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "" } }, { status: 401 });
  const parsed = ConfigZ.safeParse((await req.json().catch(() => null))?.config);
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: "invalid config" } }, { status: 400 });

  // Normalize through resolveConfig (unknown IDs dropped, rules applied) — server is source of truth.
  const { manifest } = serverAssets();
  const resolved = resolveConfig(manifest, parsed.data as AvatarConfig);
  const normalized: AvatarConfig = { archetype: resolved.archetype.id, palette: resolved.palette, parts: resolved.parts };

  await prisma.avatarProfile.upsert({
    where: { userId },
    create: { userId, config: normalized as unknown as object },
    update: { config: normalized as unknown as object },
  });
  return NextResponse.json({ config: normalized });
}
