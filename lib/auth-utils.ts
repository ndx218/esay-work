import { parse } from 'cookie';

/**
 * 從 `cookie` 標頭字串擷取 NextAuth 的 JWT Session Token
 *
 * -   在 http (開發環境) 叫 `next-auth.session-token`
 * -   在 https (Prod / Vercel) 叫 `__Secure-next-auth.session-token`
 * -   若你曾自訂過 cookieName，也可再加對應 key
 */
export function getTokenFromCookie(cookieHeader = ''): string | null {
  if (!cookieHeader) return null;

  const cookies = parse(cookieHeader);

  return (
    cookies['__Secure-next-auth.session-token'] || // https
    cookies['next-auth.session-token'] ||          // http / dev
    cookies['session-token'] ||                    // 極舊版 fallback
    null
  );
}
