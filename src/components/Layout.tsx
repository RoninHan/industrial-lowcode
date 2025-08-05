import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout as AntLayout,
  Menu,
  Switch,
  Space,
  Dropdown,
  Avatar,
  theme,
  Typography,
} from 'antd';
import { observer } from 'mobx-react';
import { appStore } from '../stores';
import {
  DesktopOutlined,
  PieChartOutlined,
  FileOutlined,
  TeamOutlined,
  BulbOutlined,
  UserOutlined,
  LogoutOutlined,
  GlobalOutlined,
} from '@ant-design/icons';

const { Header, Content, Footer, Sider } = AntLayout;
const { Title } = Typography;

const menuItems = [
  {
    key: '/',
    icon: <DesktopOutlined />,
    label: <Link to="/">仪表板</Link>,
  },
  {
    key: '/three-editor',
    icon: <PieChartOutlined />,
    label: <Link to="/three-editor">3D场景</Link>,
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
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  useEffect(() => {
    const token = localStorage.getItem('token');
    console.log('Token:', token);
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    console.log('User logged out');
    navigate('/login');
  };

  const userMenu = (
    <Menu>
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        退出登陆
      </Menu.Item>
    </Menu>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={value => setCollapsed(value)}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GlobalOutlined style={{ fontSize: 24, color: '#fff' }} />
          {!collapsed && (
            <Title
              level={4}
              style={{ color: '#fff', marginLeft: 8, marginBottom: 0 }}
            >
              工业低代码
            </Title>
          )}
        </div>
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
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <Space align="center" size="middle">
            <Space>
              <BulbOutlined />
              <Switch
                checked={appStore.theme === 'dark'}
                onChange={appStore.toggleTheme}
                checkedChildren="暗"
                unCheckedChildren="亮"
              />
            </Space>
            <Dropdown overlay={userMenu} placement="bottomRight">
              <Avatar style={{ cursor: 'pointer' }} icon={<UserOutlined />} />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: 24,
              flex: 1,
              minHeight: 'calc(100vh - 168px)',
              background: colorBgContainer,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Outlet />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          工业低代码平台 ©{new Date().getFullYear()} 由 RoninHan 创建
        </Footer>
      </AntLayout>
    </AntLayout>
  );
});

export default Layout;