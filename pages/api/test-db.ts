// /pages/api/test-db.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // 試著查詢 User 表（如果你有一筆資料會列出，沒有也能成功）
    const users = await prisma.user.findMany();

    res.status(200).json({
      message: '✅ 成功連接資料庫！',
      users,
    });
  } catch (error) {
    console.error('[Test DB Error]', error);
    res.status(500).json({
      message: '❌ 資料庫連接失敗',
      error: error instanceof Error ? error.message : error,
    });
  }
}
