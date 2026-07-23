import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./db";

// Returns the current user id. In demo mode (AUTH_DEMO=1) there is no login UI,
// so if there is no session we transparently use a shared demo user. This keeps
// chat/studio/save working for everyone without a sign-in screen.
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
