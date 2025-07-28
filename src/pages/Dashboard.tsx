import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { appStore } from '../stores';
import http from '../services/http';

interface StatsData {
  totalUsers: number;
  totalProjects: number;
  activeUsers: number;
  totalRevenue: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        appStore.setLoading(true);
        const data = await http.get('/dashboard/stats');
        setStats(data.data);
      } catch (error) {
        console.error('获取统计数据失败:', error);
      } finally {
        appStore.setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: '总用户数',
      value: stats?.totalUsers || 0,
      icon: '👥',
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: '总项目数',
      value: stats?.totalProjects || 0,
      icon: '📁',
      color: 'bg-green-500',
      change: '+8%',
      changeType: 'positive'
    },
    {
      title: '活跃用户',
      value: stats?.activeUsers || 0,
      icon: '🔥',
      color: 'bg-yellow-500',
      change: '+5%',
      changeType: 'positive'
    },
    {
      title: '总收入',
      value: `¥${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: '💰',
      color: 'bg-purple-500',
      change: '+15%',
      changeType: 'positive'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-industrial-900">仪表板</h1>
        <p className="text-industrial-600 mt-2">欢迎使用工业低代码平台</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-industrial-600">{card.title}</p>
                <p className="text-2xl font-bold text-industrial-900 mt-1">{card.value}</p>
                <p className={`text-sm mt-1 ${
                  card.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.change} 较上月
                </p>
              </div>
              <div className={`w-12 h-12 rounded-lg ${card.color} flex items-center justify-center text-white text-xl`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 快速操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">快速操作</h3>
          <div className="space-y-3">
            <button className="w-full btn-primary">
              🎮 创建3D场景
            </button>
            <button className="w-full btn-secondary">
              📊 新建图表
            </button>
            <button className="w-full btn-secondary">
              ⚙️ 打开编辑器
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">最近活动</h3>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-industrial-50 rounded-lg">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                📊
              </div>
              <div>
                <p className="text-sm font-medium text-industrial-900">创建了新的仪表板</p>
                <p className="text-xs text-industrial-500">2小时前</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-industrial-50 rounded-lg">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                🎮
              </div>
              <div>
                <p className="text-sm font-medium text-industrial-900">更新了3D场景</p>
                <p className="text-xs text-industrial-500">4小时前</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-industrial-50 rounded-lg">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                ⚙️
              </div>
              <div>
                <p className="text-sm font-medium text-industrial-900">发布了新组件</p>
                <p className="text-xs text-industrial-500">1天前</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(Dashboard); 