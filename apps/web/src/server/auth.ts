import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./db";

// MVP auth: demo credentials behind AUTH_DEMO=1 (spec 20). Swap for Email magic-link in prod.
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Demo",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(creds) {
        if (process.env.AUTH_DEMO !== "1") return null;
        const email = (creds?.email as string) || "demo@example.com";
        const user = await prisma.user.upsert({
          where: { email }, update: {}, create: { email },
        });
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) { if (user) token.uid = (user as { id: string }).id; return token; },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.uid as string;
      return session;
    },
  },
};
