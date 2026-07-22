import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { videoQueue } from "@/server/queue";
import { MAX_VIDEO_MS } from "@faceless/avatar-core";

const Body = z.object({ messageId: z.string() });

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "" } }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: "bad_request", message: "" } }, { status: 400 });

  const msg = await prisma.message.findUnique({ where: { id: parsed.data.messageId } });
  if (!msg || msg.role !== "assistant") return NextResponse.json({ error: { code: "bad_request", message: "not an assistant message" } }, { status: 400 });
  if ((msg.durationMs ?? 0) > MAX_VIDEO_MS) return NextResponse.json({ error: { code: "too_long", message: "exceeds max video length" } }, { status: 400 });

  const job = await prisma.videoJob.create({ data: { userId, messageId: msg.id, status: "queued" } });
  await videoQueue.add("render", { jobId: job.id }, { jobId: job.id, removeOnComplete: true, removeOnFail: false });
  return NextResponse.json({ jobId: job.id }, { status: 202 });
}
