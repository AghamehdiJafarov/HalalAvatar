import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";
import { getStorage } from "@/server/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "" } }, { status: 401 });
  const { jobId } = await params;
  const job = await prisma.videoJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return NextResponse.json({ error: { code: "not_found", message: "" } }, { status: 404 });
  const url = job.status === "done" && job.resultKey ? getStorage().publicUrl(job.resultKey) : null;
  return NextResponse.json({ status: job.status, url, error: job.error ?? null });
}
