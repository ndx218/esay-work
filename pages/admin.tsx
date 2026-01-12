// /pages/admin.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

type Tx = {
  id: string;
  amount: number;
  createdAt: string | Date;
  type?: string | null;
  description?: string | null;
  isFirstTopUp?: boolean | null;
  user?: { email?: string | null; phone?: string | null } | null;
  userId?: string;
  performedBy?: string | null;
};

type AdminTxApi =
  | {
      page: number;
      pageSize: number;
      total: number;
      hasMore: boolean;
      data: Tx[];
    }
  | { transactions: Tx[] }
  | Tx[];

export default function AdminDashboard() {
  const { data: session, status, update: sessionUpdate } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [points, setPoints] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;

  // 進頁授權檢查
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user?.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [status, session, router]);

  // 把 API 回傳正規化為 { list, hasMore }
  function normalizeTx(payload: AdminTxApi | any): { list: Tx[]; hasMore: boolean } {
    if (!payload) return { list: [], hasMore: false };

    if (Array.isArray(payload)) {
      return { list: payload as Tx[], hasMore: false };
    }
    if (Array.isArray((payload as any).data)) {
      return { list: (payload as any).data as Tx[], hasMore: Boolean((payload as any).hasMore) };
    }
    if (Array.isArray((payload as any).transactions)) {
      return { list: (payload as any).transactions as Tx[], hasMore: false };
    }
    return { list: [], hasMore: false };
  }

  async function fetchTransactions(nextPage = 1) {
    const trimmed = email.trim();
    if (!trimmed) {
      setMessage('請先輸入 Email 以查詢紀錄');
      setTransactions([]);
      setHasMore(false);
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const params = new URLSearchParams({
        email: trimmed,
        page: String(nextPage),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/admin/transactions?${params.toString()}`);
      const json = (await res.json()) as AdminTxApi | { error?: string };

      if (!res.ok) {
        setTransactions([]);
        setHasMore(false);
        setMessage(`❌ 錯誤：${(json as any)?.error ?? '查詢失敗'}`);
      } else {
        const { list, hasMore } = normalizeTx(json);
        setTransactions(list ?? []);
        setHasMore(Boolean(hasMore));
        setPage(nextPage);
        if (!list || list.length === 0) setMessage(`沒有找到 ${trimmed} 的交易紀錄。`);
      }
    } catch (err) {
      console.error('Fetch transactions failed:', err);
      setTransactions([]);
      setHasMore(false);
      setMessage('❌ 網路錯誤或伺服器無響應');
    } finally {
      setBusy(false);
    }
  }

  async function refreshSelfCreditsIfNeeded(targetEmail?: string) {
    const currentEmail = session?.user?.email ?? '';
    if (!currentEmail || !targetEmail || currentEmail !== targetEmail) return;

    try {
      const fresh = await fetch('/api/me').then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const newCredits = fresh?.user?.credits;

      if (typeof newCredits === 'number') {
        // A) 嘗試更新 next-auth session（如果當前 next-auth 支援）
        try {
          await sessionUpdate?.({ credits: newCredits } as any);
        } catch {
          // 忽略失敗，不影響主要流程
        }
        // B) 若你有自訂全域 credits store，可在此同步 setCredits(newCredits)
      }
    } catch (e) {
      console.warn('刷新個人點數失敗（不影響主流程）：', e);
    }
  }

  async function handleAddPoints() {
    const trimmed = email.trim();
    if (!trimmed || !points) {
      setMessage('請輸入 Email 和 點數');
      return;
    }
    const n = Number(points);
    if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
      setMessage('點數必須為正整數');
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/add-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, amount: n }),
      });
      const json = await res.json();

      if (!res.ok) {
        setMessage(`❌ 錯誤：${json?.error ?? '未知錯誤'}`);
        return;
      }

      setMessage(`✅ ${json?.message ?? '加點成功'}`);
      setPoints('');

      // 1) 立即刷新交易清單（維持在目前頁）
      await fetchTransactions(page);

      // 2) 若加點對象是自己 → 即時刷新 header 的點數顯示
      await refreshSelfCreditsIfNeeded(trimmed);
    } catch (err) {
      console.error('Add points failed:', err);
      setMessage('❌ 網路錯誤或伺服器無響應');
    } finally {
      setBusy(false);
    }
  }

  // 顯示統計
  const totalDelta = useMemo(
    () => transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [transactions]
  );

  if (status === 'loading') {
    return <div className="h-screen flex items-center justify-center text-gray-500">⏳ 載入中...</div>;
  }
  if (!session || session.user?.role !== 'ADMIN') {
    return <div className="h-screen flex items-center justify-center text-gray-500">🚫 無權訪問。</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👑 管理員後台</h1>

      <nav className="mb-4 space-x-4 text-sm text-blue-600">
        <Link href="/admin">🏠 主控台</Link>
        <Link href="/admin/topup-submissions">📤 查看付款上傳</Link>
        <Link href="/admin/transactions">📊 所有交易紀錄</Link>
      </nav>

      {/* 加點工具 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">➕ 加點工具</h2>
        <Input
          placeholder="使用者 Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="off"
        />
        <Input
          placeholder="加幾點？"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
          type="number"
          min={1}
          inputMode="numeric"
        />
        <div className="flex gap-2">
          <Button onClick={handleAddPoints} disabled={busy || !email.trim() || !points} className="flex-1">
            {busy ? '處理中...' : '➕ 加點'}
          </Button>
          <Button
            variant="outline"
            onClick={() => fetchTransactions(1)}
            disabled={busy || !email.trim()}
          >
            {busy ? '查詢中...' : '🔄 查詢紀錄'}
          </Button>
        </div>
      </section>

      {message && (
        <p className={`text-sm text-center ${message.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}

      {/* 簡單統計 */}
      <div className="text-sm text-gray-600">
        本頁 {transactions.length} 筆，合計變動：{totalDelta} 點
      </div>

      {/* 交易清單 */}
      <section>
        <ul className="text-sm space-y-2">
          {transactions.map((tx) => {
            // ✅ 修正：避免混用 ?? 與 ||，改成先用 Nullish 再單獨處理空字串
            const primary = tx.user?.email ?? email;
            const emailShown = primary && primary.trim().length > 0 ? primary : '(未知 Email)';

            const created = typeof tx.createdAt === 'string' ? new Date(tx.createdAt) : tx.createdAt;

            return (
              <li key={tx.id} className="border rounded p-2 bg-gray-50">
                ✉️ {emailShown} — 💰 {tx.amount} 點 —{' '}
                {tx.type || (tx.isFirstTopUp ? '首充' : '加值')}{' '}
                {tx.description ? `(${tx.description})` : ''} —{' '}
                {created ? created.toLocaleString() : '-'}
              </li>
            );
          })}
          {transactions.length === 0 && <li className="text-gray-400">尚無紀錄</li>}
        </ul>

        {/* 分頁 */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            disabled={busy || page <= 1}
            onClick={() => fetchTransactions(page - 1)}
          >
            ◀︎ 上一頁
          </Button>
          <span className="text-sm text-gray-600">第 {page} 頁</span>
          <Button
            variant="outline"
            disabled={busy || !hasMore}
            onClick={() => fetchTransactions(page + 1)}
          >
            下一頁 ▶︎
          </Button>
        </div>
      </section>
    </div>
  );
}
