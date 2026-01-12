// /pages/api/admin/add-points.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { z } from 'zod';

const BodySchema = z.object({
  email: z.string().email('email 無效'),
  amount: z.number().int('必須為整數').positive('必須為正整數').max(1_000_000),
  idempotencyKey: z.string().max(128).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: '僅支援 POST 方法' });

  // 需要帶 req/res 取得 session
  const session = await getAuthSession(req, res);
  if (!session || session.user?.role !== 'ADMIN')
    return res.status(403).json({ error: '未授權：僅限管理員操作' });

  const admin = session.user!; // 之後統一用 admin

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
  }
  const { email, amount, idempotencyKey } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // ---- 冪等：同 idempotencyKey 只生效一次 ----
      if (idempotencyKey) {
        const existedTx = await tx.transaction.findUnique({ where: { idempotencyKey } }).catch(() => null);
        if (existedTx) {
          const last = await tx.user.findUnique({
            where: { email },
            select: { id: true, email: true, phone: true, credits: true, role: true },
          });
          if (!last) throw new Error('USER_NOT_FOUND');
          return { user: last, reused: true };
        }
      }

      // ---- 找使用者 ----
      const user = await tx.user.findUnique({
        where: { email },
        select: { id: true, email: true, phone: true, credits: true, role: true },
      });
      if (!user) throw new Error('USER_NOT_FOUND');

      // ---- 原子遞增點數 ----
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { credits: { increment: amount } },
        select: { id: true, email: true, phone: true, credits: true, role: true },
      });

      // ---- 寫交易流水 ----
      await tx.transaction.create({
        data: {
          userId: user.id,
          amount,
          type: 'ADMIN_TOPUP',
          description: `管理員 ${admin.email ?? admin.id ?? 'ADMIN'} 加值 ${amount} 點（新餘額 ${updated.credits}）`,
          performedBy: (admin.id ?? admin.email ?? 'ADMIN'),
          idempotencyKey: idempotencyKey ?? null,
        },
      });

      return { user: updated, reused: false };
    });

    return res.status(200).json({
      message: result.reused ? '重複請求（冪等命中）' : `已為 ${email} 加值 ${amount} 點`,
      user: result.user, // { id,email,phone,credits,role }
    });
  } catch (err: any) {
    if (err?.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: '使用者不存在' });
    }
    // 競態下第二次插入相同 idempotencyKey，撞 unique -> 視為冪等
    if (err?.code === 'P2002' && err?.meta?.target?.includes('idempotencyKey')) {
      const u = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, phone: true, credits: true, role: true },
      });
      if (u) return res.status(200).json({ message: '重複請求（冪等命中）', user: u });
    }

    console.error('[admin/add-points] 失敗', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
