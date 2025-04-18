import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function EasyWorkUI() {
  const [form, setForm] = useState({
    name: '', school: '', title: '', wordCount: '',
    language: '中文', tone: '正式', detail: '',
    reference: '', rubric: '', paragraph: ''
  });
  const [result, setResult] = useState('');
  const [rewritten, setRewritten] = useState('');
  const [humanized, setHumanized] = useState('');
  const [loading, setLoading] = useState(false);
  const [hLoading, setHLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(''); setRewritten(''); setHumanized('');
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setResult(data.step1_draft);
    setRewritten(data.step2_revised);
    setLoading(false);
  };

  const handleUndetectable = async () => {
    setHLoading(true);
    const res = await fetch('/api/Undetectable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rewritten || result })
    });
    const data = await res.json();
    setHumanized(data.result);
    setHLoading(false);
  };

  const handleRewrite = async () => {
    setHLoading(true);
    const res = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rewritten || result })
    });
    const data = await res.json();
    setHumanized(data.result);
    setHLoading(false);
  };

  return (
    <div className="flex h-screen">
      <div className="w-64 border-r p-4 bg-gray-50">
        <h2 className="font-bold text-lg mb-4">📚 功課設定</h2>
        {['name','school','title','wordCount','reference','rubric','paragraph'].map((field) => (
          <Input key={field} name={field} placeholder={field} onChange={handleChange} className="mb-2" />
        ))}
        <select name="language" onChange={handleChange} className="mb-2 w-full border rounded px-2 py-1">
          <option value="中文">中文</option>
          <option value="英文">英文</option>
        </select>
        <select name="tone" onChange={handleChange} className="mb-2 w-full border rounded px-2 py-1">
          <option value="正式">正式</option>
          <option value="半正式">半正式</option>
          <option value="輕鬆">輕鬆</option>
        </select>
        <Textarea name="detail" placeholder="內容細節" onChange={handleChange} className="mb-2" />
        <Button onClick={handleGenerate} disabled={loading} className="w-full mt-2">
          {loading ? '⏳ 生成中...' : '✨ 生成草稿'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Tabs defaultValue="step1">
          <TabsList>
            <TabsTrigger value="step1">📄 AI 草稿</TabsTrigger>
            <TabsTrigger value="step2">✏️ 第二輪修訂稿</TabsTrigger>
            <TabsTrigger value="final">🌟 優化後版本</TabsTrigger>
          </TabsList>

          <TabsContent value="step1">
            {result && (
              <Card className="p-4 mt-4 whitespace-pre-wrap">
                <h3 className="font-semibold mb-2">初稿：</h3>
                <div>{result}</div>
                <p className="text-sm text-gray-500 mt-2">字數：{result.length}</p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="step2">
            {rewritten && (
              <Card className="p-4 mt-4 whitespace-pre-wrap bg-yellow-50">
                <h3 className="font-semibold mb-2">修訂稿：</h3>
                <div>{rewritten}</div>
                <p className="text-sm text-gray-500 mt-2">字數：{rewritten.length}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={handleUndetectable} disabled={hLoading}>
                    {hLoading ? '⏳ Undetectable 中...' : '🧪 Undetectable 優化'}
                  </Button>
                  <Button onClick={handleRewrite} disabled={hLoading}>
                    {hLoading ? '⏳ GPT 降 AI 中...' : '🤖 GPT 降 AI'}
                  </Button>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="final">
            {humanized && (
              <Card className="p-4 mt-4 whitespace-pre-wrap bg-green-50">
                <h3 className="font-semibold mb-2">優化版本：</h3>
                <div>{humanized}</div>
                <p className="text-sm text-gray-500 mt-2">字數：{humanized.length}</p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
