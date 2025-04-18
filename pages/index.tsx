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
