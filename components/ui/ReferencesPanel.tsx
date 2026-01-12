"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ReferenceItem, CitationFormat } from "@/types/references";
import { formatCitation } from "@/types/references";
import { ReferenceSettings, type ReferenceSettings as ReferenceSettingsType } from "./ReferenceSettings";

export type ReferencesPanelProps = {
  outlineId: string;
  loading: boolean;
  references: ReferenceItem[];
  onGenerate: () => Promise<void> | void;
  onRefresh: () => Promise<void> | void;
  onExport: () => void;
  onSettingsChange?: (settings: ReferenceSettingsType) => void;
};

export function ReferencesPanel({
  outlineId,
  loading,
  references,
  onGenerate,
  onRefresh,
  onExport,
  onSettingsChange,
}: ReferencesPanelProps) {
  const [settings, setSettings] = useState<ReferenceSettingsType>({
    documentTypes: ["journal", "book", "conference"],
    citationFormat: "apa7",
    region: "global",
    language: "en",
    yearRange: {
      from: 2010,
      to: new Date().getFullYear(),
    },
    sources: ["crossref", "semanticscholar"],
  });

  const handleSettingsChange = (newSettings: ReferenceSettingsType) => {
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  const handleApplySettings = () => {
    // 应用设置后重新生成参考文献
    onGenerate();
  };
  return (
    <div className="mt-4 border-t pt-3">
      {/* 参考文献设置 */}
      <div className="mb-4">
        <ReferenceSettings
          settings={settings}
          onSettingsChange={handleSettingsChange}
          onApply={handleApplySettings}
          loading={loading}
        />
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-semibold">🔗 參考文獻</h4>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading} onClick={() => onRefresh()}>
            重新整理
          </Button>
          <Button className="bg-purple-600 text-white" disabled={loading} onClick={() => onGenerate()}>
            {loading ? "產生中…" : "產生參考文獻"}
          </Button>
          <Button variant="outline" onClick={onExport}>
            匯出 TXT
          </Button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-1">
        Outline ID：<span className="font-mono">{outlineId}</span>
      </p>

      {/* 显示当前设置摘要 */}
      <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
        <strong>当前设置：</strong>
        格式: {settings.citationFormat.toUpperCase()} | 
        类型: {settings.documentTypes.join(', ')} | 
        地区: {settings.region} | 
        语言: {settings.language} | 
        年份: {settings.yearRange.from}-{settings.yearRange.to}
      </div>

      {references.length === 0 ? (
        <p className="text-sm text-gray-500 mt-3">尚未有參考文獻。</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {references.map((r) => (
            <li key={`${r.sectionKey}-${r.url}`} className="break-all">
              <span className="font-medium">{r.sectionKey}</span> · {formatCitation(r, settings.citationFormat as CitationFormat)}{" "}
              <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                link
              </a>
              {typeof r.credibility === "number" ? (
                <span className="ml-2 text-xs text-gray-500">可信度 {r.credibility}/100</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
