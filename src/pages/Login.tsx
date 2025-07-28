import React, { useState } from 'react';
import { Form, Input, Button, Checkbox, Card, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined, GlobalOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    console.log('Received values of form: ', values);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Placeholder for actual login logic
    if (values.username === 'admin' && values.password === 'password') {
      message.success('登录成功!');
      localStorage.setItem('token', 'fake-token'); // Set a fake token
      navigate('/');
    } else {
      message.error('用户名或密码错误!');
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(to right, #74ebd5, #acb6e5)',
    }}>
      <Card style={{
        width: 400,
        boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.1)',
        borderRadius: '10px',
      }}>
        <Space direction="vertical" align="center" style={{ width: '100%', marginBottom: 24 }}>
          <GlobalOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          <Title level={2}>工业低代码平台</Title>
        </Space>
        <Form
          name="normal_login"
          initialValues={{ remember: true, username: 'admin', password: 'password' }}
          onFinish={onFinish}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名 (admin)" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              type="password"
              placeholder="密码 (password)"
            />
          </Form.Item>
          <Form.Item>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
            <a style={{ float: 'right' }} href="">
              忘记密码
            </a>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ width: '100%' }} loading={loading}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
