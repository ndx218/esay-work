// pages/admin/topup-submissions.tsx
'use client';

import { useEffect, useState } from 'react';

type TopUpSubmission = {
  id: string;
  name: string;
  phone: string;
  referralCode: string | null;
  imageUrl: string;
  createdAt: string;
};

export default function AdminTopUpsPage() {
  const [subs, setSubs] = useState<TopUpSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/topup-submissions')  // ✅ 这里必须是 ASCII dash U+002D
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Unknown error');
        }
        return res.json();
      })
      .then((data: TopUpSubmission[]) => {
        setSubs(data);
      })
      .catch((e) => {
        console.error('[AdminTopUp] 載入錯誤：', e);
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">📤 付款上傳紀錄</h1>

      {loading && <p className="text-gray-500">⏳ 載入中…</p>}
      {error && <p className="text-red-600">❌ {error}</p>}

      {!loading && !error && subs.length === 0 && (
        <p className="text-gray-400">尚無資料</p>
      )}

      {!loading && !error && subs.length > 0 && (
        <ul className="space-y-3">
          {subs.map((item) => (
            <li key={item.id} className="border rounded p-3 bg-gray-50 shadow-sm">
              👤 {item.name} &nbsp; 📞 {item.phone} <br />
              {item.referralCode && `代碼：${item.referralCode}`}<br />
              📸{' '}
              <a
                href={item.imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                查看截圖
              </a>
              <br />
              🕒 {new Date(item.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
