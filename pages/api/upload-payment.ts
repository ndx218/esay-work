// ✅ /pages/api/upload-payment.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '@/lib/prisma';

export const config = {
  api: {
    bodyParser: false, // 禁用 Next.js 自帶 body parser，因為要用 formidable
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  // 配置 Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const form = new IncomingForm({ keepExtensions: true });

  try {
    const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error('[❌ 表單解析錯誤]', err);
          return reject(err);
        }
        resolve({ fields, files });
      });
    });

    const name = fields.name?.toString() || '';
    const phone = fields.phone?.toString() || '';
    const referralCode = fields.referralCode?.toString() || '';
    const screenshot = files.screenshot as File;

    if (!name || !phone || !screenshot) {
      return res.status(400).json({ error: '請填寫所有必填欄位' });
    }

    // ✅ 上傳檔案到 Cloudinary
    const result = await cloudinary.uploader.upload(screenshot.filepath, {
      folder: 'recharge_screenshots',
      public_id: `${Date.now()}_${screenshot.originalFilename || 'screenshot'}`,
    });

    // ✅ 儲存進資料庫
    await prisma.topUpSubmission.create({
      data: {
        name,
        phone,
        referralCode,
        imageUrl: result.secure_url,
        createdAt: new Date(),
      },
    });

    console.log('[📤 新付款上傳]', {
      name,
      phone,
      referralCode,
      imageUrl: result.secure_url,
    });

    return res.status(200).json({ message: '上傳成功', imageUrl: result.secure_url });
  } catch (error) {
    console.error('[❌ 儲存錯誤]', error);
    return res.status(500).json({ error: '儲存失敗，請稍後再試' });
  }
}
