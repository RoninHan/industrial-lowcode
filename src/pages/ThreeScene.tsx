import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { appStore } from '../stores';

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(10, 10, 10);

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 添加地面
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 添加网格辅助线
    const gridHelper = new THREE.GridHelper(20, 20);
    scene.add(gridHelper);

    // 添加一些3D对象
    const addCube = (x: number, y: number, z: number, color: number) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshLambertMaterial({ color });
      const cube = new THREE.Mesh(geometry, material);
      cube.position.set(x, y, z);
      cube.castShadow = true;
      cube.receiveShadow = true;
      scene.add(cube);
      return cube;
    };

    const addSphere = (x: number, y: number, z: number, color: number) => {
      const geometry = new THREE.SphereGeometry(0.5, 32, 32);
      const material = new THREE.MeshLambertMaterial({ color });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(x, y, z);
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      scene.add(sphere);
      return sphere;
    };

    // 添加一些示例对象
    const objects = [
      addCube(0, 0.5, 0, 0xff0000),
      addCube(2, 0.5, 0, 0x00ff00),
      addCube(-2, 0.5, 0, 0x0000ff),
      addSphere(0, 2, 2, 0xffff00),
      addSphere(2, 2, 2, 0xff00ff),
    ];

    appStore.setThreeScene(scene);
    appStore.threeObjects = objects;

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);

      // 旋转对象
      objects.forEach((obj, index) => {
        obj.rotation.x += 0.01;
        obj.rotation.y += 0.01;
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // 处理窗口大小变化
    const handleResize = () => {
      if (!mountRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const addRandomObject = () => {
    if (!sceneRef.current) return;

    const x = (Math.random() - 0.5) * 10;
    const y = Math.random() * 5 + 0.5;
    const z = (Math.random() - 0.5) * 10;
    const color = Math.random() * 0xffffff;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({ color });
    const cube = new THREE.Mesh(geometry, material);
    cube.position.set(x, y, z);
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    sceneRef.current.add(cube);
    appStore.addThreeObject(cube);
  };

  const clearObjects = () => {
    if (!sceneRef.current) return;
    
    appStore.threeObjects.forEach(obj => {
      sceneRef.current?.remove(obj);
    });
    appStore.threeObjects = [];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-industrial-900">3D场景</h1>
          <p className="text-industrial-600 mt-2">使用Three.js创建交互式3D场景</p>
        </div>
        
        <div className="flex space-x-3">
          <button onClick={addRandomObject} className="btn-primary">
            ➕ 添加对象
          </button>
          <button onClick={clearObjects} className="btn-secondary">
            🗑️ 清空场景
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div 
          ref={mountRef} 
          className="w-full h-96 bg-industrial-100"
          style={{ minHeight: '400px' }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">场景信息</h3>
          <div className="space-y-2">
            <p className="text-sm text-industrial-600">
              对象数量: <span className="font-medium text-industrial-900">{appStore.threeObjects.length}</span>
            </p>
            <p className="text-sm text-industrial-600">
              场景状态: <span className="font-medium text-green-600">运行中</span>
            </p>
            <p className="text-sm text-industrial-600">
              渲染器: <span className="font-medium text-industrial-900">WebGL</span>
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-industrial-900 mb-4">操作说明</h3>
          <div className="space-y-2 text-sm text-industrial-600">
            <p>🖱️ 鼠标左键: 旋转视角</p>
            <p>🖱️ 鼠标右键: 平移视角</p>
            <p>🖱️ 鼠标滚轮: 缩放</p>
            <p>📱 触摸设备: 支持手势操作</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(ThreeScene); 