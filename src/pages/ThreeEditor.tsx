import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

type TransformBoxProps = {
  onPosChanged?: (pos: THREE.Vector3) => void;
  onExportGLTF?: (gltfData: any) => void;
  gridSize?: number;
  gridDivisions?: number;
};


const ThreeEditor: React.FC<TransformBoxProps> = ({
  onPosChanged,
  onExportGLTF,
  gridSize = 20,
  gridDivisions = 20,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<TransformControls | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const animationTimeRef = useRef<number>(0);
  const originalPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // 创建三个独立的TransformControls实例
  const translateControlsRef = useRef<TransformControls | null>(null);
  const rotateControlsRef = useRef<TransformControls | null>(null);
  const scaleControlsRef = useRef<TransformControls | null>(null);
  
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const [objects, setObjects] = useState<THREE.Mesh[]>([]); // 存储所有添加的物体
  const objectsRef = useRef<THREE.Mesh[]>([]); // 用于在useEffect中访问最新的objects数组
  const [selectedObject, setSelectedObject] = useState<THREE.Mesh | null>(null); // 当前选中的物体
  const selectedObjectRef = useRef<THREE.Mesh | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate'); // 变换模式

  // 获取当前活动的TransformControls
  const getCurrentControls = useCallback(() => {
    switch (transformMode) {
      case 'translate':
        return translateControlsRef.current;
      case 'rotate':
        return rotateControlsRef.current;
      case 'scale':
        return scaleControlsRef.current;
      default:
        return translateControlsRef.current;
    }
  }, [transformMode]);

  const animate = useCallback((scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer) => {
    frameIdRef.current = requestAnimationFrame(() => {
      orbitRef.current?.update();
      
      // 动画逻辑
      if (isAnimating && meshRef.current) {
        animationTimeRef.current += 0.016; // 约60fps
        updateCubeAnimation();
      }
      
      renderer.render(scene, camera);
      animate(scene, camera, renderer);
    });
  }, [isAnimating, transformMode]);

  // 立方体动画更新函数
  const updateCubeAnimation = useCallback(() => {
    if (!meshRef.current) return;

    const time = animationTimeRef.current;
    const cycleDuration = 8; // 一个完整循环8秒
    const progress = (time % cycleDuration) / cycleDuration;
    
    const originalPos = originalPositionRef.current;
    const moveDistance = 2; // 移动距离
    
    let x = originalPos.x;
    let y = originalPos.y;
    let z = originalPos.z;

    if (progress < 0.25) {
      // 阶段1: 向上移动 (0-25%)
      const t = progress / 0.25;
      y = originalPos.y + moveDistance * t;
    } else if (progress < 0.5) {
      // 阶段2: 向右移动 (25-50%)
      const t = (progress - 0.25) / 0.25;
      y = originalPos.y + moveDistance;
      x = originalPos.x + moveDistance * t;
    } else if (progress < 0.75) {
      // 阶段3: 向下移动 (50-75%)
      const t = (progress - 0.5) / 0.25;
      y = originalPos.y + moveDistance * (1 - t);
      x = originalPos.x + moveDistance;
    } else {
      // 阶段4: 向左返回原位 (75-100%)
      const t = (progress - 0.75) / 0.25;
      y = originalPos.y;
      x = originalPos.x + moveDistance * (1 - t);
    }

    meshRef.current.position.set(x, y, z);
    
    // 触发位置变化回调
    if (onPosChanged) {
      onPosChanged(meshRef.current.position.clone());
    }
  }, [onPosChanged]);

  // 开始/停止动画
  const toggleAnimation = useCallback(() => {
    setIsAnimating(prev => {
      const newState = !prev;
      if (newState) {
        animationTimeRef.current = 0;
        // 禁用变换控制器
        if (controlsRef.current) {
          controlsRef.current.enabled = false;
        }
      } else {
        // 启用变换控制器
        if (controlsRef.current) {
          controlsRef.current.enabled = true;
        }
      }
      return newState;
    });
  }, []);

  // 切换网格显示
  const toggleGrid = useCallback(() => {
    setShowGrid(prev => {
      const newState = !prev;
      if (gridRef.current && sceneRef.current) {
        gridRef.current.visible = newState;
      }
      return newState;
    });
  }, []);

  // 切换变换模式
  const setTransformModeHandler = useCallback((mode: 'translate' | 'rotate' | 'scale') => {
    console.log('准备切换到变换模式:', mode, '当前选中物体:', selectedObjectRef.current);
    
    setTransformMode(mode);
    
    if (selectedObjectRef.current) {
      // 禁用所有控制器
      if (translateControlsRef.current) translateControlsRef.current.enabled = false;
      if (rotateControlsRef.current) rotateControlsRef.current.enabled = false;
      if (scaleControlsRef.current) scaleControlsRef.current.enabled = false;
      
      // 启用对应的控制器（不重新attach）
      let currentControls = null;
      switch (mode) {
        case 'translate':
          currentControls = translateControlsRef.current;
          break;
        case 'rotate':
          currentControls = rotateControlsRef.current;
          break;
        case 'scale':
          currentControls = scaleControlsRef.current;
          break;
      }
      
      if (currentControls) {
        currentControls.enabled = true;
        controlsRef.current = currentControls; // 更新当前活动控制器引用
      }
      
      console.log('成功切换到变换模式:', mode);
    }
  }, []);

  // 处理容器尺寸变化
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    if (!container || !cameraRef.current || !rendererRef.current) return;
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current?.parentElement; // 获取整个ThreeEditor容器
    if (!container) return;

    if (!isFullscreen) {
      // 进入全屏
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    } else {
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }, [isFullscreen]);

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      
      // 全屏状态改变时触发resize
      setTimeout(() => {
        handleResize();
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [handleResize]);

  // 移除不必要的变换模式同步useEffect

  // 添加不同类型的物体
  const addObject = useCallback((type: 'cube' | 'sphere' | 'cylinder' | 'cone') => {
    if (!sceneRef.current) return;

    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    // 随机位置
    const x = (Math.random() - 0.5) * 8;
    const z = (Math.random() - 0.5) * 8;
    const y = Math.random() * 3 + 0.5;

    // 随机颜色
    const colors = [0x156289, 0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xffeaa7, 0xdda0dd, 0x98d8c8];
    const color = colors[Math.floor(Math.random() * colors.length)];

    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 32);
        break;
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    material = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);

    // 添加到场景
    sceneRef.current.add(mesh);

    // 更新状态
    setObjects(prev => {
      const newObjects = [...prev, mesh];
      objectsRef.current = newObjects;
      return newObjects;
    });

    // 自动选中新创建的物体
    if (translateControlsRef.current && rotateControlsRef.current && scaleControlsRef.current) {
      // 直接内联选择逻辑，避免依赖selectObject
      if (selectedObjectRef.current) {
        const material = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x000000);
      }
      
      setSelectedObject(mesh);
      selectedObjectRef.current = mesh;
      
      // 附加所有控制器到新物体
      translateControlsRef.current.attach(mesh);
      rotateControlsRef.current.attach(mesh);
      scaleControlsRef.current.attach(mesh);
      
      // 设置当前活动的控制器
      let currentControls = null;
      switch (transformMode) {
        case 'translate':
          currentControls = translateControlsRef.current;
          break;
        case 'rotate':
          currentControls = rotateControlsRef.current;
          break;
        case 'scale':
          currentControls = scaleControlsRef.current;
          break;
      }
      
      if (currentControls) {
        // 禁用所有控制器
        translateControlsRef.current.enabled = false;
        rotateControlsRef.current.enabled = false;
        scaleControlsRef.current.enabled = false;
        
        // 启用当前控制器
        currentControls.enabled = true;
        controlsRef.current = currentControls;
      }
      
      // 高亮新选中的物体
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x444444);
    }

    console.log(`添加了${type}，当前物体数量:`, objectsRef.current.length + 1); // +1 包含原始立方体
  }, [transformMode]);

  // 清空所有添加的物体
  const clearObjects = useCallback(() => {
    if (!sceneRef.current) return;

    // 从场景中移除所有添加的物体
    objectsRef.current.forEach(obj => {
      sceneRef.current?.remove(obj);
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    });

    // 更新状态
    setObjects([]);
    objectsRef.current = [];
    
    // 如果选中的是被删除的物体，重新选中原始立方体
    if (selectedObjectRef.current && selectedObjectRef.current !== meshRef.current) {
      // 直接内联选择逻辑，避免依赖selectObject
      if (meshRef.current && translateControlsRef.current && rotateControlsRef.current && scaleControlsRef.current) {
        // 清除之前的高亮
        if (selectedObjectRef.current) {
          const oldMaterial = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
          oldMaterial.emissive.setHex(0x000000);
        }
        
        setSelectedObject(meshRef.current);
        selectedObjectRef.current = meshRef.current;
        
        // 附加所有控制器到原始立方体
        translateControlsRef.current.attach(meshRef.current);
        rotateControlsRef.current.attach(meshRef.current);
        scaleControlsRef.current.attach(meshRef.current);
        
        // 设置当前活动的控制器
        let currentControls = null;
        switch (transformMode) {
          case 'translate':
            currentControls = translateControlsRef.current;
            break;
          case 'rotate':
            currentControls = rotateControlsRef.current;
            break;
          case 'scale':
            currentControls = scaleControlsRef.current;
            break;
        }
        
        if (currentControls) {
          // 禁用所有控制器
          translateControlsRef.current.enabled = false;
          rotateControlsRef.current.enabled = false;
          scaleControlsRef.current.enabled = false;
          
          // 启用当前控制器
          currentControls.enabled = true;
          controlsRef.current = currentControls;
        }
        
        // 高亮新选中的物体
        const material = meshRef.current.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x444444);
      }
    }
    
    console.log('已清空所有添加的物体');
  }, [transformMode]);

  // 选择物体并附加Transform控制器
  const selectObject = useCallback((mesh: THREE.Mesh | null) => {
    if (!mesh) return;

    // 取消之前选中物体的高亮
    if (selectedObjectRef.current) {
      const material = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x000000); // 移除发光效果
    }

    // 只有在选择不同物体时才重新附加控制器
    if (selectedObjectRef.current !== mesh) {
      // 更新状态
      setSelectedObject(mesh);
      selectedObjectRef.current = mesh;
      
      // 重新附加所有控制器到新物体
      if (translateControlsRef.current) translateControlsRef.current.attach(mesh);
      if (rotateControlsRef.current) rotateControlsRef.current.attach(mesh);
      if (scaleControlsRef.current) scaleControlsRef.current.attach(mesh);
    }
    
    // 设置当前活动的控制器
    const currentControls = getCurrentControls();
    if (currentControls) {
      controlsRef.current = currentControls;
    }
    
    // 高亮新选中的物体
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive.setHex(0x444444); // 添加发光效果表示选中
    
    console.log('选中物体:', mesh === meshRef.current ? '原始立方体' : '动态物体', '变换模式:', transformMode);
  }, [transformMode, getCurrentControls]);

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

    // 获取所有可点击的物体（原始立方体 + 动态添加的物体）
    const clickableObjects = [
      ...(meshRef.current ? [meshRef.current] : []),
      ...objectsRef.current
    ];

    const intersects = raycaster.intersectObjects(clickableObjects);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object as THREE.Mesh;
      selectObject(clickedObject);
    }
  }, [selectObject]);

  const exportToGLTF = useCallback(() => {
    if (!meshRef.current && objectsRef.current.length === 0) {
      console.error('没有可导出的网格对象');
      return;
    }
    
    console.log('开始导出GLTF...');
    const exporter = new GLTFExporter();
    
    // 创建一个临时场景，包含所有要导出的对象
    const exportScene = new THREE.Scene();
    
    // 添加原始立方体
    if (meshRef.current) {
      const meshClone = meshRef.current.clone();
      exportScene.add(meshClone);
    }
    
    // 添加所有动态创建的物体
    objectsRef.current.forEach(obj => {
      const objClone = obj.clone();
      exportScene.add(objClone);
    });
    
    console.log(`导出场景包含 ${exportScene.children.length} 个物体`);
    
    exporter.parse(
      exportScene,
      (gltf) => {
        console.log('GLTF导出成功:', gltf);
        if (onExportGLTF) {
          onExportGLTF(gltf);
        } else {
          // 如果没有回调函数，直接下载文件
          const dataStr = JSON.stringify(gltf, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = 'scene.gltf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          URL.revokeObjectURL(url);
          console.log('GLTF文件已下载');
        }
      },
      (error) => {
        console.error('GLTF导出失败:', error);
      },
      {
        binary: false,
        onlyVisible: true,
        truncateDrawRange: true,
        embedImages: true,
        animations: [],
        forceIndices: false,
        includeCustomExtensions: false
      }
    );
  }, [onExportGLTF]);

  useEffect(() => {
    console.log('THREE_REVISION:', THREE.REVISION);
    const container = containerRef.current;
    if (!container) return;

    // 获取容器尺寸
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(3, 3, 3);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Helpers & Lights
    scene.add(new THREE.AxesHelper(5));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(hemi);

    // 3. Grid Helper
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x888888, 0xcccccc);
    gridHelper.position.y = -0.5; // 稍微降低网格位置
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    // 3. Box mesh
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x156289 });
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    meshRef.current = mesh;
    scene.add(mesh);
    
    // 保存原始位置
    originalPositionRef.current = mesh.position.clone();

    // 4. OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbitRef.current = orbit;

    // 5. TransformControls - 创建三个独立的控制器
    // 移动控制器
    const translateCtrl = new TransformControls(camera, renderer.domElement);
    translateCtrl.attach(mesh);
    translateCtrl.setMode('translate');
    translateCtrl.setTranslationSnap(0.5);
    translateCtrl.showX = true;
    translateCtrl.showY = true;
    translateCtrl.showZ = true;
    translateCtrl.enabled = true; // 默认启用移动模式
    
    // 旋转控制器
    const rotateCtrl = new TransformControls(camera, renderer.domElement);
    rotateCtrl.attach(mesh);
    rotateCtrl.setMode('rotate');
    rotateCtrl.setRotationSnap(THREE.MathUtils.degToRad(15));
    rotateCtrl.showX = true;
    rotateCtrl.showY = true;
    rotateCtrl.showZ = true;
    rotateCtrl.enabled = false; // 默认禁用
    
    // 缩放控制器
    const scaleCtrl = new TransformControls(camera, renderer.domElement);
    scaleCtrl.attach(mesh);
    scaleCtrl.setMode('scale');
    scaleCtrl.setScaleSnap(0.1);
    scaleCtrl.showX = true;
    scaleCtrl.showY = true;
    scaleCtrl.showZ = true;
    scaleCtrl.enabled = false; // 默认禁用

    // 设置refs
    translateControlsRef.current = translateCtrl;
    rotateControlsRef.current = rotateCtrl;
    scaleControlsRef.current = scaleCtrl;
    controlsRef.current = translateCtrl; // 默认使用移动控制器

    // 为所有控制器添加事件监听器
    [translateCtrl, rotateCtrl, scaleCtrl].forEach(ctrl => {
      ctrl.addEventListener('dragging-changed', (evt) => {
        orbit.enabled = !evt.value;
      });

      ctrl.addEventListener('objectChange', () => {
        const currentMesh = selectedObjectRef.current;
        if (currentMesh && onPosChanged) {
          onPosChanged(currentMesh.position.clone());
        }
      });
    });

    // 将所有控制器helper添加到场景
    scene.add(translateCtrl.getHelper());
    scene.add(rotateCtrl.getHelper());
    scene.add(scaleCtrl.getHelper());

    // 默认选中原始立方体
    selectObject(mesh);

    // 添加鼠标点击事件监听器
    const handleClick = (event: MouseEvent) => {
      handleObjectClick(event);
    };
    renderer.domElement.addEventListener('click', handleClick);

    // 添加键盘事件监听器（快捷键）
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key.toLowerCase()) {
        case 'g': // G键 - 移动模式
          setTransformModeHandler('translate');
          break;
        case 'r': // R键 - 旋转模式
          setTransformModeHandler('rotate');
          break;
        case 's': // S键 - 缩放模式
          setTransformModeHandler('scale');
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // 6. Start animation
    animate(scene, camera, renderer);

    // 7. Handle container resize with ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // 8. Cleanup
    return () => {
      // 移除事件监听器
      renderer.domElement.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      
      resizeObserver.disconnect();
      renderer.domElement && container.removeChild(renderer.domElement);
      if (frameIdRef.current != null) cancelAnimationFrame(frameIdRef.current);
      
      // 清理所有控制器
      if (translateControlsRef.current) {
        translateControlsRef.current.detach();
        scene.remove(translateControlsRef.current.getHelper());
        translateControlsRef.current.dispose();
      }
      if (rotateControlsRef.current) {
        rotateControlsRef.current.detach();
        scene.remove(rotateControlsRef.current.getHelper());
        rotateControlsRef.current.dispose();
      }
      if (scaleControlsRef.current) {
        scaleControlsRef.current.detach();
        scene.remove(scaleControlsRef.current.getHelper());
        scaleControlsRef.current.dispose();
      }
      
      if (gridRef.current) {
        scene.remove(gridRef.current);
        gridRef.current.dispose();
      }
      // 清理动态添加的物体
      objectsRef.current.forEach(obj => {
        scene.remove(obj);
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      });
      orbit.dispose();
      renderer.dispose();
    };
  }, [onPosChanged, animate, exportToGLTF, updateCubeAnimation, toggleGrid, gridSize, gridDivisions, handleResize]);

  // 暴露导出功能
  const handleExportClick = () => {
    exportToGLTF();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxHeight: '100%', overflow: 'hidden' }}>
      {/* 顶部菜单栏 */}
      <div style={{
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #d9d9d9',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        minHeight: '48px',
        flexShrink: 0
      }}>
        {/* 文件菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>文件</span>
          <button 
            onClick={handleExportClick}
            style={{
              padding: '6px 12px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#1565c0';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#1976d2';
            }}
            title="导出当前场景为GLTF格式"
          >
            📁 导出GLTF
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 动画菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>动画</span>
          <button 
            onClick={toggleAnimation}
            style={{
              padding: '6px 12px',
              backgroundColor: isAnimating ? '#f44336' : '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseOver={(e) => {
              const hoverBg = isAnimating ? '#d32f2f' : '#388e3c';
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseOut={(e) => {
              const currentBg = isAnimating ? '#f44336' : '#4caf50';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title={isAnimating ? '停止立方体动画' : '开始立方体循环动画'}
          >
            {isAnimating ? '⏹️ 停止' : '▶️ 播放'}
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 物体菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>物体</span>
          <button 
            onClick={() => addObject('cube')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#9c27b0',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#7b1fa2';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#9c27b0';
            }}
            title="添加立方体"
          >
            🧊 立方体
          </button>
          <button 
            onClick={() => addObject('sphere')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#00bcd4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#0097a7';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#00bcd4';
            }}
            title="添加球体"
          >
            ⚽ 球体
          </button>
          <button 
            onClick={() => addObject('cylinder')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#795548',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#5d4037';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#795548';
            }}
            title="添加圆柱体"
          >
            🛢️ 圆柱
          </button>
          <button 
            onClick={() => addObject('cone')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#ff5722',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#d84315';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#ff5722';
            }}
            title="添加圆锥体"
          >
            🔺 圆锥
          </button>
          <button 
            onClick={clearObjects}
            style={{
              padding: '4px 8px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#d32f2f';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#f44336';
            }}
            title="清空所有添加的物体"
          >
            🗑️ 清空
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 变换菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>变换</span>
          <button 
            onClick={() => setTransformModeHandler('translate')}
            style={{
              padding: '4px 8px',
              backgroundColor: transformMode === 'translate' ? '#4caf50' : '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              if (transformMode !== 'translate') {
                e.currentTarget.style.backgroundColor = '#757575';
              }
            }}
            onMouseOut={(e) => {
              const currentBg = transformMode === 'translate' ? '#4caf50' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title="移动模式"
          >
            ↔️ 移动
          </button>
          <button 
            onClick={() => setTransformModeHandler('rotate')}
            style={{
              padding: '4px 8px',
              backgroundColor: transformMode === 'rotate' ? '#ff9800' : '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              if (transformMode !== 'rotate') {
                e.currentTarget.style.backgroundColor = '#757575';
              }
            }}
            onMouseOut={(e) => {
              const currentBg = transformMode === 'rotate' ? '#ff9800' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title="旋转模式"
          >
            🔄 旋转
          </button>
          <button 
            onClick={() => setTransformModeHandler('scale')}
            style={{
              padding: '4px 8px',
              backgroundColor: transformMode === 'scale' ? '#2196f3' : '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 'bold'
            }}
            onMouseOver={(e) => {
              if (transformMode !== 'scale') {
                e.currentTarget.style.backgroundColor = '#757575';
              }
            }}
            onMouseOut={(e) => {
              const currentBg = transformMode === 'scale' ? '#2196f3' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title="缩放模式"
          >
            📏 缩放
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 视图菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>视图</span>
          <button 
            onClick={toggleGrid}
            style={{
              padding: '6px 12px',
              backgroundColor: showGrid ? '#ff9800' : '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseOver={(e) => {
              const hoverBg = showGrid ? '#f57c00' : '#757575';
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseOut={(e) => {
              const currentBg = showGrid ? '#ff9800' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title={showGrid ? '隐藏地面网格' : '显示地面网格'}
          >
            {showGrid ? '🔳 网格' : '⬜ 网格'}
          </button>

          {/* 全屏按钮 */}
          <button
            onClick={toggleFullscreen}
            style={{
              padding: '6px 12px',
              backgroundColor: isFullscreen ? '#2196f3' : '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseOver={(e) => {
              const hoverBg = isFullscreen ? '#1976d2' : '#757575';
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseOut={(e) => {
              const currentBg = isFullscreen ? '#2196f3' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title={isFullscreen ? '退出全屏' : '进入全屏'}
          >
            {isFullscreen ? '🔙 退出' : '⛶ 全屏'}
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 状态信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: isAnimating ? '#ffebee' : '#e8f5e8',
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${isAnimating ? '#ffcdd2' : '#c8e6c9'}`
          }}>
            {isAnimating ? '🔄 动画运行中' : '⏸️ 静态模式'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: showGrid ? '#fff3e0' : '#f5f5f5',
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${showGrid ? '#ffcc02' : '#e0e0e0'}`
          }}>
            {showGrid ? '🔳 网格显示' : '⬜ 网格隐藏'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: isFullscreen ? '#e3f2fd' : '#f5f5f5',
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${isFullscreen ? '#bbdefb' : '#e0e0e0'}`
          }}>
            {isFullscreen ? '⛶ 全屏模式' : '🪟 窗口模式'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: '#f3e5f5',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '1px solid #ce93d8'
          }}>
            📊 物体数量: {objects.length + 1}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: '#fff8e1',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '1px solid #ffcc02'
          }}>
            🎯 选中: {selectedObject === meshRef.current ? '原始立方体' : '动态物体'}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: transformMode === 'translate' ? '#e8f5e8' : transformMode === 'rotate' ? '#fff3e0' : '#e3f2fd',
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${transformMode === 'translate' ? '#c8e6c9' : transformMode === 'rotate' ? '#ffcc02' : '#bbdefb'}`
          }}>
            🛠️ 模式: {transformMode === 'translate' ? '移动' : transformMode === 'rotate' ? '旋转' : '缩放'}
          </div>
        </div>
      </div>

      {/* 3D场景容器 */}
      <div
        ref={containerRef}
        style={{ 
          flex: 1,
          width: '100%',
          minHeight: 0, // 重要：允许flex子项收缩
          touchAction: 'none',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default ThreeEditor;
