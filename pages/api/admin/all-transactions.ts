// /pages/api/admin/all-transactions.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';          // ✅ Pages API 用這個路徑
import { authOptions } from '@/server/authOptions';         // ✅ 與其他檔案保持一致
import { prisma } from '@/lib/prisma';

type TransactionRecord = {
  id: string;
  amount: number;
  isFirstTopUp: boolean;
  type: string;
  description: string | null;
  createdAt: Date;
  user: { email: string };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ error: string } | TransactionRecord[]>
) {
  /* ---------- 1) 僅允許 GET ---------- */
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method Not Allowed — 只接受 GET' });

  /* ---------- 2) 驗證 Session & ADMIN ---------- */
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user?.role !== 'ADMIN')
      return res.status(403).json({ error: '未授權：僅限管理員操作' });
  } catch (err) {
    console.error('[all-transactions] 取 Session 失敗：', err);
    return res.status(500).json({ error: '伺服器無法驗證身分，請稍後再試' });
  }

  /* ---------- 3) 查詢所有交易 ---------- */
  try {
    const txs = await prisma.transaction.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(txs as TransactionRecord[]);
  } catch (err) {
    console.error('[all-transactions] DB 查詢失敗：', err);
    return res.status(500).json({ error: '伺服器錯誤，查詢失敗' });
  }
}
