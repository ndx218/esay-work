import { useState } from 'react';

export default function Home() {
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
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(''); setRewritten(''); setHumanized(''); setError('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (data.step1_draft) {
        setResult(data.step1_draft);
      } else {
        setResult('❌ 初稿未正確生成');
      }

      if (data.step2_revised) {
        setRewritten(data.step2_revised);
      } else {
        setRewritten('⚠️ 第二輪修訂失敗');
      }
    } catch (err) {
      console.error('❌ 生成錯誤：', err);
      setError('❌ 系統錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleUndetectable = async () => {
    setHLoading(true);
    setError('');
    try {
      const res = await fetch('/api/Undetectable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rewritten || result })
      });
      const data = await res.json();
      setHumanized(data.result || '❌ Undetectable 優化失敗');
    } catch (err) {
      console.error('❌ Undetectable 錯誤：', err);
      setError('❌ Undetectable API 錯誤');
    } finally {
      setHLoading(false);
    }
  };

  const handleRewrite = async () => {
    setHLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rewritten || result })
      });
      const data = await res.json();
      setHumanized(data.result || '❌ GPT 降 AI 失敗');
    } catch (err) {
      console.error('❌ GPT Rewrite 錯誤：', err);
      setError('❌ GPT API 錯誤');
    } finally {
      setHLoading(false);
    }
  };

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 800, margin: 'auto' }}>
      <h1>📝 EasyWork 功課生成平台</h1>
      <p>請輸入你的功課要求：</p>

      {["name", "school", "title", "wordCount", "reference", "rubric", "paragraph"].map((name) => (
        <input key={name} name={name} placeholder={name} onChange={handleChange} style={{ width: '100%', margin: 4 }} />
      ))}
      <select name="language" onChange={handleChange} style={{ width: '100%', margin: 4 }}>
        <option value="中文">中文</option>
        <option value="英文">英文</option>
      </select>
      <select name="tone" onChange={handleChange} style={{ width: '100%', margin: 4 }}>
        <option value="正式">正式</option>
        <option value="半正式">半正式</option>
        <option value="輕鬆">輕鬆</option>
      </select>
      <textarea name="detail" placeholder="內容細節" onChange={handleChange} style={{ width: '100%', margin: 4 }} />

      <button onClick={handleGenerate} disabled={loading} style={{ marginTop: 10 }}>
        {loading ? '⏳ 正在生成草稿...' : '✨ 生成草稿'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>📄 AI 草稿：</h3>
          <pre style={{ background: '#f0f0f0', padding: 10 }}>{result}</pre>
          <p>字數統計：{result.length} 字</p>
        </div>
      )}

      {rewritten && (
        <div style={{ marginTop: 20 }}>
          <h3>📝 第二輪修訂稿：</h3>
          <pre style={{ background: '#fff8e1', padding: 10 }}>{rewritten}</pre>
          <p>字數統計：{rewritten.length} 字</p>
        </div>
      )}

      {rewritten && (
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <button onClick={handleUndetectable} disabled={hLoading}>
            {hLoading ? '⏳ Undetectable 優化中...' : '🧪 Undetectable 優化'}
          </button>
          <button onClick={handleRewrite} disabled={hLoading}>
            {hLoading ? '⏳ GPT 降 AI 中...' : '🤖 GPT 降 AI'}
          </button>
        </div>
      )}

      {humanized && (
        <div style={{ marginTop: 20 }}>
          <h3>🎯 優化後版本：</h3>
          <pre style={{ background: '#e8fff2', padding: 10 }}>{humanized}</pre>
        </div>
      )}
    </main>
  );
}
