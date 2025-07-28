import Mock from 'mockjs';

// 设置延迟
Mock.setup({
  timeout: '200-600'
});

// 用户相关接口
Mock.mock('/api/user/login', 'post', {
  code: 200,
  message: '登录成功',
  data: {
    token: '@guid',
    user: {
      id: '@id',
      username: '@name',
      email: '@email',
      avatar: '@image("100x100")',
      role: 'admin'
    }
  }
});

Mock.mock('/api/user/info', 'get', {
  code: 200,
  data: {
    id: '@id',
    username: '@name',
    email: '@email',
    avatar: '@image("100x100")',
    role: 'admin',
    permissions: ['dashboard', 'three', 'charts', 'editor']
  }
});

// 仪表板数据
Mock.mock('/api/dashboard/stats', 'get', {
  code: 200,
  data: {
    totalUsers: '@integer(1000, 5000)',
    totalProjects: '@integer(100, 500)',
    activeUsers: '@integer(500, 1000)',
    totalRevenue: '@float(100000, 500000, 2, 2)'
  }
});

// 图表数据
Mock.mock('/api/charts/line', 'get', {
  code: 200,
  data: {
    xAxis: ['1月', '2月', '3月', '4月', '5月', '6月'],
    series: [
      {
        name: '销售额',
        data: '@range(100, 1000, 100, 6)'
      },
      {
        name: '利润',
        data: '@range(50, 500, 50, 6)'
      }
    ]
  }
});

Mock.mock('/api/charts/bar', 'get', {
  code: 200,
  data: {
    categories: ['产品A', '产品B', '产品C', '产品D', '产品E'],
    series: [
      {
        name: '销量',
        data: '@range(100, 1000, 100, 5)'
      }
    ]
  }
});

Mock.mock('/api/charts/pie', 'get', {
  code: 200,
  data: [
    { name: '产品A', value: '@integer(100, 500)' },
    { name: '产品B', value: '@integer(100, 500)' },
    { name: '产品C', value: '@integer(100, 500)' },
    { name: '产品D', value: '@integer(100, 500)' },
    { name: '产品E', value: '@integer(100, 500)' }
  ]
});

// 3D场景数据
Mock.mock('/api/three/objects', 'get', {
  code: 200,
  data: {
    objects: [
      {
        id: '@id',
        type: 'cube',
        position: { x: '@integer(-10, 10)', y: '@integer(-10, 10)', z: '@integer(-10, 10)' },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '@color'
      },
      {
        id: '@id',
        type: 'sphere',
        position: { x: '@integer(-10, 10)', y: '@integer(-10, 10)', z: '@integer(-10, 10)' },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        color: '@color'
      }
    ]
  }
});

// 低代码组件数据
Mock.mock('/api/components', 'get', {
  code: 200,
  data: {
    components: [
      {
        id: '@id',
        name: '按钮',
        type: 'button',
        icon: 'button',
        props: {
          text: '按钮',
          type: 'primary',
          size: 'medium'
        }
      },
      {
        id: '@id',
        name: '输入框',
        type: 'input',
        icon: 'input',
        props: {
          placeholder: '请输入内容',
          type: 'text'
        }
      },
      {
        id: '@id',
        name: '表格',
        type: 'table',
        icon: 'table',
        props: {
          columns: [],
          data: []
        }
      }
    ]
  }
});

export default Mock; 