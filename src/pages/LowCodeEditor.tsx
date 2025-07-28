import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { appStore } from '../stores';
import http from '../services/http';

interface Component {
  id: string;
  name: string;
  type: string;
  icon: string;
  props: any;
}

const LowCodeEditor: React.FC = () => {
  const [components, setComponents] = useState<Component[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [canvas, setCanvas] = useState<any[]>([]);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    const fetchComponents = async () => {
      try {
        appStore.setLoading(true);
        const data = await http.get('/components');
        setComponents(data.data.components);
      } catch (error) {
        console.error('获取组件失败:', error);
      } finally {
        appStore.setLoading(false);
      }
    };

    fetchComponents();
  }, []);

  const handleDragStart = (e: React.DragEvent, component: Component) => {
    e.dataTransfer.setData('component', JSON.stringify(component));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentData = JSON.parse(e.dataTransfer.getData('component'));
    const newComponent = {
      ...componentData,
      id: `${componentData.type}_${Date.now()}`,
      position: { x: 0, y: 0 }
    };
    
    const newCanvas = [...canvas, newComponent];
    setCanvas(newCanvas);
    appStore.updateCanvasData(newCanvas);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleComponentClick = (component: any) => {
    setSelectedComponent(component);
    appStore.selectComponent(component);
  };

  const handlePropertyChange = (property: string, value: any) => {
    if (!selectedComponent) return;
    
    const updatedComponent = {
      ...selectedComponent,
      props: {
        ...selectedComponent.props,
        [property]: value
      }
    };
    
    const updatedCanvas = canvas.map(item => 
      item.id === selectedComponent.id ? updatedComponent : item
    );
    
    setCanvas(updatedCanvas);
    setSelectedComponent(updatedComponent);
    appStore.updateCanvasData(updatedCanvas);
  };

  const renderComponent = (component: any) => {
    switch (component.type) {
      case 'button':
        return (
          <button
            className={`btn-${component.props.type || 'primary'}`}
            style={{ fontSize: component.props.size === 'small' ? '12px' : '14px' }}
          >
            {component.props.text || '按钮'}
          </button>
        );
      case 'input':
        return (
          <input
            type={component.props.type || 'text'}
            placeholder={component.props.placeholder || '请输入内容'}
            className="input-field"
          />
        );
      case 'table':
        return (
          <div className="border border-industrial-200 rounded-lg p-4">
            <table className="w-full">
              <thead>
                <tr className="bg-industrial-50">
                  <th className="px-4 py-2 text-left">列1</th>
                  <th className="px-4 py-2 text-left">列2</th>
                  <th className="px-4 py-2 text-left">列3</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2 border-t">数据1</td>
                  <td className="px-4 py-2 border-t">数据2</td>
                  <td className="px-4 py-2 border-t">数据3</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      default:
        return <div className="p-4 bg-industrial-100 rounded">未知组件</div>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900">低代码编辑器</h1>
          <p className="text-industrial-600 mt-2">拖拽组件创建页面</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setIsPreview(!isPreview)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isPreview 
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
          >
            {isPreview ? '编辑模式' : '预览模式'}
          </button>
          <button className="btn-primary">
            💾 保存
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-96">
        {/* 组件库 */}
        <div className="col-span-3">
          <div className="card h-full">
            <h3 className="text-lg font-semibold text-industrial-900 mb-4">组件库</h3>
            <div className="space-y-2">
              {components.map((component) => (
                <div
                  key={component.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, component)}
                  className="flex items-center space-x-3 p-3 bg-industrial-50 rounded-lg cursor-move hover:bg-industrial-100 transition-colors"
                >
                  <span className="text-lg">{component.icon}</span>
                  <span className="text-sm font-medium text-industrial-700">
                    {component.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 画布 */}
        <div className="col-span-6">
          <div 
            className="card h-full bg-white border-2 border-dashed border-industrial-300"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <div className="flex items-center justify-center h-full">
              {canvas.length === 0 ? (
                <div className="text-center text-industrial-500">
                  <div className="text-4xl mb-2">📝</div>
                  <p>拖拽组件到此处开始创建页面</p>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {canvas.map((component) => (
                    <div
                      key={component.id}
                      onClick={() => handleComponentClick(component)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedComponent?.id === component.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-industrial-200 hover:border-industrial-300'
                      }`}
                    >
                      {renderComponent(component)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 属性面板 */}
        <div className="col-span-3">
          <div className="card h-full">
            <h3 className="text-lg font-semibold text-industrial-900 mb-4">属性面板</h3>
            {selectedComponent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-industrial-700 mb-1">
                    组件类型
                  </label>
                  <p className="text-sm text-industrial-600">{selectedComponent.name}</p>
                </div>
                
                {selectedComponent.type === 'button' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-industrial-700 mb-1">
                        按钮文本
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.props.text || ''}
                        onChange={(e) => handlePropertyChange('text', e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-industrial-700 mb-1">
                        按钮类型
                      </label>
                      <select
                        value={selectedComponent.props.type || 'primary'}
                        onChange={(e) => handlePropertyChange('type', e.target.value)}
                        className="input-field"
                      >
                        <option value="primary">主要</option>
                        <option value="secondary">次要</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-industrial-700 mb-1">
                        按钮大小
                      </label>
                      <select
                        value={selectedComponent.props.size || 'medium'}
                        onChange={(e) => handlePropertyChange('size', e.target.value)}
                        className="input-field"
                      >
                        <option value="small">小</option>
                        <option value="medium">中</option>
                        <option value="large">大</option>
                      </select>
                    </div>
                  </>
                )}
                
                {selectedComponent.type === 'input' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-industrial-700 mb-1">
                        占位符
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.props.placeholder || ''}
                        onChange={(e) => handlePropertyChange('placeholder', e.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-industrial-700 mb-1">
                        输入类型
                      </label>
                      <select
                        value={selectedComponent.props.type || 'text'}
                        onChange={(e) => handlePropertyChange('type', e.target.value)}
                        className="input-field"
                      >
                        <option value="text">文本</option>
                        <option value="password">密码</option>
                        <option value="email">邮箱</option>
                        <option value="number">数字</option>
                      </select>
                    </div>
                  </>
                )}
                
                <button
                  onClick={() => {
                    const newCanvas = canvas.filter(item => item.id !== selectedComponent.id);
                    setCanvas(newCanvas);
                    setSelectedComponent(null);
                    appStore.updateCanvasData(newCanvas);
                  }}
                  className="w-full btn-secondary text-red-600 hover:bg-red-50"
                >
                  🗑️ 删除组件
                </button>
              </div>
            ) : (
              <div className="text-center text-industrial-500 py-8">
                <div className="text-2xl mb-2">⚙️</div>
                <p>选择一个组件来编辑属性</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 画布信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">画布信息</h3>
          <div className="space-y-2">
            <p className="text-sm text-industrial-600">
              组件数量: <span className="font-medium text-industrial-900">{canvas.length}</span>
            </p>
            <p className="text-sm text-industrial-600">
              选中组件: <span className="font-medium text-industrial-900">
                {selectedComponent?.name || '无'}
              </span>
            </p>
            <p className="text-sm text-industrial-600">
              编辑模式: <span className="font-medium text-green-600">正常</span>
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">操作说明</h3>
          <div className="space-y-2 text-sm text-industrial-600">
            <p>🖱️ 拖拽组件到画布</p>
            <p>🖱️ 点击组件编辑属性</p>
            <p>🖱️ 双击组件快速编辑</p>
            <p>⌨️ 支持快捷键操作</p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">快捷键</h3>
          <div className="space-y-2 text-sm text-industrial-600">
            <p>Ctrl + S: 保存</p>
            <p>Ctrl + Z: 撤销</p>
            <p>Delete: 删除组件</p>
            <p>Ctrl + D: 复制组件</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(LowCodeEditor); 