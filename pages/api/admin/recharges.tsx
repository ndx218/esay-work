import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/server/authOptions';
import { prisma } from '@/lib/prisma';

type RechargeItem = {
  id: string;
  name: string;
  phone: string;
  referralCode: string | null;
  imageUrl: string;
  createdAt: Date;
};
type Res =
  | { error: string }
  | { data: RechargeItem[] };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Res>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed — 只接受 GET' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || session.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: '未授權：僅限管理員操作' });
  }

  try {
    const records = await prisma.topUpSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        phone: true,
        referralCode: true,
        imageUrl: true,
        createdAt: true,
      },
    });
    return res.status(200).json({ data: records });
  } catch (err) {
    console.error('[admin/recharges] 失敗', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
}
