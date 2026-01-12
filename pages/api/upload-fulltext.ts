import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { saveReferenceToLibrary, SavedReference } from '../../lib/referenceLibrary';

// 禁用Next.js的默认body解析，使用formidable处理multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * API端点：手动上传文献PDF
 * 
 * 功能：
 * 1. 接收用户上传的PDF文件
 * 2. 保存到本地存储
 * 3. 提取PDF文本内容（可选）
 * 4. 返回文件信息
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 创建uploads目录（如果不存在）
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'references');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 使用formidable解析上传的文件
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      filename: (name, ext, part) => {
        // 生成唯一文件名
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        return `ref_${timestamp}_${randomStr}${ext}`;
      },
    });

    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    console.log('收到上传请求 - Fields:', fields);
    console.log('收到上传请求 - Files:', files);

    // 获取上传的PDF文件
    const pdfFile = Array.isArray(files.pdf) ? files.pdf[0] : files.pdf;
    
    if (!pdfFile) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: '未找到上传的PDF文件'
      });
    }

    // 验证文件类型
    const fileExtension = path.extname(pdfFile.originalFilename || '').toLowerCase();
    if (fileExtension !== '.pdf') {
      // 删除非PDF文件
      fs.unlinkSync(pdfFile.filepath);
      return res.status(400).json({
        success: false,
        error: 'Invalid file type',
        message: '只支持PDF文件格式'
      });
    }

    // 获取文献元数据
    const referenceId = Array.isArray(fields.referenceId) ? fields.referenceId[0] : fields.referenceId;
    const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
    const authors = Array.isArray(fields.authors) ? fields.authors[0] : fields.authors;

    // 生成可访问的URL
    const fileName = path.basename(pdfFile.filepath);
    const fileUrl = `/uploads/references/${fileName}`;
    const fileSize = pdfFile.size;

    console.log(`✅ PDF上传成功: ${fileName} (${fileSize} bytes)`);

    // 保存到文献库
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'references', fileName);
    const libraryEntry: SavedReference = {
      referenceId: referenceId || `ref_${Date.now()}`,
      title: title || 'Unknown Title',
      authors: authors || 'Unknown Authors',
      source: 'Manual Upload',
      year: new Date().getFullYear(),
      fileName: fileName,
      fileUrl: fileUrl,
      fileSize: fileSize,
      filePath: absolutePath,
      verified: true,
      savedAt: new Date().toISOString(),
      downloadSource: 'Manual Upload'
    };
    
    saveReferenceToLibrary(libraryEntry);
    console.log(`✅ 文献已保存到文献库`);

    return res.status(200).json({
      success: true,
      message: 'PDF上传成功并保存到文献库',
      data: libraryEntry,
      file: {
        url: fileUrl,
        name: fileName,
        size: fileSize,
        type: 'application/pdf'
      }
    });

  } catch (error) {
    console.error('上传文件时发生错误:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '上传失败，请稍后重试'
    });
  }
}

