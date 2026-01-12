'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSetCredits, usePointStore } from '@/hooks/usePointStore';

/** 將 session.user.credits 同步到 Zustand，並處理登出/換帳號 */
export default function SessionCreditsHydrator() {
  // ⚠️ 所有 hooks 必须在组件顶层调用（React hooks 规则）
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();
  const setCredits = useSetCredits();
  const lastUserIdRef = useRef<string | null>(null);
  const hydratedRef = useRef(false);

  // 设置 mounted 状态
  useEffect(() => {
    setMounted(true);
  }, []);

  // 手动触发 hydration（因为启用了 skipHydration）
  useEffect(() => {
    if (mounted && !hydratedRef.current && typeof window !== 'undefined') {
      try {
        usePointStore.persist?.rehydrate?.();
        hydratedRef.current = true;
      } catch (error) {
        console.error('Failed to rehydrate store:', error);
      }
    }
  }, [mounted]);

  useEffect(() => {
    // 只在客户端挂载后运行
    if (!mounted) return;
    
    // 确保 setCredits 可用
    if (!setCredits || typeof setCredits !== 'function') {
      return;
    }

    try {
      if (status === 'authenticated') {
        const userId = String(session?.user?.id ?? '');
        const raw = (session as any)?.user?.credits;

        // 換帳號時清除上一位使用者的持久化資料，避免殘留
        if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
          usePointStore.persist?.clearStorage?.();
        }
        lastUserIdRef.current = userId;

        // 僅在是數字時才覆寫 Store，避免不完整的 session 將值降為 0
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          setCredits(raw);
        }
        return;
      }

      if (status === 'unauthenticated') {
        // 登出時歸零並清掉持久化，避免下位使用者看到殘值
        setCredits(0);
        usePointStore.persist?.clearStorage?.();
        lastUserIdRef.current = null;
      }
    } catch (error) {
      console.error('SessionCreditsHydrator error:', error);
      // 靜默處理錯誤，不影響應用運行
    }
  }, [status, session?.user?.id, session?.user?.credits, setCredits, mounted]);

  // 如果还没挂载，返回 null（避免 SSR 错误）
  if (!mounted) return null;

  return null;
}
