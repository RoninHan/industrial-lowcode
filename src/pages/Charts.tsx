import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react';
import * as echarts from 'echarts';
import { appStore } from '../stores';
import http from '../services/http';

const Charts: React.FC = () => {
  const lineChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('line');

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        appStore.setLoading(true);
        
        // 获取折线图数据
        const lineData = await http.get('/charts/line');
        appStore.updateChartData('line', lineData.data);
        
        // 获取柱状图数据
        const barData = await http.get('/charts/bar');
        appStore.updateChartData('bar', barData.data);
        
        // 获取饼图数据
        const pieData = await http.get('/charts/pie');
        appStore.updateChartData('pie', pieData);
        
      } catch (error) {
        console.error('获取图表数据失败:', error);
      } finally {
        appStore.setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  useEffect(() => {
    if (!lineChartRef.current || !appStore.chartData.line.length) return;

    const chart = echarts.init(lineChartRef.current);
    
    const option = {
      title: {
        text: '销售趋势',
        left: 'center',
        textStyle: {
          color: '#374151'
        }
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: appStore.chartData.line.series?.map((s: any) => s.name) || [],
        bottom: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: appStore.chartData.line.xAxis || []
      },
      yAxis: {
        type: 'value'
      },
      series: appStore.chartData.line.series?.map((s: any) => ({
        name: s.name,
        type: 'line',
        data: s.data,
        smooth: true,
        areaStyle: {
          opacity: 0.1
        }
      })) || []
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [appStore.chartData.line]);

  useEffect(() => {
    if (!barChartRef.current || !appStore.chartData.bar.length) return;

    const chart = echarts.init(barChartRef.current);
    
    const option = {
      title: {
        text: '产品销量',
        left: 'center',
        textStyle: {
          color: '#374151'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: appStore.chartData.bar.categories || []
      },
      yAxis: {
        type: 'value'
      },
      series: appStore.chartData.bar.series?.map((s: any) => ({
        name: s.name,
        type: 'bar',
        data: s.data,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#1d4ed8' }
          ])
        }
      })) || []
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [appStore.chartData.bar]);

  useEffect(() => {
    if (!pieChartRef.current || !appStore.chartData.pie.length) return;

    const chart = echarts.init(pieChartRef.current);
    
    const option = {
      title: {
        text: '产品分布',
        left: 'center',
        textStyle: {
          color: '#374151'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: appStore.chartData.pie.map((item: any) => item.name)
      },
      series: [
        {
          name: '产品分布',
          type: 'pie',
          radius: '50%',
          data: appStore.chartData.pie.map((item: any) => ({
            value: item.value,
            name: item.name
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [appStore.chartData.pie]);

  const tabs = [
    { key: 'line', label: '折线图', icon: '📈' },
    { key: 'bar', label: '柱状图', icon: '📊' },
    { key: 'pie', label: '饼图', icon: '🥧' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-industrial-900">图表展示</h1>
        <p className="text-industrial-600 mt-2">使用ECharts创建各种类型的图表</p>
      </div>

      {/* 图表类型选择 */}
      <div className="flex space-x-1 bg-industrial-100 p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-industrial-600 hover:text-industrial-900'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 图表容器 */}
      <div className="card p-6">
        {activeTab === 'line' && (
          <div ref={lineChartRef} className="w-full h-96" />
        )}
        {activeTab === 'bar' && (
          <div ref={barChartRef} className="w-full h-96" />
        )}
        {activeTab === 'pie' && (
          <div ref={pieChartRef} className="w-full h-96" />
        )}
      </div>

      {/* 图表信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">数据统计</h3>
          <div className="space-y-2">
            <p className="text-sm text-industrial-600">
              折线图数据点: <span className="font-medium text-industrial-900">
                {appStore.chartData.line.xAxis?.length || 0}
              </span>
            </p>
            <p className="text-sm text-industrial-600">
              柱状图类别: <span className="font-medium text-industrial-900">
                {appStore.chartData.bar.categories?.length || 0}
              </span>
            </p>
            <p className="text-sm text-industrial-600">
              饼图扇区: <span className="font-medium text-industrial-900">
                {appStore.chartData.pie.length || 0}
              </span>
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">图表特性</h3>
          <div className="space-y-2 text-sm text-industrial-600">
            <p>✅ 响应式设计</p>
            <p>✅ 交互式提示</p>
            <p>✅ 动画效果</p>
            <p>✅ 主题切换</p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">操作说明</h3>
          <div className="space-y-2 text-sm text-industrial-600">
            <p>🖱️ 鼠标悬停: 查看数据</p>
            <p>🖱️ 点击图例: 切换显示</p>
            <p>📱 触摸设备: 支持手势</p>
            <p>🔄 自动刷新: 实时数据</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(Charts); 