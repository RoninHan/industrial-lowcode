import { threeStore } from '../../stores/threeStore';
import './index.scss';
import { Menu as AntdMenu } from 'antd';

const items = [
  {
    label: 'Add',
    key: 'add',
    children: [
      {
        type: 'group',
        label: 'Mesh',
        children: [
          { label: '立方体', key: 'Box' },
          { label: '圆柱', key: 'Cylinder' },
        ],
      },
      {
        type: 'group',
        label: 'Light',
        children: [
          { label: '点光源', key: 'PointLight' },
          { label: '平行光', key: 'DirectionalLight' },
        ],
      },
    ],
  }
];


function Menu() {
  function handleClick(e: { key: string }) {
    if (e.key === 'Box' || e.key === 'Cylinder') {
      threeStore.addMesh(e.key as 'Box' | 'Cylinder');
    }
  }

  return <div className='Menu'>
    <AntdMenu mode="horizontal" onClick={handleClick} style={{height: 60}} items={items} />
  </div>
}

export default Menu;