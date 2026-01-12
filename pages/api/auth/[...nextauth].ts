// /pages/api/auth/[...nextauth].ts
import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
  ],

  session: { strategy: 'jwt' },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 首次登入：把 DB 欄位塞進 JWT
      if (user) {
        token.id      = (user as any).id;
        token.role    = (user as any).role;
        token.credits = (user as any).credits;
      }
      // 前端呼叫 useSession().update(payload) 時即時覆寫
      if (trigger === 'update' && session) {
        if ('credits' in session) token.credits = (session as any).credits;
        if ('role'    in session) token.role    = (session as any).role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id      = token.id;
        (session.user as any).role    = token.role;
        (session.user as any).credits = token.credits;
      }
      return session;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug : process.env.NODE_ENV !== 'production',
};

export default NextAuth(authOptions);
