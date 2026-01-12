import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

// ⏱ 驗證碼有效時間：10 分鐘
const EXPIRE_MS = 10 * 60 * 1000;

// 🔁 重發限制：每 60 秒只能請求一次
const RESEND_COOLDOWN = 60 * 1000;

// 暫存驗證碼（正式建議使用 Redis）
const otpStore = new Map<string, { code: string; expiresAt: number; lastSent: number }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { phone, otp, step, userId } = req.body;
  if (!phone || !step) return res.status(400).json({ error: '缺少必要參數（phone 或 step）' });

  if (step === 'send') {
    const now = Date.now();
    const cached = otpStore.get(phone);
    if (cached && now - cached.lastSent < RESEND_COOLDOWN) {
      const waitSec = Math.ceil((RESEND_COOLDOWN - (now - cached.lastSent)) / 1000);
      return res.status(429).json({ error: `請稍候 ${waitSec} 秒再重試` });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(phone, {
      code,
      expiresAt: now + EXPIRE_MS,
      lastSent: now,
    });

    // 模擬發送（實際應改接 Twilio、Vonage 等 SMS API）
    console.log(`📲 已發送驗證碼 ${code} 至 ${phone}`);
    return res.status(200).json({ message: '驗證碼已發送' });
  }

  if (step === 'verify') {
    if (!otp || !userId) return res.status(400).json({ error: '缺少驗證碼或 userId' });

    const record = otpStore.get(phone);
    if (!record) return res.status(400).json({ error: '驗證碼不存在，請重新發送' });
    if (Date.now() > record.expiresAt) {
      otpStore.delete(phone);
      return res.status(400).json({ error: '驗證碼已過期，請重新發送' });
    }
    if (otp !== record.code) return res.status(400).json({ error: '驗證碼錯誤' });

    // 防止綁定到他人帳號
    const exists = await prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: userId },
      },
    });
    if (exists) return res.status(400).json({ error: '此電話號碼已被其他帳戶綁定' });

    // 綁定成功
    await prisma.user.update({
      where: { id: userId },
      data: { phone },
    });

    otpStore.delete(phone);
    return res.status(200).json({ message: '綁定成功' });
  }

  return res.status(400).json({ error: '無效的 step 參數' });
}
