import type { NextApiRequest, NextApiResponse } from 'next';
// 推荐从统一的 lib/prisma 文件导入单例 Prisma 客户端
import { prisma } from '@/lib/prisma'; // 假设 '@/lib/prisma' 导出了一个命名为 'prisma' 的实例
import { getTokenFromCookie } from '@/lib/auth-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 确保请求方法是 GET，或者您期望的其他方法
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const cookieHeader = req.headers.cookie || '';
  const sessionToken = getTokenFromCookie(cookieHeader); // 关键：获取的是 sessionToken，而不是旧的 token

  if (!sessionToken) {
    return res.status(401).json({ error: '未登入 (No session token found)' });
  }

  try {
    const session = await prisma.session.findUnique({
      // 关键修改：将 where 条件从 'token' 改为 'sessionToken'
      where: { sessionToken: sessionToken },
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            credits: true,
            createdAt: true,
            // 如果您的 User 模型中还有其他需要在 /me 接口返回的字段，请在这里添加
            // 例如：
            name: true,
            email: true,
            image: true,
            referredBy: true,
            referralCode: true,
            updatedAt: true,
          },
        },
      },
    });

    // 检查会话是否存在且未过期
    if (!session || !session.user || session.expires < new Date()) {
      return res.status(401).json({ error: '無效或已過期的登入憑證 (Invalid or expired session)' });
    }

    return res.status(200).json({ user: session.user });
  } catch (err) {
    console.error('[Me API Error]', err);
    // 生产环境中避免暴露过多错误细节
    return res.status(500).json({ error: '伺服器錯誤 (Internal server error)' });
  }
}
