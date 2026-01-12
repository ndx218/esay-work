// /pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code || typeof phone !== 'string' || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid phone or code' });
  }

  try {
    const record = await prisma.verificationCode.findFirst({
      where: { phone, code },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return res.status(401).json({ error: '驗證碼錯誤或已過期' });
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return res.status(404).json({ error: '使用者不存在，請先註冊' });
    }

    const fakeJwt = Buffer.from(`${user.id}:${user.phone}`).toString('base64');

    return res.status(200).json({
      token: fakeJwt,
      user: {
        id: user.id,
        phone: user.phone,
        credits: user.credits,
      },
    });
  } catch (err) {
    console.error('[Login Error]', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
