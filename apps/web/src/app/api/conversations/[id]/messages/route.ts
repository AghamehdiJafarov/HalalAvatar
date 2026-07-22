import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { getStorage } from "@/server/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "" } }, { status: 401 });
  const { id } = await params;
  const conv = await prisma.conversation.findFirst({ where: { id, userId } });
  if (!conv) return NextResponse.json({ error: { code: "not_found", message: "" } }, { status: 404 });

  const storage = getStorage();
  const rows = await prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
  type MessageRow = {
    id: string; role: string; text: string; lang: string | null;
    audioKey: string | null; durationMs: number | null; timeline: unknown;
  };
  const messages = rows.map((m: MessageRow) => ({
    id: m.id, role: m.role, text: m.text, lang: m.lang,
    audioUrl: m.audioKey ? storage.publicUrl(m.audioKey) : null,
    durationMs: m.durationMs, timeline: m.timeline,
  }));
  return NextResponse.json({ messages });
}
