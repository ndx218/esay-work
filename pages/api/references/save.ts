// pages/api/references/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCost } from '@/lib/points';

type Item = {
  sectionKey: string;
  title: string;
  url: string;
  doi?: string | null;
  source?: string | null;
  authors?: string | null;
  publishedAt?: string | null | Date;
  type?: string | null;
  credibility?: number | null;
  summary?: string | null;
};

type Res =
  | { error: string }
  | { spent: number; remainingCredits: number; saved: any[] };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Res>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只接受 POST 請求' });
  }

  const session = await getAuthSession(req, res);
  if (!session?.user?.id) {
    return res.status(401).json({ error: '尚未登入，請先登入再操作' });
  }

  const userId = session.user.id;
  const { outlineId, items, mode = 'web' } = req.body as {
    outlineId?: string;
    items?: Item[];
    mode?: string;
  };

  if (!outlineId || !Array.isArray(items) || items.length < 1 || items.length > 3) {
    return res.status(400).json({ error: '請提供 1~3 筆有效的參考文獻' });
  }

  // 確認 outline 存在且屬於 user
  const outline = await prisma.outline.findFirst({ where: { id: outlineId, userId } });
  if (!outline) {
    return res.status(404).json({ error: '找不到對應的大綱，請重新產生後再試' });
  }

  // 計算費用
  const spent = Number(getCost('refs', mode) ?? 1) || 1;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 扣點
      const me = await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: spent } },
        select: { credits: true },
      });

      const saved: any[] = [];
      for (const it of items) {
        // URL 必要
        if (!it.url || typeof it.url !== 'string') continue;
        
        // 額外驗證：檢查是否為虛假引用
        if (!isValidReferenceForSaving(it)) continue;

        // 檢查重複：outline+section+url OR 全域 doi
        const orConditions: any[] = [
          { outlineId, sectionKey: it.sectionKey, url: it.url }
        ];
        if (it.doi) {
          orConditions.push({ doi: it.doi });
        }
        const exists = await tx.reference.findFirst({ where: { OR: orConditions } });
        if (exists) continue;

        try {
          const rec = await tx.reference.create({
            data: {
              userId,
              outlineId,
              sectionKey: it.sectionKey,
              title: it.title.slice(0, 512),
              url: it.url,
              doi: it.doi ?? null,
              source: it.source ?? null,
              authors: it.authors ?? null,
              publishedAt: it.publishedAt ? new Date(it.publishedAt as any) : null,
              type: it.type ?? 'OTHER',
              summary: it.summary ?? null,
              credibility: typeof it.credibility === 'number' ? it.credibility : 0,
            },
          });
          saved.push(rec);
        } catch (e: any) {
          // 如果是 doi 重複，跳過
          if (e.code === 'P2002' && e.meta?.target?.includes('doi')) {
            console.warn('跳過重複 DOI', it.doi);
            continue;
          }
          throw e;
        }
      }

      // 紀錄交易，只為實際儲存數量扣點
      await tx.transaction.create({
        data: {
          userId,
          amount: -saved.length * spent,
          type: 'USAGE',
          description: `段落參考文獻加入（${saved.length} 筆）`,
          performedBy: userId,
        },
      });

      return { remainingCredits: me.credits, saved };
    });

    return res.status(200).json({
      spent,
      remainingCredits: result.remainingCredits,
      saved: result.saved,
    });
  } catch (err: any) {
    console.error('❌ 儲存失敗 [refs/save]', err);
    return res.status(500).json({ error: '儲存失敗：' + (err.message || '未知錯誤') });
  }
}

// 驗證引用是否適合保存
function isValidReferenceForSaving(item: any): boolean {
  // 檢查基本字段
  if (!item.title || item.title.trim().length < 5) return false;
  if (!item.url || item.url.trim().length < 10) return false;
  
  // 檢查是否為虛假生成的引用
  const title = item.title.toLowerCase();
  const suspiciousPatterns = [
    '建議研究方向',
    'suggested research direction',
    '文獻：相關研究',
    'database research',
    '相關研究文獻',
    'related research literature',
    'llm (suggested)',
    'ai建議'
  ];
  
  // 如果標題包含可疑模式，視為虛假引用
  if (suspiciousPatterns.some(pattern => title.includes(pattern))) {
    return false;
  }
  
  // 檢查作者字段是否為虛假
  if (item.authors) {
    const authors = item.authors.toLowerCase();
    const suspiciousAuthors = ['研究員', 'researcher', 'database', '數據庫', 'llm'];
    if (suspiciousAuthors.some(pattern => authors.includes(pattern))) {
      return false;
    }
  }
  
  // 檢查URL是否為搜索頁面而非具體文章
  const url = item.url.toLowerCase();
  const searchPatterns = ['/search?', '/search/', '?q=', '&q='];
  if (searchPatterns.some(pattern => url.includes(pattern))) {
    return false;
  }
  
  return true;
}
