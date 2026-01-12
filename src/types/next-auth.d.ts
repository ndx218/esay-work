// tsconfig.json 已把 "typeRoots": ["./src/types", "./node_modules/@types"]
import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id?: string;
      role?: 'ADMIN' | 'USER';
      credits?: number;
    };
  }

  interface User {
    id?: string;
    role?: 'ADMIN' | 'USER';
    credits?: number;
  }

  interface JWT {
    id?: string;
    role?: 'ADMIN' | 'USER';
    credits?: number;
  }
}
