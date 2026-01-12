import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { saveReferenceToLibrary, SavedReference } from '../../lib/referenceLibrary';

/**
 * API端点：自动获取文献全文
 * 
 * 功能：
 * 1. 从OA源自动下载PDF
 * 2. 支持多个OA数据库（Unpaywall, Semantic Scholar, OpenAlex等）
 * 3. 自动保存到本地文献库
 * 4. 返回本地保存的PDF路径
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 辅助函数：下载PDF并保存到本地
  const downloadAndSavePDF = async (pdfUrl: string, referenceId: string, title: string) => {
    try {
      console.log(`开始下载PDF: ${pdfUrl}`);
      
      // 创建uploads目录
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'references');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      // 生成唯一文件名
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileName = `ref_${timestamp}_${randomStr}.pdf`;
      const filePath = path.join(uploadsDir, fileName);
      
      // 下载PDF
      const response = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`下载失败: ${response.status}`);
      }
      
      // 保存到本地
      const buffer = await response.buffer();
      fs.writeFileSync(filePath, buffer);
      
      const fileSize = buffer.length;
      const fileUrl = `/uploads/references/${fileName}`;
      
      console.log(`✅ PDF保存成功: ${fileName} (${fileSize} bytes)`);
      
      return {
        success: true,
        fileName,
        fileUrl,
        fileSize,
        filePath
      };
    } catch (error) {
      console.error(`下载PDF失败:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  };

  try {
    const { doi, title, url, referenceId, authors } = req.body;

    console.log(`开始获取文献全文 - DOI: ${doi}, Title: ${title}, URL: ${url}`);

    // 策略1: 使用Unpaywall查找OA版本
    if (doi) {
      console.log(`[Strategy 1] 尝试从Unpaywall获取OA版本...`);
      try {
        const unpaywallUrl = `https://api.unpaywall.org/v2/${doi}?email=research@example.com`;
        const unpaywallResponse = await fetch(unpaywallUrl);
        
        if (unpaywallResponse.ok) {
          const unpaywallData: any = await unpaywallResponse.json();
          
          // 检查是否有OA版本
          if (unpaywallData.is_oa && unpaywallData.best_oa_location) {
            const pdfUrl = unpaywallData.best_oa_location.url_for_pdf || unpaywallData.best_oa_location.url;
            
            if (pdfUrl) {
              console.log(`✅ Unpaywall找到OA全文: ${pdfUrl}`);
              
              // 自动下载并保存PDF到本地
              const saveResult = await downloadAndSavePDF(pdfUrl, referenceId || `ref_${Date.now()}`, title);
              
              // 保存到文献库
              if (saveResult.success) {
                const libraryEntry: SavedReference = {
                  referenceId: referenceId || `ref_${Date.now()}`,
                  title: title || 'Unknown Title',
                  authors: authors || 'Unknown Authors',
                  source: unpaywallData.journal_name || 'Unknown Source',
                  year: unpaywallData.year || new Date().getFullYear(),
                  doi: doi,
                  url: url,
                  fileName: saveResult.fileName,
                  fileUrl: saveResult.fileUrl,
                  fileSize: saveResult.fileSize,
                  filePath: saveResult.filePath,
                  verified: true,
                  savedAt: new Date().toISOString(),
                  downloadSource: 'Unpaywall'
                };
                
                saveReferenceToLibrary(libraryEntry);
                console.log(`✅ 文献已保存到文献库`);
              }
              
              return res.status(200).json({
                success: true,
                source: 'Unpaywall',
                pdfUrl: pdfUrl,
                downloadable: true,
                message: '成功找到开放获取版本并保存到本地文献库',
                saved: saveResult.success,
                file: saveResult.success ? {
                  url: saveResult.fileUrl,
                  name: saveResult.fileName,
                  size: saveResult.fileSize
                } : null
              });
            }
          }
        }
      } catch (error) {
        console.log(`Unpaywall查询失败:`, error);
      }
    }

    // 策略2: 使用Semantic Scholar查找OA版本
    if (title || doi) {
      console.log(`[Strategy 2] 尝试从Semantic Scholar获取OA版本...`);
      try {
        const query = doi ? `doi:${doi}` : title;
        const semanticUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=openAccessPdf,externalIds,title&limit=1`;
        const semanticResponse = await fetch(semanticUrl);
        
        if (semanticResponse.ok) {
          const semanticData: any = await semanticResponse.json();
          
          if (semanticData.data && semanticData.data.length > 0) {
            const paper = semanticData.data[0];
            
            if (paper.openAccessPdf && paper.openAccessPdf.url) {
              console.log(`✅ Semantic Scholar找到OA全文: ${paper.openAccessPdf.url}`);
              
              // 自动下载并保存PDF到本地
              const saveResult = await downloadAndSavePDF(paper.openAccessPdf.url, referenceId || `ref_${Date.now()}`, title);
              
              // 保存到文献库
              if (saveResult.success) {
                const libraryEntry: SavedReference = {
                  referenceId: referenceId || `ref_${Date.now()}`,
                  title: paper.title || title || 'Unknown Title',
                  authors: authors || 'Unknown Authors',
                  source: 'Semantic Scholar',
                  year: paper.year || new Date().getFullYear(),
                  doi: paper.externalIds?.DOI,
                  url: url,
                  fileName: saveResult.fileName,
                  fileUrl: saveResult.fileUrl,
                  fileSize: saveResult.fileSize,
                  filePath: saveResult.filePath,
                  verified: true,
                  savedAt: new Date().toISOString(),
                  downloadSource: 'Semantic Scholar'
                };
                
                saveReferenceToLibrary(libraryEntry);
                console.log(`✅ 文献已保存到文献库`);
              }
              
              return res.status(200).json({
                success: true,
                source: 'Semantic Scholar',
                pdfUrl: paper.openAccessPdf.url,
                downloadable: true,
                message: '成功找到开放获取版本并保存到本地文献库',
                saved: saveResult.success,
                file: saveResult.success ? {
                  url: saveResult.fileUrl,
                  name: saveResult.fileName,
                  size: saveResult.fileSize
                } : null
              });
            }
          }
        }
      } catch (error) {
        console.log(`Semantic Scholar查询失败:`, error);
      }
    }

    // 策略3: 使用CORE API查找OA版本
    if (title) {
      console.log(`[Strategy 3] 尝试从CORE获取OA版本...`);
      try {
        const coreUrl = `https://core.ac.uk:443/api-v2/search/${encodeURIComponent(title)}?apiKey=demo`;
        const coreResponse = await fetch(coreUrl);
        
        if (coreResponse.ok) {
          const coreData: any = await coreResponse.json();
          
          if (coreData.data && coreData.data.length > 0) {
            const paper = coreData.data[0];
            
            if (paper.downloadUrl) {
              console.log(`✅ CORE找到OA全文: ${paper.downloadUrl}`);
              
              // 自动下载并保存PDF到本地
              const saveResult = await downloadAndSavePDF(paper.downloadUrl, referenceId || `ref_${Date.now()}`, title);
              
              // 保存到文献库
              if (saveResult.success) {
                const libraryEntry: SavedReference = {
                  referenceId: referenceId || `ref_${Date.now()}`,
                  title: paper.title || title || 'Unknown Title',
                  authors: paper.authors?.join(', ') || authors || 'Unknown Authors',
                  source: 'CORE',
                  year: paper.year || new Date().getFullYear(),
                  doi: paper.doi,
                  url: url,
                  fileName: saveResult.fileName,
                  fileUrl: saveResult.fileUrl,
                  fileSize: saveResult.fileSize,
                  filePath: saveResult.filePath,
                  verified: true,
                  savedAt: new Date().toISOString(),
                  downloadSource: 'CORE'
                };
                
                saveReferenceToLibrary(libraryEntry);
                console.log(`✅ 文献已保存到文献库`);
              }
              
              return res.status(200).json({
                success: true,
                source: 'CORE',
                pdfUrl: paper.downloadUrl,
                downloadable: true,
                message: '成功找到开放获取版本并保存到本地文献库',
                saved: saveResult.success,
                file: saveResult.success ? {
                  url: saveResult.fileUrl,
                  name: saveResult.fileName,
                  size: saveResult.fileSize
                } : null
              });
            }
          }
        }
      } catch (error) {
        console.log(`CORE查询失败:`, error);
      }
    }

    // 策略4: 检查arXiv
    if (url && url.includes('arxiv.org')) {
      console.log(`[Strategy 4] 检测到arXiv链接...`);
      const arxivId = url.match(/arxiv\.org\/abs\/([^\s]+)/)?.[1];
      
      if (arxivId) {
        const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
        console.log(`✅ 生成arXiv PDF链接: ${pdfUrl}`);
        
        // 自动下载并保存PDF到本地
        const saveResult = await downloadAndSavePDF(pdfUrl, referenceId || `ref_${Date.now()}`, title);
        
        // 保存到文献库
        if (saveResult.success) {
          const libraryEntry: SavedReference = {
            referenceId: referenceId || `ref_${Date.now()}`,
            title: title || 'Unknown Title',
            authors: authors || 'Unknown Authors',
            source: 'arXiv',
            year: new Date().getFullYear(),
            url: url,
            fileName: saveResult.fileName,
            fileUrl: saveResult.fileUrl,
            fileSize: saveResult.fileSize,
            filePath: saveResult.filePath,
            verified: true,
            savedAt: new Date().toISOString(),
            downloadSource: 'arXiv'
          };
          
          saveReferenceToLibrary(libraryEntry);
          console.log(`✅ 文献已保存到文献库`);
        }
        
        return res.status(200).json({
          success: true,
          source: 'arXiv',
          pdfUrl: pdfUrl,
          downloadable: true,
          message: '成功找到arXiv全文并保存到本地文献库',
          saved: saveResult.success,
          file: saveResult.success ? {
            url: saveResult.fileUrl,
            name: saveResult.fileName,
            size: saveResult.fileSize
          } : null
        });
      }
    }

    // 如果所有策略都失败
    console.log(`❌ 未找到可下载的OA全文`);
    return res.status(404).json({
      success: false,
      message: '未找到开放获取版本，请尝试手动上传',
      suggestions: [
        '检查作者个人网站或机构仓库',
        '尝试ResearchGate或Academia.edu',
        '联系作者请求全文',
        '手动上传PDF文件'
      ]
    });

  } catch (error) {
    console.error('获取全文时发生错误:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: '获取全文失败，请稍后重试'
    });
  }
}

