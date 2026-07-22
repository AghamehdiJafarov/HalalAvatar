import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./db";

export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (id) return id;

  if (process.env.AUTH_DEMO === "1") {
    const user = await prisma.user.upsert({
      where: { email: "demo@example.com" },
      update: {},
      create: { email: "demo@example.com" },
    });
    return user.id;
  }

  return null;
}
