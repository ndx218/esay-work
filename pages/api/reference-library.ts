import type { NextApiRequest, NextApiResponse } from 'next';
import { loadReferenceLibrary, getLibraryStats, findReferenceById, searchReferencesInLibrary } from '../../lib/referenceLibrary';

/**
 * API端点：文献库管理
 * 
 * 支持的操作：
 * - GET: 获取所有文献或搜索文献
 * - POST: 查询单个文献
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === 'GET') {
      const { search } = req.query;
      
      if (search && typeof search === 'string') {
        // 搜索文献
        const results = searchReferencesInLibrary(search);
        return res.status(200).json({
          success: true,
          data: results,
          count: results.length
        });
      } else {
        // 获取所有文献
        const library = loadReferenceLibrary();
        const stats = getLibraryStats();
        
        return res.status(200).json({
          success: true,
          data: library,
          stats: stats
        });
      }
    } else if (req.method === 'POST') {
      const { referenceId } = req.body;
      
      if (!referenceId) {
        return res.status(400).json({
          success: false,
          error: 'Missing referenceId'
        });
      }
      
      // 查找单个文献
      const reference = findReferenceById(referenceId);
      
      if (reference) {
        return res.status(200).json({
          success: true,
          data: reference
        });
      } else {
        return res.status(404).json({
          success: false,
          error: 'Reference not found'
        });
      }
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('文献库操作失败:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

