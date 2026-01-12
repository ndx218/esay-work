'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useCredits, useSetCredits } from '@/hooks/usePointStore';

export default function PointBalance() {
  const { data: session, status } = useSession();

  const credits    = useCredits();
  const setCredits = useSetCredits();

  // 防止 React StrictMode 下 effect 觸發 2 次
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (status === 'loading') return;

    const value =
      typeof session?.user?.credits === 'number'
        ? session.user.credits
        : 5; // 預設值

    setCredits(value);
    initialized.current = true;
  }, [session, status, setCredits]);

  if (status !== 'authenticated' || !session?.user) return null;

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-100 text-yellow-800 px-4 py-2 rounded shadow text-sm">
      👤 {session.user.name ?? '訪客'} ｜ 🪙 點數：<strong>{credits}</strong>
    </div>
  );
}
