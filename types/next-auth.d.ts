// types/next-auth.d.ts  ── 只留這一份型別擴充檔
import 'next-auth';
import type { DefaultSession } from 'next-auth';

type UserRole = 'USER' | 'ADMIN';

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id?: string;
      phone?: string | null;
      referredBy?: string | null;
      referralCode?: string | null;
      credits?: number;
      role?: UserRole;
    };
  }

  interface User {
    id?: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number;
    role?: UserRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    phone?: string | null;
    referredBy?: string | null;
    referralCode?: string | null;
    credits?: number;
    role?: UserRole;
  }
}
