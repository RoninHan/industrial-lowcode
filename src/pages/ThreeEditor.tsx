import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

type TransformBoxProps = {
  width?: number;
  height?: number;
  onPosChanged?: (pos: THREE.Vector3) => void;
};


const ThreeEditor: React.FC<TransformBoxProps> = ({
  width = 800,
  height = 600,
  onPosChanged,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<TransformControls | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const frameIdRef = useRef<number | null>(null);

  const animate = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    frameIdRef.current = requestAnimationFrame(() => {
      orbitRef.current?.update();
      renderer.render(scene, camera);
      animate(scene, camera, renderer);
    });
  }, []);

  useEffect(() => {
    console.log('THREE_REVISION:', THREE.REVISION);
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(3, 3, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // 2. Helpers & Lights
    scene.add(new THREE.AxesHelper(5));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(hemi);

    // 3. Box mesh
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x156289 });
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    meshRef.current = mesh;
    scene.add(mesh);

    // 4. OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbitRef.current = orbit;

    // 5. TransformControls
    const tctrl = new TransformControls(camera, renderer.domElement);
    tctrl.attach(mesh);
    tctrl.setMode('translate');
    tctrl.setTranslationSnap(0.5); // 步进设置
    tctrl.showX = true;
    tctrl.showY = true;
    tctrl.showZ = true;

    // 切换 OrbitControls enabled 状态
    tctrl.addEventListener('dragging-changed', (evt) => {
      orbit.enabled = !evt.value;
    });

    // 监听物体变化
    tctrl.addEventListener('objectChange', () => {
      if (onPosChanged) onPosChanged(mesh.position.clone());
    });

    scene.add(tctrl.getHelper());
    controlsRef.current = tctrl;

    // 6. Start animation
    animate(scene, camera, renderer);

    // 7. Handle window resize
    const onWindowResize = () => {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', onWindowResize);

    // 8. Cleanup
    return () => {
      window.removeEventListener('resize', onWindowResize);
      renderer.domElement && container.removeChild(renderer.domElement);
      if (frameIdRef.current != null) cancelAnimationFrame(frameIdRef.current);
      tctrl.detach();
      scene.remove(tctrl.getHelper());
      tctrl.dispose();
      orbit.dispose();
      renderer.dispose();
    };
  }, [width, height, onPosChanged, animate]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, touchAction: 'none' }}
    />
  );
};

export default ThreeEditor;
