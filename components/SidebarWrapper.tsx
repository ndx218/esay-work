'use client';

import { useEffect, useCallback, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function SidebarWrapper() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  // 监听汉堡菜单点击事件
  useEffect(() => {
    const handleHamburgerClick = () => {
      setIsExpanded(!isExpanded);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hamburger-click', handleHamburgerClick);
      return () => window.removeEventListener('hamburger-click', handleHamburgerClick);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onKeyDown]);

  return (
    <>
      {/* 手機漢堡 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-full bg-white border shadow-md md:hidden"
        aria-label="開啟選單"
      >
        <Menu className="w-5 h-5 text-black" />
      </button>

      {/* 手機版遮罩 + 側欄 */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed top-0 left-0 z-40 w-[240px] h-full bg-white shadow-md"
            role="dialog"
            aria-modal="true"
          >
            <Sidebar onClose={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* 桌面版側欄 - 與頂部導航欄完全連接 */}
      <div className={`hidden md:block flex-1 bg-white transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-64' : 'w-16'
      }`}>
        <Sidebar isExpanded={isExpanded} />
      </div>
    </>
  );
}
