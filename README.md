# 工业低代码平台

一个基于React + TypeScript + Vite的现代化工业低代码平台，集成了Three.js 3D渲染、ECharts图表、拖拽式低代码编辑器等功能。

## 🚀 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式框架**: Tailwind CSS
- **状态管理**: MobX
- **路由管理**: React Router v6
- **HTTP客户端**: Axios
- **3D渲染**: Three.js
- **图表库**: ECharts
- **Mock数据**: Mock.js

## 📦 功能特性

### 🎮 3D场景
- 基于Three.js的3D场景渲染
- 支持添加、删除3D对象
- 交互式相机控制
- 实时动画效果

### 📊 图表展示
- 多种图表类型（折线图、柱状图、饼图）
- 响应式设计
- 交互式数据展示
- 实时数据更新

### ⚙️ 低代码编辑器
- 拖拽式组件库
- 可视化页面构建
- 实时属性编辑
- 组件预览功能

### 📱 现代化UI
- 响应式设计
- 深色/浅色主题切换
- 工业风格界面
- 流畅的动画效果

## 🛠️ 安装和运行

### 环境要求
- Node.js >= 20.0.0
- npm >= 10.0.0

### 安装依赖
```bash
cd industrial-lowcode
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 📁 项目结构

```
industrial-lowcode/
├── src/
│   ├── components/          # 公共组件
│   │   └── Layout.tsx      # 主布局组件
│   ├── pages/              # 页面组件
│   │   ├── Dashboard.tsx   # 仪表板
│   │   ├── ThreeEditor.tsx  # 3D场景
│   │   ├── Charts.tsx      # 图表页面
│   │   └── LowCodeEditor.tsx # 低代码编辑器
│   ├── stores/             # MobX状态管理
│   │   └── index.ts        # 应用状态
│   ├── services/           # 服务层
│   │   └── http.ts         # HTTP请求配置
│   ├── mock/               # Mock数据
│   │   └── index.ts        # Mock接口配置
│   ├── router/             # 路由配置
│   │   └── index.tsx       # 路由定义
│   ├── App.tsx             # 主应用组件
│   ├── main.tsx            # 应用入口
│   └── index.css           # 全局样式
├── public/                 # 静态资源
├── index.html              # HTML模板
├── package.json            # 项目配置
├── tailwind.config.js      # Tailwind配置
├── postcss.config.js       # PostCSS配置
├── tsconfig.json           # TypeScript配置
└── vite.config.ts          # Vite配置
```

## 🎯 主要功能

### 3D场景編輯導出
- 3D对象管理
- 场景交互控制
- 动态对象添加
- 场景状态监控

### 图表展示
- 多种图表类型
- 数据可视化
- 交互式操作
- 响应式布局

### 低代码编辑器
- 组件拖拽
- 属性编辑
- 实时预览
- 画布管理

## 🔧 配置说明

### Tailwind CSS
项目使用Tailwind CSS进行样式管理，配置文件位于 `tailwind.config.js`。

### Mock数据
Mock数据配置在 `src/mock/index.ts` 中，可以模拟各种API接口。

### 路由配置
路由配置在 `src/router/index.tsx` 中，支持嵌套路由和懒加载。

## 🚀 部署

### 构建
```bash
npm run build
```

### 部署到服务器
将 `dist` 目录下的文件部署到Web服务器即可。

## 📝 开发指南

### 添加新页面
1. 在 `src/pages/` 目录下创建新的页面组件
2. 在 `src/router/index.tsx` 中添加路由配置
3. 在 `src/components/Layout.tsx` 中添加导航菜单项

### 添加新组件
1. 在 `src/components/` 目录下创建组件
2. 使用TypeScript定义组件接口
3. 集成MobX状态管理（如需要）

### 添加新API
1. 在 `src/services/` 目录下添加API服务
2. 在 `src/mock/index.ts` 中添加Mock数据
3. 在相关组件中调用API


**工业低代码平台** - 让工业应用开发更简单、更高效！
