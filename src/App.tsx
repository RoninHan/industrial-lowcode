import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './mock'; // 导入Mock数据

function App() {
  return (
    <div className="min-h-screen bg-industrial-50">
      <div className="container mx-auto p-8">
        <h1 className="text-4xl font-bold text-primary-600 mb-4">
          工业低代码平台
        </h1>
        <p className="text-industrial-600 mb-8">
          项目已成功创建！正在启动开发服务器...
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-industrial-900 mb-2">✅ React + TypeScript</h3>
            <p className="text-sm text-industrial-600">现代化前端框架</p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-industrial-900 mb-2">✅ Three.js</h3>
            <p className="text-sm text-industrial-600">3D场景渲染</p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-industrial-900 mb-2">✅ ECharts</h3>
            <p className="text-sm text-industrial-600">数据可视化</p>
          </div>
          <div className="card">
            <h3 className="text-lg font-semibold text-industrial-900 mb-2">✅ 低代码编辑器</h3>
            <p className="text-sm text-industrial-600">拖拽式页面构建</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
