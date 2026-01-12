"use client";

import { useState } from "react";

export default function EasyWorkUI() {
  const [form, setForm] = useState({
    name: "",
    school: "",
    title: "",
    wordCount: "",
    reference: "",
    rubric: "",
    paragraph: "",
    language: "中文",
    tone: "正式",
    detail: "",
  });

  return (
    <div className="flex flex-1 h-full">
      {/* -------- 左：功課設定 -------- */}
      <div className="w-96 border-r p-6 bg-gray-50 overflow-y-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="font-bold text-xl mb-6 text-center text-gray-800">📚 功課設定</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">學生姓名</label>
              <input
                type="text"
                placeholder="請輸入姓名"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">學校名稱</label>
              <input
                type="text"
                placeholder="請輸入學校"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.school}
                onChange={(e) => setForm({ ...form, school: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">論文標題</label>
              <input
                type="text"
                placeholder="請輸入論文標題"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">字數要求</label>
              <input
                type="text"
                placeholder="請輸入字數"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.wordCount}
                onChange={(e) => setForm({ ...form, wordCount: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">參考文獻</label>
              <input
                type="text"
                placeholder="請輸入參考文獻"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">評分標準</label>
              <input
                type="text"
                placeholder="請輸入評分標準"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.rubric}
                onChange={(e) => setForm({ ...form, rubric: e.target.value })}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">段落要求</label>
              <input
                type="text"
                placeholder="請輸入段落要求"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                value={form.paragraph}
                onChange={(e) => setForm({ ...form, paragraph: e.target.value })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">語言</label>
                <select
                  value={form.language}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                >
                  <option value="中文">中文</option>
                  <option value="英文">英文</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">語氣</label>
                <select
                  value={form.tone}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                  onChange={(e) => setForm({ ...form, tone: e.target.value })}
                >
                  <option value="正式">正式</option>
                  <option value="半正式">半正式</option>
                  <option value="輕鬆">輕鬆</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">內容細節</label>
              <textarea
                placeholder="請詳細描述您的作業要求..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500 min-h-[100px] resize-none"
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* 🔧 段落規劃器 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h3 className="font-bold text-lg mb-4 text-center text-gray-800">🧭 段落規劃器</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">引言字數</label>
              <input
                type="number"
                value="140"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">主體段數</label>
              <input
                type="number"
                value="3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">結論字數</label>
              <input
                type="number"
                value="140"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
                readOnly
              />
            </div>
          </div>
        </div>

        {/* -------- AI 功能 -------- */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-bold text-lg mb-4 text-center text-gray-800">🚀 AI 功能</h3>
          
          <div className="space-y-3">
            <div>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:border-blue-500 focus:ring-blue-500">
                <option>GPT-3.5 (0 點)</option>
              </select>
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                🧠 產生大綱
              </button>
            </div>

            <div>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:border-blue-500 focus:ring-blue-500">
                <option>GPT-3.5 (0 點)</option>
              </select>
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                ✍️ 草稿產生
              </button>
            </div>

            <div>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:border-blue-500 focus:ring-blue-500">
                <option>GPT-3.5 (0 點)</option>
              </select>
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                🧑‍🏫 教師評論
              </button>
            </div>

            <div>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:border-blue-500 focus:ring-blue-500">
                <option>GPT-3.5 (0 點)</option>
              </select>
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                📝 GPT-style 修訂
              </button>
            </div>

            <div>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 focus:border-blue-500 focus:ring-blue-500">
                <option>GPT-3.5 (0 點)</option>
              </select>
              <button className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                🤖 最終人性化優化
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -------- 右：大綱產生器結果 -------- */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4">📑 大綱產生器</h2>
          
          <div className="mb-4">
            <div className="flex space-x-2 mb-4">
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg">📑 大綱產生器</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">✍️ 初稿</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">🧑‍🏫 教師評論</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">📝 修訂稿</button>
              <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg">🤖 最終版本</button>
            </div>
            
            <div className="mb-4">
              <h3 className="font-semibold mb-2">大綱產生器：</h3>
              <div className="flex space-x-4 mb-4">
                <label className="flex items-center">
                  <input type="radio" name="mode" value="edit" defaultChecked className="mr-2" />
                  編輯模式
                </label>
                <label className="flex items-center">
                  <input type="radio" name="mode" value="view" className="mr-2" />
                  檢視模式
                </label>
              </div>
            </div>
          </div>
          
          <textarea
            placeholder="在這裡編輯大綱..."
            className="w-full min-h-[400px] border border-gray-300 rounded-lg p-4 focus:border-blue-500 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
