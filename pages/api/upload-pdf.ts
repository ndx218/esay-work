import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

type UploadResponse =
  | { success: true; fileUrl: string; fileName: string; fileSize: number }
  | { success: false; message: string };

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '30mb',
    },
  },
};

const sanitizeFileName = (name: string): string => {
  return name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 160) || 'file.pdf';
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { fileName, fileData } = req.body ?? {};

  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ success: false, message: '缺少檔案名稱' });
  }

  if (!fileData || typeof fileData !== 'string') {
    return res.status(400).json({ success: false, message: '缺少檔案內容' });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const safeName = sanitizeFileName(fileName);
    const filePath = path.join(uploadsDir, `${Date.now()}-${safeName}`);

    await fs.promises.writeFile(filePath, buffer);

    const publicPath = filePath.replace(path.join(process.cwd(), 'public'), '').replace(/\\/g, '/');

    return res.status(200).json({
      success: true,
      fileUrl: publicPath,
      fileName: safeName,
      fileSize: buffer.length,
    });
  } catch (error) {
    console.error('[upload-pdf] 保存檔案失敗', error);
    return res.status(500).json({ success: false, message: 'PDF 上傳失敗，請稍後再試。' });
  }
}
