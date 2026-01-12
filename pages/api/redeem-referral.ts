import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method allowed' });
  }

  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const referrerCode = user.referredBy;
    if (!referrerCode) {
      return res.status(400).json({ error: 'No referral code linked to this user' });
    }

    const referrer = await prisma.user.findUnique({
      where: { referralCode: referrerCode },
    });
    if (!referrer) {
      return res.status(404).json({ error: 'Referrer user not found' });
    }

    const alreadyRewarded = await prisma.referral.findFirst({
      where: {
        refereeId: userId,
        rewarded: true,
      },
    });
    if (alreadyRewarded) {
      return res.status(400).json({ error: 'Referral reward already claimed' });
    }

    const eligibleTopup = await prisma.transaction.findFirst({
      where: {
        userId,
        isFirstTopUp: true,
        amount: { gte: 10 },
      },
    });
    if (!eligibleTopup) {
      return res.status(400).json({ error: 'No eligible first top-up of $10+ found' });
    }

    // ✅ 發放推薦獎勵並建立記錄
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { credits: { increment: 25 } },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { credits: { increment: 25 } },
      }),
      prisma.referral.create({
        data: {
          referrerId: referrer.id,
          refereeId: userId,
          rewarded: true,
          createdAt: new Date(),
        },
      }),
    ]);

    return res.status(200).json({ success: true, message: 'Referral bonus granted' });
  } catch (error) {
    console.error('[Referral Error]', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
