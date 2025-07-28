import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout';
import Dashboard from '../pages/Dashboard';
import ThreeScene from '../pages/ThreeScene';
import Charts from '../pages/Charts';
import LowCodeEditor from '../pages/LowCodeEditor';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'three',
        element: <ThreeScene />,
      },
      {
        path: 'charts',
        element: <Charts />,
      },
      {
        path: 'editor',
        element: <LowCodeEditor />,
      },
    ],
  },
]); 