"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";

export interface ReferenceSettings {
  // 文献类型
  documentTypes: string[];
  // 引用格式
  citationFormat: string;
  // 地区语言
  region: string;
  language: string;
  // 年份范围
  yearRange: {
    from: number;
    to: number;
  };
  // 数据库来源
  sources: string[];
}

export interface ReferenceSettingsProps {
  settings: ReferenceSettings;
  onSettingsChange: (settings: ReferenceSettings) => void;
  onApply: () => void;
  loading?: boolean;
}

const DOCUMENT_TYPES = [
  { value: "journal", label: "期刊文章", icon: "📄" },
  { value: "book", label: "书籍", icon: "📚" },
  { value: "newspaper", label: "报纸文章", icon: "📰" },
  { value: "website", label: "网站", icon: "🌐" },
  { value: "conference", label: "会议论文", icon: "🎤" },
  { value: "thesis", label: "学位论文", icon: "🎓" },
  { value: "report", label: "报告", icon: "📊" },
  { value: "patent", label: "专利", icon: "⚗️" },
];

const CITATION_FORMATS = [
  { value: "apa7", label: "APA 7th Edition", description: "美国心理学会第7版" },
  { value: "apa6", label: "APA 6th Edition", description: "美国心理学会第6版" },
  { value: "mla9", label: "MLA 9th Edition", description: "现代语言学会第9版" },
  { value: "chicago", label: "Chicago Style", description: "芝加哥格式" },
  { value: "harvard", label: "Harvard Style", description: "哈佛格式" },
  { value: "ieee", label: "IEEE Style", description: "电气电子工程师学会" },
  { value: "vancouver", label: "Vancouver Style", description: "温哥华格式" },
  { value: "cbe", label: "CBE Style", description: "生物科学编辑委员会" },
];

const REGIONS = [
  { value: "global", label: "全球", flag: "🌍" },
  { value: "north-america", label: "北美", flag: "🇺🇸" },
  { value: "europe", label: "欧洲", flag: "🇪🇺" },
  { value: "asia", label: "亚洲", flag: "🌏" },
  { value: "china", label: "中国", flag: "🇨🇳" },
  { value: "taiwan", label: "台湾", flag: "🇹🇼" },
  { value: "hong-kong", label: "香港", flag: "🇭🇰" },
  { value: "singapore", label: "新加坡", flag: "🇸🇬" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
];

const DATABASE_SOURCES = [
  { value: "crossref", label: "Crossref", description: "学术期刊数据库" },
  { value: "semanticscholar", label: "Semantic Scholar", description: "语义学术搜索" },
];

export function ReferenceSettings({
  settings,
  onSettingsChange,
  onApply,
  loading = false,
}: ReferenceSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateSettings = (updates: Partial<ReferenceSettings>) => {
    onSettingsChange({ ...settings, ...updates });
  };

  const toggleDocumentType = (type: string) => {
    const newTypes = settings.documentTypes.includes(type)
      ? settings.documentTypes.filter(t => t !== type)
      : [...settings.documentTypes, type];
    updateSettings({ documentTypes: newTypes });
  };

  const toggleSource = (source: string) => {
    const newSources = settings.sources.includes(source)
      ? settings.sources.filter(s => s !== source)
      : [...settings.sources, source];
    updateSettings({ sources: newSources });
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Settings className="w-4 h-4" />
          参考文献设置
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {isExpanded ? "收起" : "展开"}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* 文献类型选择 */}
          <div>
            <label className="block text-sm font-medium mb-2">文献类型</label>
            <div className="grid grid-cols-4 gap-2">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => toggleDocumentType(type.value)}
                  className={`p-2 rounded border text-sm flex items-center gap-2 ${
                    settings.documentTypes.includes(type.value)
                      ? "bg-blue-100 border-blue-500 text-blue-700"
                      : "bg-white border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <span>{type.icon}</span>
                  <span className="text-xs">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 引用格式选择 */}
          <div>
            <label className="block text-sm font-medium mb-2">引用格式</label>
            <select
              value={settings.citationFormat}
              onChange={(e) => updateSettings({ citationFormat: e.target.value })}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {CITATION_FORMATS.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label} - {format.description}
                </option>
              ))}
            </select>
          </div>

          {/* 地区和语言 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">地区</label>
              <select
                value={settings.region}
                onChange={(e) => updateSettings({ region: e.target.value })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {REGIONS.map((region) => (
                  <option key={region.value} value={region.value}>
                    {region.flag} {region.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">语言</label>
              <select
                value={settings.language}
                onChange={(e) => updateSettings({ language: e.target.value })}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 年份范围 */}
          <div>
            <label className="block text-sm font-medium mb-2">年份范围</label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm">从</label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={settings.yearRange.from}
                  onChange={(e) =>
                    updateSettings({
                      yearRange: { ...settings.yearRange, from: parseInt(e.target.value) || 1900 }
                    })
                  }
                  className="w-20 p-1 border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">到</label>
                <input
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={settings.yearRange.to}
                  onChange={(e) =>
                    updateSettings({
                      yearRange: { ...settings.yearRange, to: parseInt(e.target.value) || new Date().getFullYear() }
                    })
                  }
                  className="w-20 p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* 数据库来源 */}
          <div>
            <label className="block text-sm font-medium mb-2">数据库来源</label>
            <div className="grid grid-cols-2 gap-2">
              {DATABASE_SOURCES.map((source) => (
                <button
                  key={source.value}
                  onClick={() => toggleSource(source.value)}
                  className={`p-2 rounded border text-sm text-left ${
                    settings.sources.includes(source.value)
                      ? "bg-green-100 border-green-500 text-green-700"
                      : "bg-white border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <div className="font-medium">{source.label}</div>
                  <div className="text-xs text-gray-500">{source.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 应用设置按钮 */}
          <div className="pt-2 border-t">
            <Button
              onClick={onApply}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? "应用设置中..." : "应用设置"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
