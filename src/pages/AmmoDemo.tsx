
// 引入React及其hooks
import React, { use, useCallback, useEffect, useRef } from 'react';
// 正確引入 mobx store
import { threeStore } from '../stores/threeStore';
// 引入Ammo.js物理引擎
import Ammo from 'ammo.js';
// 引入Three.js用於3D渲染
import * as THREE from 'three';
// 引入Three.js的軌道控制器，支持滑鼠鏡頭移動
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { observer } from 'mobx-react-lite';



// 定義AmmoDemo組件
const AmmoDemo: React.FC = observer(function AmmoDemo() {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const frameIdRef = useRef<number | null>(null);

  const addBoxMeshToMobxAndScene = useCallback(() => {
    threeStore.addMesh('Box');
  }, []);

  // 处理鼠标点击事件选择物体
  const handleObjectClick = useCallback((event: MouseEvent) => {
    if (!cameraRef.current || !sceneRef.current) return;

    const canvas = event.target as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();

    // 计算鼠标在标准化设备坐标中的位置
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 射线投射
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // // 获取所有可点击的物体（仅动态添加的物体）
    // const clickableObjects = [...objectsRef.current];

    // const intersects = raycaster.intersectObjects(clickableObjects);

    // if (intersects.length > 0) {
    //   const clickedObject = intersects[0].object as THREE.Mesh;
    //   selectObject(clickedObject);
    // } else {
    //   // 如果点击空白区域，取消选择
    //   if (selectedObjectRef.current) {
    //     const material = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
    //     material.emissive.setHex(0x000000);
    //     setSelectedObject(null);
    //     selectedObjectRef.current = null;

    //     // // 隐藏所有控制器
    //     // if (translateControlsRef.current) {
    //     //   translateControlsRef.current.enabled = false;
    //     //   translateControlsRef.current.getHelper().visible = false;
    //     // }
    //     // if (rotateControlsRef.current) {
    //     //   rotateControlsRef.current.enabled = false;
    //     //   rotateControlsRef.current.getHelper().visible = false;
    //     // }
    //     // if (scaleControlsRef.current) {
    //     //   scaleControlsRef.current.enabled = false;
    //     //   scaleControlsRef.current.getHelper().visible = false;
    //     // }
    //   }
    // }
  }, []);

  const animate = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
      frameIdRef.current = requestAnimationFrame(() => {
        orbitRef.current?.update();
        
        renderer.render(scene, camera);
        animate(scene, camera, renderer);
      });
    }, []);


  useEffect(() => {
    if (!sceneRef.current) return;
    // 只保留 gridHelper
    sceneRef.current.children
      .filter(obj => obj.type === 'Mesh' && (obj.name.startsWith('Box') || obj.name.startsWith('Cylinder')))
      .forEach(obj => sceneRef.current!.remove(obj));
    // 重新加入 mobx 所有 mesh
    threeStore.meshArr.forEach(element => {
      const geometry = new THREE.BoxGeometry(
        element.props.width,
        element.props.height,
        element.props.width // 這裡用 width 當 depth，可根據 props 補充
      );
      const material = new THREE.MeshStandardMaterial({ color: element.props.material.color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = element.name;
      mesh.position.set(
        element.props.position.x,
        element.props.position.y,
        element.props.position.z
      );
      if (sceneRef.current) {
        sceneRef.current.add(mesh);
      }
      
    });
    }, [threeStore.meshArr.length, sceneRef.current]);


  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(3, 3, 3);
    cameraRef.current = camera;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // 3. Grid Helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
    gridHelper.position.y = -0.5; // 稍微降低网格位置
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    // 4. OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbitRef.current = orbit;

    const translateCtrl = new TransformControls(camera, renderer.domElement);
    translateCtrl.setMode('translate');
    translateCtrl.setTranslationSnap(0.5);
    translateCtrl.showX = true;
    translateCtrl.showY = true;
    translateCtrl.showZ = true;
    translateCtrl.enabled = false;

    // 添加鼠标点击事件监听器
    const handleClick = (event: MouseEvent) => {
      handleObjectClick(event);
    };
    renderer.domElement.addEventListener('click', handleClick);

    // 渲染循環
    animate(scene, camera, renderer);

    // 清理
    return () => {
      renderer.domElement.removeEventListener('click', handleClick);
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <button
        style={{ position: 'absolute', zIndex: 10, left: 20, top: 20 }}
        onClick={addBoxMeshToMobxAndScene}
      >增加集合體</button>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          touchAction: 'none',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
});

export default AmmoDemo; // 導出組件
