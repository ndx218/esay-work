// /pages/api/test-outline.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, wordCount, language, tone, detail, reference, rubric, paragraph, mode } = req.body;

    // 生成更具體、更有實質內容的大綱
    const outline = {
      title: title || "人工智能技術發展與應用研究",
      sections: [
        {
          id: 1,
          title: "引言",
          content: "人工智能（AI）作為當代科技發展的核心驅動力，正在深刻改變我們的生活方式和工作模式。根據麥肯錫全球研究院的報告，到2030年，AI技術將為全球經濟貢獻13萬億美元的增長。",
          wordCount: 140,
          bulletPoints: [
            "AI的定義：能夠執行通常需要人類智能的任務的計算機系統",
            "發展現狀：2023年全球AI市場規模達到1360億美元，年增長率23%",
            "社會影響：預計到2025年，AI將影響全球47%的工作崗位"
          ]
        },
        {
          id: 2,
          title: "AI技術原理與核心概念",
          content: "AI技術的核心在於機器學習和深度學習算法，這些算法通過分析大量數據來識別模式和規律。以GPT-4為例，其擁有1750億個參數，訓練數據量達到45TB。",
          wordCount: 240,
          bulletPoints: [
            "機器學習原理：監督學習、無監督學習、強化學習三種主要方法",
            "深度學習架構：CNN用於圖像識別，RNN用於序列數據，Transformer用於自然語言處理",
            "神經網絡優化：Adam優化器、批量歸一化、Dropout等技術的具體應用",
            "硬件加速：GPU計算能力提升1000倍，TPU專用芯片效率提升15倍"
          ]
        },
        {
          id: 3,
          title: "AI的實際應用與案例分析",
          content: "AI技術在商業領域的應用已經產生了深遠影響，從金融科技到醫療健康，再到教育領域。具體案例包括：螞蟻金服的風險評估系統準確率達到95%，比傳統方法提升20%。",
          wordCount: 240,
          bulletPoints: [
            "金融科技：螞蟻金服AI風控系統處理能力達到每秒10萬筆交易",
            "醫療健康：Google DeepMind的AlphaFold2預測蛋白質結構準確率達到92%",
            "教育領域：可汗學院的AI輔導系統幫助學生學習效率提升30%",
            "製造業：西門子AI質檢系統缺陷檢測準確率達到99.5%"
          ]
        },
        {
          id: 4,
          title: "AI發展挑戰與未來展望",
          content: "當前AI技術面臨的主要挑戰包括數據質量、計算資源和可解釋性三個方面。根據斯坦福大學AI指數報告，訓練大型語言模型的成本從2019年的43萬美元增加到2023年的200萬美元。",
          wordCount: 240,
          bulletPoints: [
            "數據質量挑戰：標註數據成本高昂，人工標註1小時視頻需要4-6小時",
            "計算資源問題：GPT-4訓練消耗電力相當於120個美國家庭一年的用電量",
            "可解釋性難題：深度學習模型決策過程難以理解，影響醫療等關鍵領域應用",
            "未來突破方向：量子計算、神經形態芯片、聯邦學習等新技術的發展前景"
          ]
        },
        {
          id: 5,
          title: "結論",
          content: "AI技術憑藉其強大的數據處理能力和模式識別能力，在效率提升和功能擴展方面展現出巨大優勢。根據預測，到2030年AI將為全球GDP貢獻15.7萬億美元。",
          wordCount: 140,
          bulletPoints: [
            "技術優勢：AI在圖像識別、自然語言處理等任務上已超越人類水平",
            "應用潛力：預計未來5年內，AI將在80%的企業中得到廣泛應用",
            "社會責任：需要建立AI倫理框架，確保技術發展與社會價值平衡",
            "發展建議：加大基礎研究投入，建立國際合作機制，推動AI技術健康發展"
          ]
        }
      ]
    };

    res.status(200).json({ outline });
  } catch (error) {
    console.error('生成大綱時發生錯誤:', error);
    res.status(500).json({ error: '生成大綱失敗' });
  }
}
