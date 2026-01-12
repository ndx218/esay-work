'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Wallet, HelpCircle, LogOut, X, Sparkles } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useCredits } from '@/hooks/usePointStore';
import { useSession } from 'next-auth/react';

interface SidebarProps {
  onClose?: () => void;
  isExpanded?: boolean;
}

export default function Sidebar({ onClose, isExpanded = true }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const credits = useCredits();
  const { status } = useSession();

  const mainMenu = [
    { label: '作業產生器', href: '/', icon: Home },
    { label: '點數充值', href: '/recharge', icon: Wallet },
    { label: '常見問題', href: '/help', icon: HelpCircle },
  ];

  const handleLogout = async () => {
    localStorage.removeItem('skipLogin'); // ✅ 清除跳過登入 flag
    await signOut({ redirect: false });   // ✅ 登出但不自動跳轉
    router.replace('/login');             // ✅ 手動跳轉
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const CreditsBadge =
    status === 'loading' ? (
      <div className="h-7 w-28 rounded-full bg-gray-100 animate-pulse" />
    ) : (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">積分 {credits}</span>
      </div>
    );

  return (
    <aside
      className={cn(
        'h-screen bg-white text-black flex flex-col pt-4 shadow-md transition-all duration-300 ease-in-out',
        isExpanded ? 'w-64' : 'w-16',
        onClose ? 'fixed top-0 left-0 z-50' : 'hidden md:flex md:fixed md:top-0 md:left-0 md:z-30'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 標題 */}
      <div className="px-6 mb-4 flex items-center justify-between">
        {isExpanded ? (
          <h1 className="text-2xl font-bold leading-tight">
            📚 Assignment<br />Terminator
          </h1>
        ) : (
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AT</span>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black md:hidden"
            aria-label="關閉側欄"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 積分膠囊 + 0 點 CTA */}
      <div className="px-6 mb-6">
        {isExpanded ? (
          <>
            {CreditsBadge}
            {status !== 'loading' && credits === 0 && (
              <div className="mt-2">
                <Link
                  href="/recharge"
                  className="inline-block text-xs px-2 py-1 rounded bg-black text-white hover:bg-gray-800"
                  onClick={onClose}
                >
                  立即充值
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-center">
            <Sparkles className="w-5 h-5 text-emerald-600" />
          </div>
        )}
      </div>

      {/* 導航 */}
      <nav className="flex flex-col gap-1 px-2">
        {mainMenu.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-md transition-colors',
                active
                  ? 'bg-gray-100 font-semibold text-black'
                  : 'text-gray-700 hover:bg-gray-100',
                !isExpanded && 'justify-center'
              )}
              onClick={onClose}
            >
              <Icon className="w-5 h-5" />
              {isExpanded && <span className="text-sm">{label}</span>}
            </Link>
          );
        })}
      </nav>

      <hr className="my-4 border-gray-200 mx-4" />

      {/* 登出 */}
      <nav className="flex flex-col gap-1 px-2">
        <button
          onClick={handleLogout}
          className={`flex items-center gap-3 px-4 py-2 rounded-md transition-colors text-gray-700 hover:bg-gray-100 ${
            !isExpanded && 'justify-center'
          }`}
        >
          <LogOut className="w-5 h-5" />
          {isExpanded && <span className="text-sm">登出</span>}
        </button>
      </nav>

      {isExpanded && (
        <div className="mt-auto text-xs text-gray-400 px-4 py-3">
          © 2025 ChakFung
        </div>
      )}
    </aside>
  );
}
