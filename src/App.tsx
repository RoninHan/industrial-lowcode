import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { observer } from 'mobx-react';
import { appStore } from './stores';
import { router } from './router';
import './mock'; // 导入Mock数据

const App = observer(() => {
  return (
    <ConfigProvider
      theme={{
        algorithm:
          appStore.theme === 'dark'
            ? theme.darkAlgorithm
            : theme.defaultAlgorithm,
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  );
});

export default App;
