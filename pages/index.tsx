import { useState } from 'react';

export default function Home() {
  const [form, setForm] = useState({
    name: '',
    school: '',
    title: '',
    wordCount: '',
    language: '中文',
    tone: '正式',
    detail: '',
    reference: '',
    rubric: '',
    paragraph: ''
  });

  const [result, setResult] = useState(null);
  const [humanized, setHumanized] = useState('');
  const [loading, setLoading] = useState(false);
  const [hLoading, setHLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setHumanized('');
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  const handleHumanize = async () => {
    setHLoading(true);
    const res = await fetch('/api/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: result?.step2_revised || '' })
    });
    const data = await res.json();
    setHumanized(data.result);
    setHLoading(false);
  };

  const wordCount = (text) => text.trim().split(/\s+/).length;

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800, margin: 'auto' }}>
      <h1>📝 EasyWork 功課生成平台</h1>
      <p>請輸入你的功課要求：</p>

      <input name="name" placeholder="姓名" onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      <input name="school" placeholder="學校/班別" onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      <input name="title" placeholder="功課題目" onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      <input name="wordCount" placeholder="字數（如800）" onChange={handleChange} style={{ width: '100%', margin: 4 }} />

      <select name="language" onChange={handleChange} style={{ width: '100%', margin: 4 }}>
        <option value="中文">中文</option>
        <option value="英文">英文</option>
      </select>
      <select name="tone" onChange={handleChange} style={{ width: '100%', margin: 4 }}>
        <option value="正式">正式</option>
        <option value="半正式">半正式</option>
        <option value="輕鬆">輕鬆</option>
      </select>

      <textarea name="detail" placeholder="內容細節（例子、理論...）" onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      <input name="reference" placeholder="需要 Reference 嗎？APA/MLA/自由格式" onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      <textarea name="rubric" placeholder="評分準則（可選）" onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      <textarea name="paragraph" placeholder="段落拆法、特別要求" onChange={handleChange} style={{ width: '100%', margin: 4 }} />

      <button onClick={handleGenerate} disabled={loading} style={{ marginTop: 10 }}>
        {loading ? '⏳ 正在生成草稿...' : '✨ 生成草稿'}
      </button>

      {result?.step1_draft && (
        <div style={{ marginTop: 20 }}>
          <h3>📄 AI 草稿（第一輪）：</h3>
          <pre style={{ background: '#f0f0f0', padding: 10 }}>{result.step1_draft}</pre>
          <p style={{ fontSize: 14, color: '#888' }}>字數統計：{wordCount(result.step1_draft)} 字</p>
        </div>
      )}

      {result?.step2_revised && (
        <div style={{ marginTop: 20 }}>
          <h3>📘 修訂後版本（第二輪）：</h3>
          <pre style={{ background: '#e8f4ff', padding: 10 }}>{result.step2_revised}</pre>
          <p style={{ fontSize: 14, color: '#888' }}>字數統計：{wordCount(result.step2_revised)} 字</p>

          <button onClick={handleHumanize} disabled={hLoading} style={{ marginTop: 10 }}>
            {hLoading ? '⏳ 語氣潤飾中...' : '🧠 Humanize 語感優化'}
          </button>
        </div>
      )}

      {humanized && (
        <div style={{ marginTop: 20 }}>
          <h3>🎯 Humanize 優化版本：</h3>
          <pre style={{ background: '#e8fff2', padding: 10 }}>{humanized}</pre>
          <p style={{ fontSize: 14, color: '#888' }}>字數統計：{wordCount(humanized)} 字</p>
        </div>
      )}
    </main>
  );
}
