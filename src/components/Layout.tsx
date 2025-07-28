import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Switch, Space } from 'antd';
import { observer } from 'mobx-react';
import { appStore } from '../stores';
import {
  DesktopOutlined,
  PieChartOutlined,
  FileOutlined,
  TeamOutlined,
  BulbOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer, Sider } = AntLayout;

const menuItems = [
  {
    key: '/',
    icon: <DesktopOutlined />,
    label: <Link to="/">仪表板</Link>,
  },
  {
    key: '/three',
    icon: <PieChartOutlined />,
    label: <Link to="/three">3D场景</Link>,
  },
  {
    key: '/charts',
    icon: <FileOutlined />,
    label: <Link to="/charts">图表</Link>,
  },
  {
    key: '/editor',
    icon: <TeamOutlined />,
    label: <Link to="/editor">编辑器</Link>,
  },
];

const Layout: React.FC = observer(() => {
  const location = useLocation();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider collapsible>
        <div className="h-8 m-4 bg-gray-700" />
        <Menu
          theme="dark"
          defaultSelectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Space>
            <BulbOutlined />
            <Switch
              checked={appStore.theme === 'dark'}
              onChange={appStore.toggleTheme}
            />
          </Space>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: '#fff',
              borderRadius: '8px',
            }}
          >
            <Outlet />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Industrial Lowcode ©{new Date().getFullYear()} Created by RoninHan
        </Footer>
      </AntLayout>
    </AntLayout>
  );
});

export default Layout;