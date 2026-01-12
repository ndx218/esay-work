'use client';

import { useState, useEffect } from 'react';

export interface ParagraphPlan {
  intro: number;
  bodyCount: number;
  body: number[];
  conclusion: number;
  bodyTitles: string[];
}

interface ParagraphPlannerProps {
  totalWords: number;
  value: ParagraphPlan;
  onChange: (plan: ParagraphPlan) => void;
  language: string;
}

export default function ParagraphPlanner({
  totalWords,
  value,
  onChange,
  language
}: ParagraphPlannerProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 当总字数或主体段数改变 → 自动按比例分配
  useEffect(() => {
    if (!totalWords || value.bodyCount <= 0) return;

    const intro = Math.max(50, Math.round((totalWords * 0.14) / 10) * 10);
    const concl = Math.max(50, Math.round((totalWords * 0.14) / 10) * 10);
    const remain = Math.max(0, totalWords - intro - concl);
    const per = Math.max(50, Math.round(remain / value.bodyCount / 10) * 10);

    onChange({
      ...value,
      intro,
      conclusion: concl,
      body: Array.from({ length: value.bodyCount }, () => per),
      bodyTitles: Array.from({ length: value.bodyCount }, (_, i) => value.bodyTitles?.[i] ?? ""),
    });
  }, [totalWords, value.bodyCount]);

  const updateBodyCount = (newCount: number) => {
    if (newCount < 1 || newCount > 10) return;
    
    const newBody = Array.from({ length: newCount }, (_, i) => 
      value.body[i] || Math.round((totalWords * 0.72) / newCount / 10) * 10
    );
    const newTitles = Array.from({ length: newCount }, (_, i) => 
      value.bodyTitles[i] || ""
    );

    onChange({
      ...value,
      bodyCount: newCount,
      body: newBody,
      bodyTitles: newTitles,
    });
  };

  const updateBodyWords = (index: number, words: number) => {
    const newBody = [...value.body];
    newBody[index] = Math.max(50, words);
    onChange({ ...value, body: newBody });
  };

  const updateBodyTitle = (index: number, title: string) => {
    const newTitles = [...value.bodyTitles];
    newTitles[index] = title;
    onChange({ ...value, bodyTitles: newTitles });
  };

  const totalCurrent = value.intro + value.body.reduce((sum, w) => sum + w, 0) + value.conclusion;
  const isConsistent = Math.abs(totalCurrent - totalWords) <= 10;

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">② 段落規劃器</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-2 py-1 text-sm bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
        >
          {isCollapsed ? '展开' : '收起'}
        </button>
      </div>

      {!isCollapsed && (
        <div className="space-y-4">
          {/* 引言 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              引言字數
            </label>
            <input
              type="number"
              value={value.intro}
              onChange={(e) => onChange({ ...value, intro: Math.max(50, parseInt(e.target.value) || 0) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="50"
            />
          </div>

          {/* 主体段落数量 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              主體段數
            </label>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => updateBodyCount(value.bodyCount - 1)}
                disabled={value.bodyCount <= 1}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                -
              </button>
              <span className="px-4 py-2 bg-white border border-gray-300 rounded min-w-[60px] text-center">
                {value.bodyCount}
              </span>
              <button
                onClick={() => updateBodyCount(value.bodyCount + 1)}
                disabled={value.bodyCount >= 10}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
          </div>

          {/* 主体段落 */}
          {value.body.map((words, index) => (
            <div key={index} className="border-l-4 border-blue-200 pl-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                主體段{index + 1}標題 (選填)
              </label>
              <input
                type="text"
                value={value.bodyTitles[index] || ''}
                onChange={(e) => updateBodyTitle(index, e.target.value)}
                placeholder="例如: 定義與範疇"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">
                字數
              </label>
              <input
                type="number"
                value={words}
                onChange={(e) => updateBodyWords(index, parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="50"
              />
            </div>
          ))}

          {/* 结论 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              結論字數
            </label>
            <input
              type="number"
              value={value.conclusion}
              onChange={(e) => onChange({ ...value, conclusion: Math.max(50, parseInt(e.target.value) || 0) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="50"
            />
          </div>

          {/* 统计信息 */}
          <div className="p-3 bg-white border rounded-md">
            <div className="text-sm text-gray-600">
              目前合計: {totalCurrent} / 建議: {isConsistent ? '總字數與目標一致' : '總字數與目標不一致'}
            </div>
            {!isConsistent && (
              <div className="mt-2 text-xs text-red-500">
                目標: {totalWords} 字
              </div>
            )}
          </div>

          {/* 快捷操作 */}
          <div className="flex space-x-2">
            <button
              onClick={() => {
                if (!totalWords) return;
                const intro = Math.max(50, Math.round((totalWords * 0.14) / 10) * 10);
                const concl = Math.max(50, Math.round((totalWords * 0.14) / 10) * 10);
                const remain = Math.max(0, totalWords - intro - concl);
                const per = Math.max(50, Math.round(remain / value.bodyCount / 10) * 10);
                
                onChange({
                  ...value,
                  intro,
                  conclusion: concl,
                  body: Array.from({ length: value.bodyCount }, () => per),
                });
              }}
              className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              按比例自動分配
            </button>
            <button
              onClick={() => {
                if (!totalWords) return;
                const intro = Math.max(50, Math.round((totalWords * 0.14) / 10) * 10);
                const concl = Math.max(50, Math.round((totalWords * 0.14) / 10) * 10);
                const remain = Math.max(0, totalWords - intro - concl);
                const per = Math.max(50, Math.round(remain / value.bodyCount / 10) * 10);
                
                onChange({
                  ...value,
                  intro,
                  conclusion: concl,
                  body: Array.from({ length: value.bodyCount }, () => per),
                });
              }}
              className="px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              主體平均
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
