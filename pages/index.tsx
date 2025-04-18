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

  const [result, setResult] = useState('');
  const [undetectable, setUndetectable] = useState('');
  const [gptRewrite, setGptRewrite] = useState('');
  const [loading, setLoading] = useState(false);
  const [uLoading, setULoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult('');
    setUndetectable('');
    setGptRewrite('');
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setResult(data.result);
    setLoading(false);
  };

  const handleUndetectable = async () => {
    setULoading(true);
    const res = await fetch('/api/Undetectable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: result })
    });
    const data = await res.json();
    setUndetectable(data.result);
    setULoading(false);
  };

  const handleGPTRewrite = async () => {
    setGLoading(true);
    const res = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: result })
    });
    const data = await res.json();
    setGptRewrite(data.result);
    setGLoading(false);
  };

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

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>📄 AI 草稿：</h3>
          <pre style={{ background: '#f0f0f0', padding: 10 }}>{result}</pre>

          <div style={{ display: 'flex', gap: '1rem', marginTop: 10 }}>
            <button onClick={handleUndetectable} disabled={uLoading}>
              {uLoading ? '⏳ Undetectable 處理中...' : '🧠 Undetectable 優化'}
            </button>
            <button onClick={handleGPTRewrite} disabled={gLoading}>
              {gLoading ? '⏳ GPT 降 AI 中...' : '🤖 GPT 降 AI'}
            </button>
          </div>
        </div>
      )}

      {undetectable && (
        <div style={{ marginTop: 20 }}>
          <h3>🧠 Undetectable 優化後版本：</h3>
          <pre style={{ background: '#fff6f0', padding: 10 }}>{undetectable}</pre>
        </div>
      )}

      {gptRewrite && (
        <div style={{ marginTop: 20 }}>
          <h3>🤖 GPT 降 AI 版本：</h3>
          <pre style={{ background: '#e8fff2', padding: 10 }}>{gptRewrite}</pre>
        </div>
      )}
    </main>
  );
}
