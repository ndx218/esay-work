import { useState } from 'react';

export default function Home() {
  const [form, setForm] = useState({
    name: '', school: '', members: '',
    title: '', wordCount: '', language: '中文', tone: '正式',
    detail: '', reference: '', rubric: '', paragraph: ''
  });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    const data = await res.json();
    setResult(data.result);
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 700, margin: 'auto', padding: 20, fontFamily: 'sans-serif' }}>
      <h1>📝 EasyWork 功課生成平台</h1>
      <p>請填寫以下功課要求，AI 將自動幫你撰寫草稿。</p>

      <input placeholder="姓名" name="name" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <input placeholder="學校/班別" name="school" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <input placeholder="組員（如有）" name="members" onChange={handleChange} style={{ width: '100%', margin: 5 }} />

      <hr />

      <input placeholder="功課題目" name="title" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <input placeholder="字數（如800）" name="wordCount" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <select name="language" onChange={handleChange} style={{ width: '100%', margin: 5 }}>
        <option value="中文">中文</option>
        <option value="英文">英文</option>
      </select>
      <select name="tone" onChange={handleChange} style={{ width: '100%', margin: 5 }}>
        <option value="正式">正式</option>
        <option value="半正式">半正式</option>
        <option value="輕鬆">輕鬆</option>
      </select>
      <textarea placeholder="內容要求（如要有3個例子）" name="detail" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <input placeholder="是否需要 Reference？格式？" name="reference" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <textarea placeholder="評分準則（如有）" name="rubric" onChange={handleChange} style={{ width: '100%', margin: 5 }} />
      <textarea placeholder="段落拆法、特殊要求等" name="paragraph" onChange={handleChange} style={{ width: '100%', margin: 5 }} />

      <button onClick={handleSubmit} style={{ padding: 10, marginTop: 10 }}>✨ 生成草稿</button>

      {loading && <p>⏳ 正在生成中...</p>}
      {result && (
        <div style={{ whiteSpace: 'pre-wrap', marginTop: 20, background: '#f5f5f5', padding: 10 }}>
          <h3>📄 草稿內容：</h3>
          {result}
        </div>
      )}
    </div>
  );
}
// 在 pages/index.tsx 中加入這段程式碼：

import { useState } from "react";

export default function Home() {
  const [draft, setDraft] = useState("");
  const [humanized, setHumanized] = useState("");
  const [loading, setLoading] = useState(false);

  const handleHumanize = async () => {
    setLoading(true);
    setHumanized("");
    try {
      const response = await fetch("/api/humanize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft })
      });
      const data = await response.json();
      setHumanized(data.result);
    } catch (err) {
      alert("潤飾失敗，請稍後再試");
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>📝 EasyWork 功課生成平台</h1>

      <textarea
        rows={8}
        style={{ width: "100%", marginBottom: 12 }}
        placeholder="請輸入要潤飾的草稿內容..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <button onClick={handleHumanize} disabled={loading}>
        ✨潤飾草稿
      </button>

      {loading && <p>⏳ 正在潤飾中...</p>}

      {humanized && (
        <div style={{ marginTop: 20 }}>
          <h3>潤飾後內容：</h3>
          <div
            style={{
              border: "1px solid #ccc",
              padding: 16,
              borderRadius: 8,
              background: "#fafafa"
            }}
          >
            {humanized}
          </div>
        </div>
      )}
    </div>
  );
}
