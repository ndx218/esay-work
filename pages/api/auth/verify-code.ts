import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma'; // 关键修改：使用命名导入
import { serialize } from 'cookie';
import { sign } from 'jsonwebtoken';

// 确保您的 NEXTAUTH_SECRET 在 .env.local 中定义
const JWT_SECRET = process.env.NEXTAUTH_SECRET;

if (!JWT_SECRET) {
  // 在生产环境中，如果缺少密钥，应直接阻止应用启动
  console.error('Environment variable NEXTAUTH_SECRET is not defined. This is crucial for JWT signing.');
  // 可以选择抛出错误，或者返回一个错误响应来处理这种情况
  // throw new Error('NEXTAUTH_SECRET is not defined.');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ message: 'Phone and code are required.' });
  }

  // 再次检查 JWT_SECRET，以防在其他环境中运行而未抛出错误
  if (!JWT_SECRET) {
    return res.status(500).json({ message: 'Server configuration error: NEXTAUTH_SECRET is missing.' });
  }

  try {
    // 1. 验证验证码
    const verificationCode = await prisma.verificationCode.findUnique({
      where: { phone },
    });

    if (!verificationCode || verificationCode.code !== code) {
      return res.status(401).json({ message: 'Invalid or expired verification code.' });
    }

    // 可选：删除已使用的验证码，防止重复使用
    await prisma.verificationCode.delete({
      where: { phone },
    });

    // 2. 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      // 用户不存在，创建新用户
      user = await prisma.user.create({
        data: {
          phone,
          // 如果您希望新注册用户有默认的积分或推荐码，可以在这里设置
          credits: 0,
          // name: '新用户', // 示例：可以设置一个默认名称
          // email: `${phone}@example.com`, // 示例：如果需要唯一邮箱，可以生成一个
          // referralCode: 'generate_a_unique_code_here', // 示例：生成一个
        },
      });
    }

    // 3. 生成 Session Token 并创建 Session 记录
    // 这里我们使用 `jsonwebtoken` 来生成一个 JWT 作为 sessionToken 的值。
    // 这与 NextAuth.js 内部在 JWT 会话策略下的行为类似，并确保 `sessionToken` 是唯一的。
    const sessionTokenValue = sign(
      { userId: user.id, phone: user.phone }, // JWT Payload
      JWT_SECRET, // 签名密钥
      { expiresIn: '30d' } // Token 有效期
    );

    // 计算 Session 的过期时间 (当前时间 + 30天)
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    // 在 Prisma Session 表中创建记录
    await prisma.session.create({
      data: {
        sessionToken: sessionTokenValue, // 关键：使用正确的字段名
        userId: user.id,
        expires: expiresAt, // 关键：提供 expires 字段
      },
    });

    // 4. 设置 HttpOnly Cookie
    // NextAuth.js 的默认 cookie 名称是 'next-auth.session-token'
    res.setHeader('Set-Cookie', serialize('next-auth.session-token', sessionTokenValue, {
      httpOnly: true, // 防止客户端 JavaScript 访问
      secure: process.env.NODE_ENV === 'production', // 仅在生产环境使用 HTTPS
      maxAge: 60 * 60 * 24 * 30, // 30 天，与 session expires 匹配
      path: '/', // cookie 对所有路径都有效
      sameSite: 'Lax', // 推荐使用 Lax 或 Strict 以防止 CSRF 攻击
    }));

    // 5. 返回成功响应和用户信息
    return res.status(200).json({ message: 'Login successful', user });

  } catch (error) {
    console.error('Login error:', error);
    // 根据错误的具体类型，可以返回更详细的错误信息
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}
