/**
 * 文献库管理系统
 * 
 * 功能：
 * 1. 保存文献元数据到本地JSON文件
 * 2. 检索已保存的文献
 * 3. 管理文献PDF文件
 */

import fs from 'fs';
import path from 'path';

export interface SavedReference {
  referenceId: string;
  title: string;
  authors: string;
  source: string;
  year: number;
  doi?: string;
  url?: string;
  
  // 文件信息
  fileName: string;
  fileUrl: string;
  fileSize: number;
  filePath: string;
  
  // 元数据
  abstract?: string;
  chineseSummary?: string;
  verified: boolean;
  abstractLength?: number;
  
  // 时间戳
  savedAt: string;
  downloadSource?: string; // 'Unpaywall' | 'Semantic Scholar' | 'CORE' | 'arXiv' | 'Manual Upload'
}

// 获取文献库数据文件路径
const getLibraryFilePath = (): string => {
  const libraryDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(libraryDir)) {
    fs.mkdirSync(libraryDir, { recursive: true });
  }
  return path.join(libraryDir, 'reference-library.json');
};

// 读取文献库
export const loadReferenceLibrary = (): SavedReference[] => {
  const filePath = getLibraryFilePath();
  
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('读取文献库失败:', error);
  }
  
  return [];
};

// 保存文献到库
export const saveReferenceToLibrary = (reference: SavedReference): boolean => {
  try {
    const library = loadReferenceLibrary();
    
    // 检查是否已存在
    const existingIndex = library.findIndex(ref => ref.referenceId === reference.referenceId);
    
    if (existingIndex >= 0) {
      // 更新现有文献
      library[existingIndex] = reference;
      console.log(`更新文献库中的文献: ${reference.title}`);
    } else {
      // 添加新文献
      library.push(reference);
      console.log(`添加新文献到库: ${reference.title}`);
    }
    
    // 保存到文件
    const filePath = getLibraryFilePath();
    fs.writeFileSync(filePath, JSON.stringify(library, null, 2), 'utf-8');
    
    console.log(`✅ 文献已保存到库，当前共 ${library.length} 篇文献`);
    return true;
  } catch (error) {
    console.error('保存文献到库失败:', error);
    return false;
  }
};

// 根据ID查找文献
export const findReferenceById = (referenceId: string): SavedReference | null => {
  const library = loadReferenceLibrary();
  return library.find(ref => ref.referenceId === referenceId) || null;
};

// 搜索文献（根据标题或作者）
export const searchReferencesInLibrary = (query: string): SavedReference[] => {
  const library = loadReferenceLibrary();
  const lowerQuery = query.toLowerCase();
  
  return library.filter(ref => 
    ref.title.toLowerCase().includes(lowerQuery) ||
    ref.authors.toLowerCase().includes(lowerQuery)
  );
};

// 获取文献库统计信息
export const getLibraryStats = () => {
  const library = loadReferenceLibrary();
  
  const totalSize = library.reduce((sum, ref) => sum + ref.fileSize, 0);
  const verifiedCount = library.filter(ref => ref.verified).length;
  const sourceStats = library.reduce((stats, ref) => {
    const source = ref.downloadSource || 'Unknown';
    stats[source] = (stats[source] || 0) + 1;
    return stats;
  }, {} as { [key: string]: number });
  
  return {
    totalCount: library.length,
    totalSize,
    verifiedCount,
    sourceStats
  };
};

// 删除文献
export const deleteReferenceFromLibrary = (referenceId: string): boolean => {
  try {
    const library = loadReferenceLibrary();
    const index = library.findIndex(ref => ref.referenceId === referenceId);
    
    if (index >= 0) {
      const reference = library[index];
      
      // 删除PDF文件
      if (reference.filePath && fs.existsSync(reference.filePath)) {
        fs.unlinkSync(reference.filePath);
        console.log(`删除PDF文件: ${reference.fileName}`);
      }
      
      // 从库中移除
      library.splice(index, 1);
      
      // 保存
      const filePath = getLibraryFilePath();
      fs.writeFileSync(filePath, JSON.stringify(library, null, 2), 'utf-8');
      
      console.log(`✅ 文献已从库中删除: ${reference.title}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('删除文献失败:', error);
    return false;
  }
};

