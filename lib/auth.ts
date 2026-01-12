import { getServerSession } from 'next-auth/next';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '@/pages/api/auth/[...nextauth]';

/* ──────────────────────────────────────────────────────────────── */
/** 在 **Pages Router** 的 API Route 內使用（必須傳 req / res） */
export function getAuthSession(req: NextApiRequest, res: NextApiResponse) {
  return getServerSession(req, res, authOptions);
}

/** 在 **App Router**（或 server action 等）使用的無參數版本 */
export function getAuthSessionApp() {
  return getServerSession(authOptions);
}
