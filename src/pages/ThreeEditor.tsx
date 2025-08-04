

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';

const ThreeEditor: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 场景
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
    camera.position.set(2, 2, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加一个立方体作为示例物体
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // 添加地面网格
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x888888); // size, divisions, color1, color2
    scene.add(gridHelper);

    // 轨道控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 启用阻尼效果（惯性效果）
    controls.dampingFactor = 0.05; // 阻尼系数
    controls.target.copy(cube.position); // 设置控制器目标为 cube 的位置
    controls.minDistance = 1; // 最小距离，防止摄像机钻进 cube
    controls.maxDistance = 20; // 最大距离

    // TransformControls 支持拖拽 cube
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.75; // 控制器大小
    transformControls.space = 'world'; // 使用世界坐标系
    transformControls.attach(cube); // 绑定 cube
    scene.add(transformControls as any);

    transformControls.addEventListener('mouseDown', () => {
      controls.enabled = false; // 拖拽时禁用 OrbitControls
    });

    transformControls.addEventListener('mouseUp', () => {
      controls.enabled = true; // 拖拽结束后启用 OrbitControls
    });

    // 拖拽结束时限制 cube 位置在 [-5, 5] 区间，并防止 NaN
    transformControls.addEventListener('dragging-changed', (event) => {
      if (!event.value) {
        const clamp = (v: number) => {
          if (!isFinite(v) || isNaN(v)) return 0;
          return Math.max(-5, Math.min(5, v));
        };
        cube.position.x = clamp(cube.position.x);
        cube.position.y = clamp(cube.position.y);
        // 限制 z 不能大于摄像机前方（防止 cube 跑到相机后面）
        const maxZ = camera.position.z - 0.5;
        cube.position.z = Math.min(clamp(cube.position.z), maxZ);
      }
    });


    // 点击 cube attach，点击空白 detach
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (transformControls.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const pointer = new THREE.Vector2(x, y);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObject(cube, false);
      if (intersects.length > 0) {
        transformControls.attach(cube);
      } else {
        transformControls.detach();
      }
    });

    let lastTime = performance.now();
    function animate(now?: number) {
      requestAnimationFrame(animate);
      const t = typeof now === 'number' ? now : performance.now();
      const delta = (t - lastTime) / 1000;
      lastTime = t;
      // 让 OrbitControls 始终以 cube 为中心
      controls.target.copy(cube.position);
      controls.update();
      transformControls.update(delta);
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      controls.dispose();
      transformControls.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div ref={mountRef} style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} />
  );
};

export default ThreeEditor;
