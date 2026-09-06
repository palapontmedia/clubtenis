import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isSessionStillValid } from "@/lib/session-validity";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Throttle by email to blunt credential-stuffing / brute force
        // without needing an external service for the MVP.
        const { success } = rateLimit(`login:${email.toLowerCase()}`, 5, 5 * 60_000);
        if (!success) return null;

        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.roleCheckedAt = Date.now();
        token.loginAt = Date.now();
        return token;
      }

      // Tokens minted before loginAt existed: anchor it once so the
      // revocation check below has a stable reference. Anchoring to "now"
      // means a pre-existing session is only revoked by a cutoff set from
      // here on (password reset / role change), never retroactively.
      if (typeof token.loginAt !== "number") token.loginAt = Date.now();

      // Re-read the role + session-revocation cutoff from the DB
      // periodically (same cadence, one extra column — no per-request
      // query) so a role change or a password reset takes effect without
      // waiting for the JWT to expire, instead of trusting the token
      // forever. This is the source of truth across every instance.
      const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
      const stale = Date.now() - checkedAt > 5 * 60_000;
      if (trigger === "update" || stale) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, sessionsValidFrom: true },
        });
        // User deleted, or this session predates the user's revocation
        // cutoff (password reset / role change): returning null drops the
        // session and forces a fresh login.
        if (!current) return null;
        if (!isSessionStillValid(token.loginAt, current.sessionsValidFrom)) return null;
        token.role = current.role;
        token.roleCheckedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
