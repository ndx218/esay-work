"use client";

import { useSession } from 'next-auth/react';
import { Menu, User, CreditCard, X, Home, CreditCard as CreditCardIcon, HelpCircle, LogOut, Star } from 'lucide-react';
import { useState } from 'react';

interface TopNavigationProps {
  onHamburgerClick?: () => void;
}

export default function TopNavigation({ onHamburgerClick }: TopNavigationProps) {
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleHamburgerClick = () => {
    setIsSidebarOpen(!isSidebarOpen);
    onHamburgerClick && onHamburgerClick();
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <>
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-b border-slate-700 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between h-16 px-0">
          {/* 左侧：汉堡菜单 + Assignment Terminator */}
          <div className="flex items-center space-x-6 pl-4">
            <button
              onClick={handleHamburgerClick}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
              title="菜单"
            >
              <Menu className="w-6 h-6 text-white hover:text-white" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="text-3xl">📚</span>
              <span className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">Assignment Terminator</span>
            </div>
          </div>

          {/* 中间：口号 */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
                不是你摧毁作业,就是作业摧毁你!
              </h1>
            </div>
          </div>

          {/* 右侧：积分和用户信息 */}
          <div className="flex items-center space-x-6 pr-4">
            <div className="flex items-center space-x-2 bg-amber-100 px-3 py-2 rounded-lg">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span className="text-amber-700 font-medium">
                {session?.user?.credits || 259} 点
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5 text-white" />
              <span className="text-white font-medium">
                {session?.user?.email || '用户'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 侧边栏弹窗 */}
      {isSidebarOpen && (
        <>
          {/* 背景遮罩 */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={closeSidebar}
          />
          
          {/* 侧边栏弹窗 */}
          <div className={`fixed left-0 top-0 h-full w-80 bg-slate-800 shadow-2xl z-40 transform transition-all duration-500 ease-in-out border-r-2 border-slate-600 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-end mb-6 pb-4 border-b border-slate-600">
                <button
                  onClick={closeSidebar}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-blue-500 transition-colors"
                >
                  <X className="w-5 h-5 text-white hover:text-white" />
                </button>
              </div>

              {/* User Info */}
              <div className="mb-6 pb-4 border-b border-slate-600">
                <div className="bg-green-100 text-green-700 px-4 py-2 rounded-full flex items-center space-x-2">
                  <span>⭐</span>
                  <span>積分 259</span>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-2 mb-6 pb-4 border-b border-slate-600">
                <a href="/" className="flex items-center space-x-3 p-3 rounded-lg bg-slate-700 text-white">
                  <span>🏠</span>
                  <span>作業產生器</span>
                </a>
                <a href="/recharge" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-700 transition-colors text-slate-300">
                  <span>💳</span>
                  <span>點數充值</span>
                </a>
                <a href="/help" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-700 transition-colors text-slate-300">
                  <span>❓</span>
                  <span>常見問題</span>
                </a>
              </div>

              {/* Logout Button */}
              <div className="mt-6">
                <button className="w-full flex items-center space-x-3 p-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white transition-colors border border-slate-600">
                  <span>→</span>
                  <span>登出</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
