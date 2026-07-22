import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { requireUserId } from "@/server/session";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: { code: "unauthorized", message: "" } }, { status: 401 });
  const conversations = await prisma.conversation.findMany({
    where: { userId }, orderBy: { createdAt: "desc" },
    select: { id: true, title: true, createdAt: true },
  });
  return NextResponse.json({ conversations });
}
