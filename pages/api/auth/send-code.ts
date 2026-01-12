// ✅ /api/auth/send-code.ts（加強版）
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { randomInt } from 'crypto';

const prisma = new PrismaClient();

// 驗證碼有效時間（單位：毫秒）
const CODE_TTL = 3 * 60 * 1000; // 3 分鐘

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid phone number' });
  }

  try {
    const existing = await prisma.verificationCode.findUnique({
      where: { phone },
    });

    const now = new Date();

    if (existing && now.getTime() - existing.createdAt.getTime() < CODE_TTL) {
      const secondsLeft = Math.ceil((CODE_TTL - (now.getTime() - existing.createdAt.getTime())) / 1000);
      return res.status(429).json({ error: `請稍後 ${secondsLeft} 秒再試` });
    }

    const code = randomInt(100000, 999999).toString();

    await prisma.verificationCode.upsert({
      where: { phone },
      update: { code, createdAt: now },
      create: { phone, code, createdAt: now },
    });

    // 模擬簡訊（TODO：串接真實 SMS API）
    console.log(`✅ 驗證碼已發送至 ${phone}：${code}`);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ 發送驗證碼錯誤：', err);
    return res.status(500).json({ error: '伺服器錯誤，請稍後再試' });
  }
}
