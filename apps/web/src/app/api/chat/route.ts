import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { rateLimit } from "@/server/redis";
import { getLLM, getTTS } from "@/server/providers";
import { getStorage } from "@/server/storage";
import { generateAssistantTurn } from "@/server/chat-service";
import type { ChatTurn } from "@/server/llm/client";

const Body = z.object({ conversationId: z.string().nullable().optional(), text: z.string().min(1).max(2000) });

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "login required" } }, { status: 401 });

  const allowed = await rateLimit(`rl:chat:${userId}`, 30, 600);
  if (!allowed) return NextResponse.json({ error: { code: "rate_limited", message: "too many messages" } }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: "invalid body" } }, { status: 400 });
  const { text } = parsed.data;

  // 2. Load/create conversation, save user message
  let conversationId = parsed.data.conversationId ?? null;
  if (conversationId) {
    const conv = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!conv) conversationId = null;
  }
  if (!conversationId) {
    const conv = await prisma.conversation.create({ data: { userId, title: text.slice(0, 40) } });
    conversationId = conv.id;
  }
  await prisma.message.create({ data: { conversationId, role: "user", text } });

  const prior = await prisma.message.findMany({
    where: { conversationId }, orderBy: { createdAt: "asc" }, take: 24,
  });
  const history: ChatTurn[] = prior.map((m: { role: string; text: string }) => ({ role: m.role as "user" | "assistant", content: m.text }));

  try {
    const turn = await generateAssistantTurn(getLLM(), getTTS(), getStorage(), history, text);
    const saved = await prisma.message.create({
      data: {
        conversationId, role: "assistant", text: turn.text, lang: turn.lang,
        audioKey: turn.audioKey, durationMs: turn.durationMs,
        timeline: turn.timeline as unknown as object,
      },
    });
    return NextResponse.json({
      conversationId,
      message: {
        id: saved.id, text: turn.text, lang: turn.lang,
        audioUrl: turn.audioUrl, durationMs: turn.durationMs, timeline: turn.timeline,
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    const code = /LLM/i.test(msg) ? "llm_failed" : "tts_failed";
    return NextResponse.json({ error: { code, message: msg } }, { status: 502 });
  }
}
