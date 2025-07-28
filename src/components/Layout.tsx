import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { observer } from 'mobx-react';
import { appStore } from '../stores';

const Layout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: '仪表板', icon: '📊' },
    { path: '/three', label: '3D场景', icon: '🎮' },
    { path: '/charts', label: '图表', icon: '📈' },
    { path: '/editor', label: '低代码编辑器', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-industrial-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm border-b border-industrial-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-primary-600">
                  工业低代码平台
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => appStore.setTheme(appStore.theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg bg-industrial-100 hover:bg-industrial-200 transition-colors"
              >
                {appStore.theme === 'light' ? '🌙' : '☀️'}
              </button>
              
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {appStore.currentUser?.username?.charAt(0) || 'U'}
                </div>
                <span className="text-sm text-industrial-700">
                  {appStore.currentUser?.username || '用户'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* 侧边栏 */}
        <aside className="w-64 bg-white shadow-sm border-r border-industrial-200">
          <nav className="mt-8">
            <div className="px-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500'
                      : 'text-industrial-600 hover:bg-industrial-50 hover:text-industrial-900'
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 p-8">
          {appStore.isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          )}
          
          <div className={appStore.isLoading ? 'hidden' : ''}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default observer(Layout); 