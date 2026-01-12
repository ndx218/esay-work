// /pages/api/apply-referral-code.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { userId, referralCode } = req.body;

  if (!userId || typeof userId !== 'string' || !referralCode || typeof referralCode !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId or referralCode' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.referredBy) {
      return res.status(400).json({ error: 'Referral code already applied' });
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (!referrer) {
      return res.status(404).json({ error: 'Invalid referral code' });
    }

    if (referrer.id === user.id) {
      return res.status(400).json({ error: 'You cannot refer yourself' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        referredBy: referralCode,
      },
    });

    return res.status(200).json({ success: true, message: 'Referral code applied successfully' });
  } catch (err) {
    console.error('[Apply Referral Error]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
