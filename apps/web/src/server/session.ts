import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ?? null;
}
