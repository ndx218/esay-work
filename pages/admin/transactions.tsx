// pages/admin/transactions.tsx
'use client';

import { useEffect, useState } from 'react';

type TransactionRecord = {
  id: string;
  amount: number;
  type: string;
  description?: string;
  createdAt: string;
  user: { email: string };
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/all-transactions')  // ✅ 同样要用 U+002D
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Unknown error');
        }
        return res.json();
      })
      .then((data: TransactionRecord[]) => {
        setTransactions(data);
      })
      .catch((e) => {
        console.error('[AdminTransactions] 載入錯誤：', e);
        setError(e.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">📊 所有用戶交易紀錄</h1>

      {loading && <p className="text-gray-500">⏳ 載入中…</p>}
      {error && <p className="text-red-600">❌ {error}</p>}

      {!loading && !error && transactions.length === 0 && (
        <p className="text-gray-400">目前沒有任何交易紀錄。</p>
      )}

      {!loading && !error && transactions.length > 0 && (
        <ul className="space-y-3">
          {transactions.map((tx) => (
            <li key={tx.id} className="border rounded p-3 bg-gray-50 shadow-sm">
              ✉️ <strong>{tx.user.email}</strong><br />
              💰 {tx.amount} 點<br />
              🏷 {tx.type}
              {tx.description ? ` (${tx.description})` : ''}<br />
              🕒 {new Date(tx.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
