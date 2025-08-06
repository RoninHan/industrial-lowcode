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

// 动画类型
type AnimationType = 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'moveForward' | 'moveBackward' | 
                    'rotateX' | 'rotateY' | 'rotateZ' | 'scaleUp' | 'scaleDown' | 'pause';

// 动画步骤接口
interface AnimationStep {
  id: string;
  type: AnimationType;
  duration: number; // 持续时间（秒）
  distance?: number; // 移动距离或旋转角度
  scale?: number; // 缩放倍数
}

// 动画序列接口
interface AnimationSequence {
  id: string;
  name: string;
  steps: AnimationStep[];
  isPlaying: boolean;
  currentStepIndex: number;
}

// 物体信息接口
interface ObjectInfo {
  id: string;
  name: string; // 添加名称字段
  type: 'cube' | 'sphere' | 'cylinder' | 'cone';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: number;
  mesh?: THREE.Mesh; // 运行时的mesh引用
  animations?: AnimationSequence[]; // 动画序列
}


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
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // 创建三个独立的TransformControls实例
  const translateControlsRef = useRef<TransformControls | null>(null);
  const rotateControlsRef = useRef<TransformControls | null>(null);
  const scaleControlsRef = useRef<TransformControls | null>(null);
  
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  const objectsRef = useRef<THREE.Mesh[]>([]); // 用于在useEffect中访问最新的objects数组
  const [selectedObject, setSelectedObject] = useState<THREE.Mesh | null>(null); // 当前选中的物体
  const selectedObjectRef = useRef<THREE.Mesh | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate'); // 变换模式
  
  // 新增：物体信息数组状态
  const [objectsInfo, setObjectsInfo] = useState<ObjectInfo[]>([]);
  const objectsInfoRef = useRef<ObjectInfo[]>([]);
  
  // 动画相关状态
  const [showAnimationPanel, setShowAnimationPanel] = useState<boolean>(true); // 显示动画面板
  const [draggedAnimationStep, setDraggedAnimationStep] = useState<AnimationStep | null>(null); // 拖拽的动画步骤
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null); // 拖拽悬停的位置
  const [currentAnimationSequence, setCurrentAnimationSequence] = useState<AnimationSequence | null>(null); // 当前正在播放的动画序列
  const [selectedAnimationStep, setSelectedAnimationStep] = useState<AnimationStep | null>(null); // 当前选中的动画步骤
  const animationFrameRef = useRef<number | null>(null); // 动画帧请求ID
  const animationStartTimeRef = useRef<number>(0); // 动画开始时间
  const animationInitialState = useRef<{position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3} | null>(null); // 动画初始状态
  
  // 动画参数状态 - 用于创建新步骤和编辑选中步骤
  const [animationDuration, setAnimationDuration] = useState<string>('1.0');
  const [animationDistance, setAnimationDistance] = useState<string>('1.0'); 
  const [animationScale, setAnimationScale] = useState<string>('1.2');
  
  // 当选中步骤改变时，更新参数输入框的值
  useEffect(() => {
    if (selectedAnimationStep) {
      setAnimationDuration(selectedAnimationStep.duration.toString());
      setAnimationDistance((selectedAnimationStep.distance || 1).toString());
      setAnimationScale((selectedAnimationStep.scale || 1.2).toString());
    }
  }, [selectedAnimationStep]);
  
  // 当切换动画序列时，清除选中的步骤
  useEffect(() => {
    setSelectedAnimationStep(null);
  }, [currentAnimationSequence]);
  
  // 更新选中动画步骤的参数
  const updateSelectedAnimationStep = useCallback((property: 'duration' | 'distance' | 'scale', value: number) => {
    if (!selectedAnimationStep || !currentAnimationSequence) return;
    
    // 更新步骤属性
    if (property === 'duration') {
      selectedAnimationStep.duration = value;
    } else if (property === 'distance') {
      selectedAnimationStep.distance = value;
    } else if (property === 'scale') {
      selectedAnimationStep.scale = value;
    }
    
    // 触发重新渲染
    setObjectsInfo([...objectsInfoRef.current]);
  }, [selectedAnimationStep, currentAnimationSequence]);
  
  // 拖拽开始处理
  const handleDragStart = useCallback((e: React.DragEvent, step: AnimationStep, index: number) => {
    setDraggedAnimationStep(step);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', `步骤 ${index + 1}`);
    
    // 添加拖拽样式
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  }, []);
  
  // 拖拽悬停处理
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);
  
  // 拖拽离开处理
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);
  
  // 拖拽结束处理
  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedAnimationStep(null);
    setDragOverIndex(null);
  }, []);
  
  // 放置处理
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedAnimationStep || !currentAnimationSequence) return;
    
    const steps = currentAnimationSequence.steps;
    const draggedIndex = steps.findIndex(step => step.id === draggedAnimationStep.id);
    
    if (draggedIndex === -1 || draggedIndex === targetIndex) return;
    
    // 移动步骤
    const [draggedStep] = steps.splice(draggedIndex, 1);
    steps.splice(targetIndex, 0, draggedStep);
    
    // 更新状态
    setObjectsInfo([...objectsInfoRef.current]);
    setDragOverIndex(null);
    
    console.log(`步骤已移动: 从位置 ${draggedIndex + 1} 到位置 ${targetIndex + 1}`);
  }, [draggedAnimationStep, currentAnimationSequence]);
  
  // 添加动画序列到选中物体
  const addAnimationSequence = useCallback((name: string) => {
    if (!selectedObject) return;
    
    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObject);
    if (!objectInfo) return;
    
    const newSequence: AnimationSequence = {
      id: `seq_${Date.now()}`,
      name,
      steps: [],
      isPlaying: false,
      currentStepIndex: 0
    };
    
    if (!objectInfo.animations) {
      objectInfo.animations = [];
    }
    objectInfo.animations.push(newSequence);
    
    setObjectsInfo([...objectsInfoRef.current]);
    console.log(`已添加动画序列: ${name}`);
  }, [selectedObject]);
  
  // 添加动画步骤到当前选中的序列
  const addAnimationStep = useCallback((type: AnimationType, duration: number = 1, value: number = 1) => {
    if (!selectedObject || !currentAnimationSequence) return;
    
    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObject);
    if (!objectInfo || !objectInfo.animations) return;
    
    const sequence = objectInfo.animations.find(seq => seq.id === currentAnimationSequence.id);
    if (!sequence) return;
    
    const newStep: AnimationStep = {
      id: `step_${Date.now()}`,
      type,
      duration,
      distance: (type.startsWith('move') || type.startsWith('rotate')) ? value : undefined,
      scale: (type === 'scaleUp' || type === 'scaleDown') ? value : undefined
    };
    
    sequence.steps.push(newStep);
    setObjectsInfo([...objectsInfoRef.current]);
    console.log(`已添加动画步骤: ${type}, 时长: ${duration}秒, 参数: ${value}`);
  }, [selectedObject, currentAnimationSequence]);
  
  // 播放动画序列
  const playAnimationSequence = useCallback((sequence: AnimationSequence) => {
    if (!selectedObject || sequence.steps.length === 0) return;
    
    // 保存初始状态
    animationInitialState.current = {
      position: selectedObject.position.clone(),
      rotation: selectedObject.rotation.clone(),
      scale: selectedObject.scale.clone()
    };
    
    sequence.isPlaying = true;
    sequence.currentStepIndex = 0;
    setCurrentAnimationSequence(sequence);
    animationStartTimeRef.current = Date.now();
    
    const playStep = (stepIndex: number) => {
      if (stepIndex >= sequence.steps.length) {
        // 动画序列完成
        sequence.isPlaying = false;
        setCurrentAnimationSequence(null);
        console.log('动画序列播放完成');
        return;
      }
      
      const step = sequence.steps[stepIndex];
      const startTime = Date.now();
      const startPosition = selectedObject.position.clone();
      const startRotation = selectedObject.rotation.clone();
      const startScale = selectedObject.scale.clone();
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = Math.min(elapsed / step.duration, 1);
        
        // 应用动画变换
        switch (step.type) {
          case 'moveUp':
            selectedObject.position.y = startPosition.y + (step.distance || 1) * progress;
            break;
          case 'moveDown':
            selectedObject.position.y = startPosition.y - (step.distance || 1) * progress;
            break;
          case 'moveLeft':
            selectedObject.position.x = startPosition.x - (step.distance || 1) * progress;
            break;
          case 'moveRight':
            selectedObject.position.x = startPosition.x + (step.distance || 1) * progress;
            break;
          case 'moveForward':
            selectedObject.position.z = startPosition.z - (step.distance || 1) * progress;
            break;
          case 'moveBackward':
            selectedObject.position.z = startPosition.z + (step.distance || 1) * progress;
            break;
          case 'rotateX':
            selectedObject.rotation.x = startRotation.x + (step.distance || Math.PI / 2) * progress;
            break;
          case 'rotateY':
            selectedObject.rotation.y = startRotation.y + (step.distance || Math.PI / 2) * progress;
            break;
          case 'rotateZ':
            selectedObject.rotation.z = startRotation.z + (step.distance || Math.PI / 2) * progress;
            break;
          case 'scaleUp':
            const upScale = step.scale || 1.2;
            selectedObject.scale.setScalar(startScale.x + (upScale - startScale.x) * progress);
            break;
          case 'scaleDown':
            const downScale = step.scale || 0.8;
            selectedObject.scale.setScalar(startScale.x + (downScale - startScale.x) * progress);
            break;
        }
        
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          // 当前步骤完成，播放下一步
          sequence.currentStepIndex = stepIndex + 1;
          playStep(stepIndex + 1);
        }
      };
      
      if (step.type !== 'pause') {
        animate();
      } else {
        // 暂停步骤
        setTimeout(() => playStep(stepIndex + 1), (step.duration || 1) * 1000);
      }
    };
    
    playStep(0);
  }, [selectedObject]);
  
  // 停止动画
  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (currentAnimationSequence) {
      currentAnimationSequence.isPlaying = false;
      setCurrentAnimationSequence(null);
    }
    
    console.log('动画已停止');
  }, [currentAnimationSequence]);
  
  // 重置动画（回到初始状态）
  const resetAnimation = useCallback(() => {
    stopAnimation();
    
    if (selectedObject && animationInitialState.current) {
      selectedObject.position.copy(animationInitialState.current.position);
      selectedObject.rotation.copy(animationInitialState.current.rotation);
      selectedObject.scale.copy(animationInitialState.current.scale);
      
      // 更新物体信息
      const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObject);
      if (objectInfo) {
        objectInfo.position = {
          x: selectedObject.position.x,
          y: selectedObject.position.y,
          z: selectedObject.position.z
        };
        objectInfo.rotation = {
          x: selectedObject.rotation.x,
          y: selectedObject.rotation.y,
          z: selectedObject.rotation.z
        };
        objectInfo.scale = {
          x: selectedObject.scale.x,
          y: selectedObject.scale.y,
          z: selectedObject.scale.z
        };
        setObjectsInfo([...objectsInfoRef.current]);
      }
      
      console.log('动画已重置到初始状态');
    }
  }, [selectedObject, stopAnimation]);
  
  // 数据查看功能状态
  const [showDataPanel, setShowDataPanel] = useState<boolean>(false);

  // 属性编辑面板状态
  const [showPropertiesPanel, setShowPropertiesPanel] = useState<boolean>(true);

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
      
      renderer.render(scene, camera);
      animate(scene, camera, renderer);
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
      // 禁用所有控制器并隐藏helper
      if (translateControlsRef.current) {
        translateControlsRef.current.enabled = false;
        translateControlsRef.current.getHelper().visible = false;
      }
      if (rotateControlsRef.current) {
        rotateControlsRef.current.enabled = false;
        rotateControlsRef.current.getHelper().visible = false;
      }
      if (scaleControlsRef.current) {
        scaleControlsRef.current.enabled = false;
        scaleControlsRef.current.getHelper().visible = false;
      }
      
      // 启用对应的控制器并显示helper
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
        // 启用控制器并显示helper
        currentControls.enabled = true;
        currentControls.getHelper().visible = true;
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

  // 創建UUID
  const createUUID = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }, []);

  // 更新物体信息
  const updateObjectInfo = useCallback((mesh: THREE.Mesh) => {
    const objectInfo = objectsInfoRef.current.find(info => info.mesh === mesh);
    if (objectInfo) {
      // 更新位置、旋转、缩放信息
      objectInfo.position = {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z
      };
      objectInfo.rotation = {
        x: mesh.rotation.x,
        y: mesh.rotation.y,
        z: mesh.rotation.z
      };
      objectInfo.scale = {
        x: mesh.scale.x,
        y: mesh.scale.y,
        z: mesh.scale.z
      };
      
      // 更新状态
      setObjectsInfo([...objectsInfoRef.current]);
      
      console.log('更新物体信息:', objectInfo.id, {
        position: objectInfo.position,
        rotation: objectInfo.rotation,
        scale: objectInfo.scale
      });
    }
  }, []);

  // 更新选中物体的属性
  const updateSelectedObjectProperty = useCallback((
    property: 'name' | 'position' | 'rotation' | 'scale', 
    axis: 'x' | 'y' | 'z' | null, 
    value: string | number
  ) => {
    if (!selectedObjectRef.current) return;

    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObjectRef.current);
    if (!objectInfo) return;

    const mesh = selectedObjectRef.current;
    
    if (property === 'name') {
      objectInfo.name = value as string;
    } else if (axis) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return;

      // 更新物体信息
      (objectInfo[property] as any)[axis] = numValue;

      // 更新mesh的实际属性
      if (property === 'position') {
        mesh.position[axis] = numValue;
      } else if (property === 'rotation') {
        mesh.rotation[axis] = numValue;
      } else if (property === 'scale') {
        mesh.scale[axis] = numValue;
      }
    }

    // 更新状态
    setObjectsInfo([...objectsInfoRef.current]);
  }, []);

  // 导出物体数据为JSON
  const exportObjectsData = useCallback(() => {
    const exportData = objectsInfo.map(info => ({
      id: info.id,
      name: info.name,
      type: info.type,
      position: info.position,
      rotation: info.rotation,
      scale: info.scale,
      color: info.color
    }));
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `scene-data-${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    console.log('场景数据已导出为JSON文件');
  }, [objectsInfo]);

  // 计算场景统计信息
  const getSceneStats = useCallback(() => {
    const stats = {
      totalObjects: objectsInfo.length,
      objectTypes: {} as Record<string, number>,
      bounds: {
        minX: Infinity, maxX: -Infinity,
        minY: Infinity, maxY: -Infinity,
        minZ: Infinity, maxZ: -Infinity
      },
      totalVertices: 0,
      totalFaces: 0
    };

    objectsInfo.forEach(info => {
      // 统计物体类型
      stats.objectTypes[info.type] = (stats.objectTypes[info.type] || 0) + 1;
      
      // 计算边界
      stats.bounds.minX = Math.min(stats.bounds.minX, info.position.x);
      stats.bounds.maxX = Math.max(stats.bounds.maxX, info.position.x);
      stats.bounds.minY = Math.min(stats.bounds.minY, info.position.y);
      stats.bounds.maxY = Math.max(stats.bounds.maxY, info.position.y);
      stats.bounds.minZ = Math.min(stats.bounds.minZ, info.position.z);
      stats.bounds.maxZ = Math.max(stats.bounds.maxZ, info.position.z);
      
      // 估算顶点和面数（基于物体类型的标准几何体）
      if (info.mesh) {
        const geometry = info.mesh.geometry;
        if (geometry.attributes.position) {
          stats.totalVertices += geometry.attributes.position.count;
        }
        if (geometry.index) {
          stats.totalFaces += geometry.index.count / 3;
        }
      }
    });

    // 处理无物体的情况
    if (objectsInfo.length === 0) {
      stats.bounds = {
        minX: 0, maxX: 0,
        minY: 0, maxY: 0,
        minZ: 0, maxZ: 0
      };
    }

    return stats;
  }, [objectsInfo]);

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

    // 生成唯一ID
    const objectId = createUUID();
    
    // 创建物体信息
    const objectInfo: ObjectInfo = {
      id: objectId,
      name: `${type}_${objectId.slice(0, 8)}`, // 默认名称
      type,
      position: { x, y, z },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      color,
      mesh
    };

    // 添加到场景
    sceneRef.current.add(mesh);

    // 更新物体引用数组
    objectsRef.current = [...objectsRef.current, mesh];
    
    // 更新物体信息数组
    setObjectsInfo(prev => {
      const newObjectsInfo = [...prev, objectInfo];
      objectsInfoRef.current = newObjectsInfo;
      return newObjectsInfo;
    });

    // 自动选中新创建的物体 - 使用requestAnimationFrame确保mesh已经添加到场景
    if (translateControlsRef.current && rotateControlsRef.current && scaleControlsRef.current) {
      requestAnimationFrame(() => {
        // 直接内联选择逻辑，避免依赖selectObject
        if (selectedObjectRef.current) {
          const material = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
          material.emissive.setHex(0x000000);
        }
        
        setSelectedObject(mesh);
        selectedObjectRef.current = mesh;
        
        // 附加所有控制器到新物体 - 确保mesh在场景中
        if (translateControlsRef.current && mesh.parent) translateControlsRef.current.attach(mesh);
        if (rotateControlsRef.current && mesh.parent) rotateControlsRef.current.attach(mesh);
        if (scaleControlsRef.current && mesh.parent) scaleControlsRef.current.attach(mesh);
        
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
          // 禁用所有控制器并隐藏helper
          if (translateControlsRef.current) {
            translateControlsRef.current.enabled = false;
            translateControlsRef.current.getHelper().visible = false;
          }
          if (rotateControlsRef.current) {
            rotateControlsRef.current.enabled = false;
            rotateControlsRef.current.getHelper().visible = false;
          }
          if (scaleControlsRef.current) {
            scaleControlsRef.current.enabled = false;
            scaleControlsRef.current.getHelper().visible = false;
          }
          
          // 启用当前控制器并显示helper
          currentControls.enabled = true;
          currentControls.getHelper().visible = true;
          controlsRef.current = currentControls;
        }
        
        // 高亮新选中的物体
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x444444);
      });
    }

    console.log(`添加了${type}，当前物体数量:`, objectsInfoRef.current.length, '物体ID:', objectId);
  }, [transformMode, createUUID]);

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
    objectsRef.current = [];
    
    // 清空物体信息数组
    setObjectsInfo([]);
    objectsInfoRef.current = [];
    
    // 取消选择
    if (selectedObjectRef.current) {
      const material = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
      material.emissive.setHex(0x000000);
      setSelectedObject(null);
      selectedObjectRef.current = null;
      
      // 隐藏所有控制器
      if (translateControlsRef.current) {
        translateControlsRef.current.enabled = false;
        translateControlsRef.current.getHelper().visible = false;
      }
      if (rotateControlsRef.current) {
        rotateControlsRef.current.enabled = false;
        rotateControlsRef.current.getHelper().visible = false;
      }
      if (scaleControlsRef.current) {
        scaleControlsRef.current.enabled = false;
        scaleControlsRef.current.getHelper().visible = false;
      }
    }
    
    console.log('已清空所有添加的物体和物体信息');
  }, []);

  // 从JSON数据恢复场景
  const restoreSceneFromData = useCallback((objectsData: Omit<ObjectInfo, 'mesh'>[]) => {
    if (!sceneRef.current) return;
    
    console.log('开始恢复场景，物体数量:', objectsData.length);
    
    // 先清空现有物体
    clearObjects();
    
    // 重建每个物体
    objectsData.forEach(data => {
      let geometry: THREE.BufferGeometry;
      
      switch (data.type) {
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
      
      const material = new THREE.MeshStandardMaterial({ color: data.color });
      const mesh = new THREE.Mesh(geometry, material);
      
      // 应用保存的变换
      mesh.position.set(data.position.x, data.position.y, data.position.z);
      mesh.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
      mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
      
      // 创建物体信息
      const objectInfo: ObjectInfo = {
        ...data,
        name: data.name || `${data.type}_${data.id.slice(0, 8)}`, // 如果没有名称则生成默认名称
        mesh
      };
      
      // 添加到场景
      sceneRef.current!.add(mesh);
      
      // 更新物体引用数组
      objectsRef.current = [...objectsRef.current, mesh];
      
      // 更新物体信息数组
      setObjectsInfo(prev => {
        const newObjectsInfo = [...prev, objectInfo];
        objectsInfoRef.current = newObjectsInfo;
        return newObjectsInfo;
      });
    });
    
    console.log('场景恢复完成');
  }, [clearObjects]);

  // 从JSON文件导入物体数据
  const importObjectsData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const jsonData = JSON.parse(e.target?.result as string);
            if (Array.isArray(jsonData)) {
              restoreSceneFromData(jsonData);
              console.log('成功从JSON文件导入场景数据');
            } else {
              console.error('无效的JSON格式');
            }
          } catch (error) {
            console.error('解析JSON文件失败:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [restoreSceneFromData]);

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
      
      // 使用requestAnimationFrame确保mesh在场景中
      requestAnimationFrame(() => {
        // 重新附加所有控制器到新物体
        if (translateControlsRef.current && mesh.parent) translateControlsRef.current.attach(mesh);
        if (rotateControlsRef.current && mesh.parent) rotateControlsRef.current.attach(mesh);
        if (scaleControlsRef.current && mesh.parent) scaleControlsRef.current.attach(mesh);
      });
    }
    
    // 设置当前活动的控制器
    const currentControls = getCurrentControls();
    if (currentControls) {
      // 禁用所有控制器并隐藏helper
      if (translateControlsRef.current) {
        translateControlsRef.current.enabled = false;
        translateControlsRef.current.getHelper().visible = false;
      }
      if (rotateControlsRef.current) {
        rotateControlsRef.current.enabled = false;
        rotateControlsRef.current.getHelper().visible = false;
      }
      if (scaleControlsRef.current) {
        scaleControlsRef.current.enabled = false;
        scaleControlsRef.current.getHelper().visible = false;
      }
      
      // 启用当前模式的控制器并显示helper
      currentControls.enabled = true;
      currentControls.getHelper().visible = true;
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

    // 获取所有可点击的物体（仅动态添加的物体）
    const clickableObjects = [...objectsRef.current];

    const intersects = raycaster.intersectObjects(clickableObjects);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object as THREE.Mesh;
      selectObject(clickedObject);
    } else {
      // 如果点击空白区域，取消选择
      if (selectedObjectRef.current) {
        const material = selectedObjectRef.current.material as THREE.MeshStandardMaterial;
        material.emissive.setHex(0x000000);
        setSelectedObject(null);
        selectedObjectRef.current = null;
        
        // 隐藏所有控制器
        if (translateControlsRef.current) {
          translateControlsRef.current.enabled = false;
          translateControlsRef.current.getHelper().visible = false;
        }
        if (rotateControlsRef.current) {
          rotateControlsRef.current.enabled = false;
          rotateControlsRef.current.getHelper().visible = false;
        }
        if (scaleControlsRef.current) {
          scaleControlsRef.current.enabled = false;
          scaleControlsRef.current.getHelper().visible = false;
        }
      }
    }
  }, [selectObject]);

  const exportToGLTF = useCallback(() => {
    if (objectsRef.current.length === 0) {
      console.error('没有可导出的网格对象');
      return;
    }
    
    console.log('开始导出GLTF...');
    const exporter = new GLTFExporter();
    
    // 创建一个临时场景，包含所有要导出的对象
    const exportScene = new THREE.Scene();
    
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
    // scene.add(new THREE.AxesHelper(5)); // 隐藏轴向线
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(hemi);

    // 3. Grid Helper
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x888888, 0xcccccc);
    gridHelper.position.y = -0.5; // 稍微降低网格位置
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    // 4. OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbitRef.current = orbit;

    // 5. TransformControls - 创建三个独立的控制器
    // 移动控制器
    const translateCtrl = new TransformControls(camera, renderer.domElement);
    translateCtrl.setMode('translate');
    translateCtrl.setTranslationSnap(0.5);
    translateCtrl.showX = true;
    translateCtrl.showY = true;
    translateCtrl.showZ = true;
    translateCtrl.enabled = false; // 默认禁用，等待选择物体
    
    // 旋转控制器
    const rotateCtrl = new TransformControls(camera, renderer.domElement);
    rotateCtrl.setMode('rotate');
    rotateCtrl.setRotationSnap(THREE.MathUtils.degToRad(15));
    rotateCtrl.showX = true;
    rotateCtrl.showY = true;
    rotateCtrl.showZ = true;
    rotateCtrl.enabled = false; // 默认禁用
    
    // 缩放控制器
    const scaleCtrl = new TransformControls(camera, renderer.domElement);
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
        // 更新物体信息
        if (currentMesh) {
          updateObjectInfo(currentMesh);
        }
      });
    });

    // 将所有控制器helper添加到场景
    scene.add(translateCtrl.getHelper());
    scene.add(rotateCtrl.getHelper());
    scene.add(scaleCtrl.getHelper());

    // 设置初始可见性 - 默认隐藏所有控制器
    translateCtrl.getHelper().visible = false;
    rotateCtrl.getHelper().visible = false;
    scaleCtrl.getHelper().visible = false;

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
  }, [onPosChanged, animate, exportToGLTF, toggleGrid, gridSize, gridDivisions, handleResize]);

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

          {/* 属性面板按钮 */}
          <button
            onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}
            style={{
              padding: '6px 12px',
              backgroundColor: showPropertiesPanel ? '#4caf50' : '#9e9e9e',
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
              const hoverBg = showPropertiesPanel ? '#388e3c' : '#757575';
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseOut={(e) => {
              const currentBg = showPropertiesPanel ? '#4caf50' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title={showPropertiesPanel ? '隐藏属性面板' : '显示属性面板'}
          >
            {showPropertiesPanel ? '🔧 隐藏属性' : '🔧 属性面板'}
          </button>
          
          {/* 动画面板按钮 */}
          <button
            onClick={() => setShowAnimationPanel(!showAnimationPanel)}
            style={{
              padding: '6px 12px',
              backgroundColor: showAnimationPanel ? '#ff9800' : '#9e9e9e',
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
              const hoverBg = showAnimationPanel ? '#f57c00' : '#757575';
              e.currentTarget.style.backgroundColor = hoverBg;
            }}
            onMouseOut={(e) => {
              const currentBg = showAnimationPanel ? '#ff9800' : '#9e9e9e';
              e.currentTarget.style.backgroundColor = currentBg;
            }}
            title={showAnimationPanel ? '隐藏动画面板' : '显示动画面板'}
          >
            {showAnimationPanel ? '🎬 隐藏动画' : '🎬 动画面板'}
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 调试菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>数据</span>
          <button 
            onClick={() => setShowDataPanel(!showDataPanel)}
            style={{
              padding: '6px 12px',
              backgroundColor: showDataPanel ? '#4caf50' : '#607d8b',
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
              const hoverColor = showDataPanel ? '#388e3c' : '#455a64';
              e.currentTarget.style.backgroundColor = hoverColor;
            }}
            onMouseOut={(e) => {
              const currentColor = showDataPanel ? '#4caf50' : '#607d8b';
              e.currentTarget.style.backgroundColor = currentColor;
            }}
            title={showDataPanel ? '隐藏数据面板' : '显示数据面板'}
          >
            {showDataPanel ? '📊 隐藏面板' : '📊 数据面板'}
          </button>
          <button 
            onClick={exportObjectsData}
            style={{
              padding: '6px 12px',
              backgroundColor: '#2196f3',
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
              e.currentTarget.style.backgroundColor = '#1976d2';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#2196f3';
            }}
            title="导出场景数据为JSON文件"
          >
            💾 导出数据
          </button>
          <button 
            onClick={importObjectsData}
            style={{
              padding: '6px 12px',
              backgroundColor: '#ff9800',
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
              e.currentTarget.style.backgroundColor = '#f57c00';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#ff9800';
            }}
            title="从JSON文件导入场景数据"
          >
            📂 导入数据
          </button>
        </div>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#d9d9d9' }}></div>

        {/* 状态信息 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
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
            📊 物体数量: {objectsInfo.length}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#666',
            backgroundColor: '#fff8e1',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '1px solid #ffcc02'
          }}>
            🎯 选中: {selectedObject ? '动态物体' : '无'}
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

      {/* 主内容区域 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* 左侧动画面板 */}
        {showAnimationPanel && (
          <div style={{
            width: '300px',
            backgroundColor: '#fafafa',
            borderRight: '1px solid #d9d9d9',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {/* 面板标题 */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fff3e0',
              borderBottom: '1px solid #ffe0b2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: 'bold', 
                color: '#e65100' 
              }}>
                🎬 动画编辑器
              </h3>
              <button
                onClick={() => setShowAnimationPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#e65100',
                  padding: '4px'
                }}
                title="关闭动画面板"
              >
                ✕
              </button>
            </div>

            {/* 面板内容 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {selectedObject ? (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ 
                      margin: '0 0 12px 0', 
                      fontSize: '14px', 
                      fontWeight: 'bold', 
                      color: '#e65100',
                      borderBottom: '2px solid #ffcc80',
                      paddingBottom: '8px'
                    }}>
                      ▶️ 动画序列
                    </h4>
                    
                    {/* 动画序列列表 */}
                    <div style={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #ffe0b2', 
                      borderRadius: '4px',
                      padding: '8px',
                      marginBottom: '16px'
                    }}>
                      {(() => {
                        const objectInfo = objectsInfo.find(info => info.mesh === selectedObject);
                        const animations = objectInfo?.animations || [];
                        
                        return animations.length > 0 ? (
                          <div>
                            {animations.map((seq) => (
                              <div
                                key={seq.id}
                                style={{
                                  padding: '8px',
                                  marginBottom: '8px',
                                  backgroundColor: currentAnimationSequence?.id === seq.id ? '#fff3e0' : '#f9f9f9',
                                  border: `1px solid ${currentAnimationSequence?.id === seq.id ? '#ffcc80' : '#e0e0e0'}`,
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                                }}
                                onClick={() => setCurrentAnimationSequence(seq)}
                              >
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center',
                                  marginBottom: '4px'
                                }}>
                                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#e65100' }}>
                                    {seq.name}
                                  </span>
                                  <span style={{ 
                                    fontSize: '10px', 
                                    color: '#999',
                                    backgroundColor: '#fff',
                                    padding: '2px 6px',
                                    borderRadius: '8px'
                                  }}>
                                    {seq.steps.length} 步骤
                                  </span>
                                </div>
                                {seq.isPlaying && (
                                  <div style={{ 
                                    fontSize: '10px', 
                                    color: '#4caf50',
                                    fontWeight: 'bold'
                                  }}>
                                    ▶️ 播放中... ({seq.currentStepIndex + 1}/{seq.steps.length})
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ 
                            margin: '0 0 8px 0', 
                            fontSize: '12px', 
                            color: '#999',
                            textAlign: 'center' 
                          }}>
                            还没有创建动画序列
                          </p>
                        );
                      })()}
                      
                      <button
                        onClick={() => {
                          const name = prompt('请输入动画序列名称:', `动画序列 ${(objectsInfo.find(info => info.mesh === selectedObject)?.animations?.length || 0) + 1}`);
                          if (name) {
                            addAnimationSequence(name);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        ➕ 添加动画序列
                      </button>
                    </div>
                    
                    {/* 动画步骤部分 */}
                    <h4 style={{ 
                      margin: '24px 0 12px 0', 
                      fontSize: '14px', 
                      fontWeight: 'bold', 
                      color: '#e65100',
                      borderBottom: '2px solid #ffcc80',
                      paddingBottom: '8px'
                    }}>
                      🔢 动画步骤
                    </h4>
                    
                    <div style={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #ffe0b2', 
                      borderRadius: '4px',
                      padding: '12px',
                      marginBottom: '16px'
                    }}>
                      {currentAnimationSequence ? (
                        <div>
                          <div style={{ 
                            padding: '8px 12px', 
                            backgroundColor: '#fff3e0',
                            borderRadius: '4px',
                            marginBottom: '16px',
                            fontSize: '12px',
                            color: '#e65100',
                            border: '1px solid #ffcc80'
                          }}>
                            当前编辑: <strong>{currentAnimationSequence.name}</strong>
                          </div>
                          
                          {/* 操作提示 */}
                          {currentAnimationSequence.steps.length > 1 && (
                            <div style={{ 
                              padding: '6px 8px', 
                              backgroundColor: '#e8f5e8',
                              borderRadius: '4px',
                              marginBottom: '12px',
                              fontSize: '10px',
                              color: '#4caf50',
                              border: '1px solid #c8e6c9',
                              textAlign: 'center'
                            }}>
                              💡 提示: 拖拽 ⋮⋮ 图标可调整步骤顺序，点击步骤可编辑参数
                            </div>
                          )}
                          
                          {/* 动画步骤列表 */}
                          <div style={{ 
                            minHeight: '100px', 
                            backgroundColor: '#fafafa',
                            border: '1px dashed #ffcc80',
                            borderRadius: '4px',
                            padding: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            marginBottom: '12px'
                          }}>
                            {currentAnimationSequence.steps.length > 0 ? (
                              currentAnimationSequence.steps.map((step, index) => (
                                <div
                                  key={step.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, step, index)}
                                  onDragOver={(e) => handleDragOver(e, index)}
                                  onDragLeave={handleDragLeave}
                                  onDragEnd={handleDragEnd}
                                  onDrop={(e) => handleDrop(e, index)}
                                  style={{
                                    padding: '8px',
                                    backgroundColor: 
                                      dragOverIndex === index ? '#e8f5e8' :
                                      selectedAnimationStep?.id === step.id ? '#fff3e0' : '#fff',
                                    border: 
                                      dragOverIndex === index ? '2px dashed #4caf50' :
                                      selectedAnimationStep?.id === step.id ? '2px solid #ff9800' : '1px solid #ffe0b2',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: draggedAnimationStep ? 'grabbing' : 'grab',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                  }}
                                  onClick={() => setSelectedAnimationStep(step)}
                                  title="拖拽移动顺序，点击选中编辑"
                                >
                                  {/* 拖拽手柄 */}
                                  <div style={{
                                    position: 'absolute',
                                    left: '4px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '12px',
                                    color: '#999',
                                    cursor: 'grab'
                                  }}>
                                    ⋮⋮
                                  </div>
                                  
                                  <div style={{ marginLeft: '20px', flex: 1 }}>
                                    <span style={{ fontWeight: 'bold', color: '#e65100' }}>
                                      {index + 1}. {(() => {
                                        const typeNames: Record<AnimationType, string> = {
                                          moveUp: '上移', moveDown: '下移', moveLeft: '左移', moveRight: '右移',
                                          moveForward: '前移', moveBackward: '后移',
                                          rotateX: 'X轴旋转', rotateY: 'Y轴旋转', rotateZ: 'Z轴旋转',
                                          scaleUp: '放大', scaleDown: '缩小', pause: '暂停'
                                        };
                                        return typeNames[step.type] || step.type;
                                      })()}
                                    </span>
                                    <div style={{ color: '#666', fontSize: '10px' }}>
                                      时长: {step.duration}秒
                                      {step.distance && `, 距离: ${step.distance}`}
                                      {step.scale && `, 比例: ${step.scale}`}
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); // 防止触发步骤选择
                                      // 如果删除的是选中步骤，清除选中状态
                                      if (selectedAnimationStep?.id === step.id) {
                                        setSelectedAnimationStep(null);
                                      }
                                      // 删除步骤
                                      currentAnimationSequence.steps.splice(index, 1);
                                      setObjectsInfo([...objectsInfoRef.current]);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#f44336',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      padding: '2px'
                                    }}
                                    title="删除此步骤"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ))
                            ) : (
                              <p style={{ 
                                margin: '0', 
                                fontSize: '12px', 
                                color: '#999',
                                textAlign: 'center',
                                padding: '32px 0' 
                              }}>
                                还没有添加动画步骤
                              </p>
                            )}
                          </div>
                          
                          {/* 动画参数设置 */}
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#e65100', 
                              marginBottom: '8px',
                              fontWeight: 'bold'
                            }}>
                              ⚙️ 动画参数: {selectedAnimationStep ? `(编辑步骤 ${currentAnimationSequence!.steps.indexOf(selectedAnimationStep) + 1})` : '(新建步骤)'}
                              {selectedAnimationStep && (
                                <button
                                  onClick={() => setSelectedAnimationStep(null)}
                                  style={{
                                    marginLeft: '8px',
                                    padding: '2px 6px',
                                    backgroundColor: '#f44336',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '9px',
                                    fontWeight: 'bold'
                                  }}
                                  title="取消编辑，切换到新建模式"
                                >
                                  取消编辑
                                </button>
                              )}
                            </div>
                            
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: '1fr 1fr 1fr', 
                              gap: '8px',
                              marginBottom: '12px'
                            }}>
                              {/* 时长输入 */}
                              <div>
                                <label style={{ 
                                  display: 'block', 
                                  fontSize: '10px', 
                                  color: '#666',
                                  marginBottom: '4px',
                                  fontWeight: 'bold'
                                }}>
                                  时长(秒)
                                </label>
                                <input
                                  type="number"
                                  min="0.1"
                                  max="10"
                                  step="0.1"
                                  value={animationDuration}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setAnimationDuration(value);
                                    if (selectedAnimationStep && value) {
                                      updateSelectedAnimationStep('duration', parseFloat(value));
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '10px',
                                    border: selectedAnimationStep ? '2px solid #ff9800' : '1px solid #ffe0b2',
                                    borderRadius: '3px',
                                    boxSizing: 'border-box',
                                    backgroundColor: selectedAnimationStep ? '#fff3e0' : '#fff'
                                  }}
                                  placeholder={selectedAnimationStep ? '编辑时长' : '新建时长'}
                                />
                              </div>
                              
                              {/* 距离/角度输入 */}
                              <div>
                                <label style={{ 
                                  display: 'block', 
                                  fontSize: '10px', 
                                  color: '#666',
                                  marginBottom: '4px',
                                  fontWeight: 'bold'
                                }}>
                                  距离/角度
                                </label>
                                <input
                                  type="number"
                                  min="0.1"
                                  max="10"
                                  step="0.1"
                                  value={animationDistance}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setAnimationDistance(value);
                                    if (selectedAnimationStep && value) {
                                      updateSelectedAnimationStep('distance', parseFloat(value));
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '10px',
                                    border: selectedAnimationStep ? '2px solid #ff9800' : '1px solid #ffe0b2',
                                    borderRadius: '3px',
                                    boxSizing: 'border-box',
                                    backgroundColor: selectedAnimationStep ? '#fff3e0' : '#fff'
                                  }}
                                  placeholder={selectedAnimationStep ? '编辑距离' : '新建距离'}
                                />
                              </div>
                              
                              {/* 缩放倍数输入 */}
                              <div>
                                <label style={{ 
                                  display: 'block', 
                                  fontSize: '10px', 
                                  color: '#666',
                                  marginBottom: '4px',
                                  fontWeight: 'bold'
                                }}>
                                  缩放倍数
                                </label>
                                <input
                                  type="number"
                                  min="0.1"
                                  max="5"
                                  step="0.1"
                                  value={animationScale}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    setAnimationScale(value);
                                    if (selectedAnimationStep && value) {
                                      updateSelectedAnimationStep('scale', parseFloat(value));
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '10px',
                                    border: selectedAnimationStep ? '2px solid #ff9800' : '1px solid #ffe0b2',
                                    borderRadius: '3px',
                                    boxSizing: 'border-box',
                                    backgroundColor: selectedAnimationStep ? '#fff3e0' : '#fff'
                                  }}
                                  placeholder={selectedAnimationStep ? '编辑缩放' : '新建缩放'}
                                />
                              </div>
                            </div>
                          </div>
                          
                          {/* 快速添加步骤按钮组 */}
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ 
                              fontSize: '11px', 
                              color: '#e65100', 
                              marginBottom: '8px',
                              fontWeight: 'bold'
                            }}>
                              快速添加步骤:
                            </div>
                            <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: 'repeat(4, 1fr)', 
                              gap: '4px',
                              marginBottom: '8px'
                            }}>
                              {[
                                { type: 'moveUp' as AnimationType, label: '⬆️', title: '向上移动', category: 'move' },
                                { type: 'moveDown' as AnimationType, label: '⬇️', title: '向下移动', category: 'move' },
                                { type: 'moveLeft' as AnimationType, label: '⬅️', title: '向左移动', category: 'move' },
                                { type: 'moveRight' as AnimationType, label: '➡️', title: '向右移动', category: 'move' },
                                { type: 'moveForward' as AnimationType, label: '↗️', title: '向前移动', category: 'move' },
                                { type: 'moveBackward' as AnimationType, label: '↙️', title: '向后移动', category: 'move' },
                                { type: 'rotateX' as AnimationType, label: '🔄X', title: 'X轴旋转', category: 'rotate' },
                                { type: 'rotateY' as AnimationType, label: '🔄Y', title: 'Y轴旋转', category: 'rotate' },
                                { type: 'rotateZ' as AnimationType, label: '🔄Z', title: 'Z轴旋转', category: 'rotate' },
                                { type: 'scaleUp' as AnimationType, label: '🔍+', title: '放大', category: 'scale' },
                                { type: 'scaleDown' as AnimationType, label: '🔍-', title: '缩小', category: 'scale' },
                                { type: 'pause' as AnimationType, label: '⏸️', title: '暂停', category: 'control' }
                              ].map(({ type, label, title, category }) => (
                                <button
                                  key={type}
                                  onClick={() => {
                                    const duration = parseFloat(animationDuration) || 1;
                                    const distance = parseFloat(animationDistance) || 1;
                                    const scale = parseFloat(animationScale) || 1.5;
                                    
                                    if (type === 'scaleUp' || type === 'scaleDown') {
                                      addAnimationStep(type, duration, scale);
                                    } else if (type === 'pause') {
                                      addAnimationStep(type, duration, 0);
                                    } else {
                                      addAnimationStep(type, duration, distance);
                                    }
                                  }}
                                  style={{
                                    padding: '6px 4px',
                                    backgroundColor: 
                                      category === 'move' ? '#4caf50' :
                                      category === 'rotate' ? '#2196f3' :
                                      category === 'scale' ? '#ff9800' : '#9e9e9e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    fontWeight: 'bold'
                                  }}
                                  title={title}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                            
                            {/* 颜色说明 */}
                            <div style={{ 
                              fontSize: '9px', 
                              color: '#999',
                              textAlign: 'center',
                              marginTop: '4px'
                            }}>
                              <span style={{color: '#4caf50'}}>●</span> 移动 
                              <span style={{color: '#2196f3', marginLeft: '8px'}}>●</span> 旋转 
                              <span style={{color: '#ff9800', marginLeft: '8px'}}>●</span> 缩放 
                              <span style={{color: '#9e9e9e', marginLeft: '8px'}}>●</span> 控制
                            </div>
                            
                            {/* 自定义步骤创建 */}
                            <div style={{
                              marginTop: '16px',
                              padding: '12px',
                              backgroundColor: '#f9f9f9',
                              border: '1px solid #e0e0e0',
                              borderRadius: '4px'
                            }}>
                              <div style={{ 
                                fontSize: '11px', 
                                color: '#e65100', 
                                marginBottom: '8px',
                                fontWeight: 'bold'
                              }}>
                                🛠️ 自定义步骤:
                              </div>
                              
                              <div style={{ marginBottom: '8px' }}>
                                <label style={{ 
                                  display: 'block', 
                                  fontSize: '10px', 
                                  color: '#666',
                                  marginBottom: '4px',
                                  fontWeight: 'bold'
                                }}>
                                  动画类型
                                </label>
                                <select
                                  style={{
                                    width: '100%',
                                    padding: '4px 6px',
                                    fontSize: '10px',
                                    border: '1px solid #ffe0b2',
                                    borderRadius: '3px',
                                    boxSizing: 'border-box'
                                  }}
                                  onChange={(e) => {
                                    const selectedType = e.target.value;
                                    const duration = parseFloat(animationDuration) || 1;
                                    const distance = parseFloat(animationDistance) || 1;
                                    const scale = parseFloat(animationScale) || 1.5;
                                    
                                    if (selectedType && selectedType !== '') {
                                      const animType = selectedType as AnimationType;
                                      if (animType === 'scaleUp' || animType === 'scaleDown') {
                                        addAnimationStep(animType, duration, scale);
                                      } else if (animType === 'pause') {
                                        addAnimationStep(animType, duration, 0);
                                      } else {
                                        addAnimationStep(animType, duration, distance);
                                      }
                                      e.target.value = ''; // 重置选择
                                    }
                                  }}
                                  defaultValue=""
                                >
                                  <option value="">选择动画类型...</option>
                                  <optgroup label="移动动画">
                                    <option value="moveUp">向上移动</option>
                                    <option value="moveDown">向下移动</option>
                                    <option value="moveLeft">向左移动</option>
                                    <option value="moveRight">向右移动</option>
                                    <option value="moveForward">向前移动</option>
                                    <option value="moveBackward">向后移动</option>
                                  </optgroup>
                                  <optgroup label="旋转动画">
                                    <option value="rotateX">X轴旋转</option>
                                    <option value="rotateY">Y轴旋转</option>
                                    <option value="rotateZ">Z轴旋转</option>
                                  </optgroup>
                                  <optgroup label="缩放动画">
                                    <option value="scaleUp">放大</option>
                                    <option value="scaleDown">缩小</option>
                                  </optgroup>
                                  <optgroup label="控制">
                                    <option value="pause">暂停</option>
                                  </optgroup>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ 
                          padding: '12px', 
                          backgroundColor: '#fff8e1',
                          borderRadius: '4px',
                          marginBottom: '16px',
                          fontSize: '12px',
                          color: '#e65100',
                          textAlign: 'center'
                        }}>
                          请先选择或创建一个动画序列
                        </div>
                      )}
                    </div>
                    
                    {/* 动画预览与播放控制 */}
                    <h4 style={{ 
                      margin: '24px 0 12px 0', 
                      fontSize: '14px', 
                      fontWeight: 'bold', 
                      color: '#e65100',
                      borderBottom: '2px solid #ffcc80',
                      paddingBottom: '8px'
                    }}>
                      ▶️ 动画预览
                    </h4>
                    
                    <div style={{ 
                      display: 'flex', 
                      gap: '8px',
                      marginBottom: '16px' 
                    }}>
                      <button
                        onClick={() => {
                          if (currentAnimationSequence) {
                            playAnimationSequence(currentAnimationSequence);
                          } else {
                            alert('请先选择一个动画序列');
                          }
                        }}
                        disabled={!currentAnimationSequence || currentAnimationSequence.steps.length === 0}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: (!currentAnimationSequence || currentAnimationSequence.steps.length === 0) ? '#ccc' : '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: (!currentAnimationSequence || currentAnimationSequence.steps.length === 0) ? 'not-allowed' : 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ▶️ 播放
                      </button>
                      
                      <button
                        onClick={stopAnimation}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        ⏹️ 停止
                      </button>
                      
                      <button
                        onClick={resetAnimation}
                        style={{
                          flex: 1,
                          padding: '8px',
                          backgroundColor: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        🔄 重置
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  textAlign: 'center',
                  padding: '40px 20px', 
                  color: '#999',
                  fontSize: '14px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>未选中物体</div>
                  <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                    请先在场景中选择一个物体来创建动画
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      
        {/* 3D场景容器 */}
        <div
          ref={containerRef}
          style={{ 
            flex: 1,
            width: (showAnimationPanel ? 'calc(100% - 300px)' : '100%') + (showPropertiesPanel ? ' - 320px' : ''),
            minHeight: 0,
            touchAction: 'none',
            overflow: 'hidden',
            transition: 'width 0.3s ease'
          }}
        />

        {/* 右侧属性面板 */}
        {showPropertiesPanel && (
          <div style={{
            width: '320px',
            backgroundColor: '#fafafa',
            borderLeft: '1px solid #d9d9d9',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {/* 面板标题 */}
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#f5f5f5',
              borderBottom: '1px solid #d9d9d9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ 
                margin: 0, 
                fontSize: '16px', 
                fontWeight: 'bold', 
                color: '#333' 
              }}>
                🔧 物体属性
              </h3>
              <button
                onClick={() => setShowPropertiesPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '4px'
                }}
                title="关闭属性面板"
              >
                ✕
              </button>
            </div>

            {/* 面板内容 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px'
            }}>
              {selectedObject ? (() => {
                const objectInfo = objectsInfo.find(info => info.mesh === selectedObject);
                if (!objectInfo) return <div style={{ textAlign: 'center', color: '#999' }}>无法获取物体信息</div>;

                return (
                  <div>
                    {/* 基本信息 */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        color: '#333',
                        borderBottom: '2px solid #e0e0e0',
                        paddingBottom: '8px'
                      }}>
                        📋 基本信息
                      </h4>
                      
                      {/* 物体名称 */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          color: '#666',
                          marginBottom: '4px'
                        }}>
                          名称
                        </label>
                        <input
                          type="text"
                          value={objectInfo.name}
                          onChange={(e) => updateSelectedObjectProperty('name', null, e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px',
                            fontSize: '12px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            boxSizing: 'border-box'
                          }}
                          placeholder="输入物体名称"
                        />
                      </div>

                      {/* 物体类型 */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          color: '#666',
                          marginBottom: '4px'
                        }}>
                          类型
                        </label>
                        <div style={{
                          padding: '8px',
                          fontSize: '12px',
                          backgroundColor: '#f5f5f5',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                          color: '#333'
                        }}>
                          {objectInfo.type}
                        </div>
                      </div>

                      {/* 颜色 */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ 
                          display: 'block', 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          color: '#666',
                          marginBottom: '4px'
                        }}>
                          颜色
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            backgroundColor: `#${objectInfo.color.toString(16).padStart(6, '0')}`,
                            border: '2px solid #ccc',
                            borderRadius: '4px'
                          }}></div>
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#666' }}>
                            #{objectInfo.color.toString(16).padStart(6, '0').toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 位置 */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        color: '#333',
                        borderBottom: '2px solid #e0e0e0',
                        paddingBottom: '8px'
                      }}>
                        📍 位置
                      </h4>
                      {(['x', 'y', 'z'] as const).map(axis => (
                        <div key={axis} style={{ marginBottom: '8px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: '#666',
                            marginBottom: '4px'
                          }}>
                            {axis.toUpperCase()}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={objectInfo.position[axis].toFixed(2)}
                            onChange={(e) => updateSelectedObjectProperty('position', axis, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: '11px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* 旋转 */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        color: '#333',
                        borderBottom: '2px solid #e0e0e0',
                        paddingBottom: '8px'
                      }}>
                        🔄 旋转 (度)
                      </h4>
                      {(['x', 'y', 'z'] as const).map(axis => (
                        <div key={axis} style={{ marginBottom: '8px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: '#666',
                            marginBottom: '4px'
                          }}>
                            {axis.toUpperCase()}
                          </label>
                          <input
                            type="number"
                            step="1"
                            value={(objectInfo.rotation[axis] * 180 / Math.PI).toFixed(1)}
                            onChange={(e) => {
                              const radians = parseFloat(e.target.value) * Math.PI / 180;
                              updateSelectedObjectProperty('rotation', axis, radians);
                            }}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: '11px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* 缩放 */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        color: '#333',
                        borderBottom: '2px solid #e0e0e0',
                        paddingBottom: '8px'
                      }}>
                        📏 缩放
                      </h4>
                      {(['x', 'y', 'z'] as const).map(axis => (
                        <div key={axis} style={{ marginBottom: '8px' }}>
                          <label style={{ 
                            display: 'block', 
                            fontSize: '11px', 
                            fontWeight: 'bold', 
                            color: '#666',
                            marginBottom: '4px'
                          }}>
                            {axis.toUpperCase()}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={objectInfo.scale[axis].toFixed(2)}
                            onChange={(e) => updateSelectedObjectProperty('scale', axis, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              fontSize: '11px',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {/* 快速操作 */}
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: '14px', 
                        fontWeight: 'bold', 
                        color: '#333',
                        borderBottom: '2px solid #e0e0e0',
                        paddingBottom: '8px'
                      }}>
                        ⚡ 快速操作
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button
                          onClick={() => {
                            updateSelectedObjectProperty('position', 'x', 0);
                            updateSelectedObjectProperty('position', 'y', 0);
                            updateSelectedObjectProperty('position', 'z', 0);
                          }}
                          style={{
                            padding: '8px',
                            backgroundColor: '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          📍 重置位置
                        </button>
                        <button
                          onClick={() => {
                            updateSelectedObjectProperty('rotation', 'x', 0);
                            updateSelectedObjectProperty('rotation', 'y', 0);
                            updateSelectedObjectProperty('rotation', 'z', 0);
                          }}
                          style={{
                            padding: '8px',
                            backgroundColor: '#ff9800',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          🔄 重置旋转
                        </button>
                        <button
                          onClick={() => {
                            updateSelectedObjectProperty('scale', 'x', 1);
                            updateSelectedObjectProperty('scale', 'y', 1);
                            updateSelectedObjectProperty('scale', 'z', 1);
                          }}
                          style={{
                            padding: '8px',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          📏 重置缩放
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px', 
                  color: '#999',
                  fontSize: '14px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>未选中物体</div>
                  <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
                    请点击场景中的物体来选择并编辑其属性
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 数据面板 */}
      {showDataPanel && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '20px',
          width: '400px',
          maxHeight: 'calc(100vh - 100px)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid #d9d9d9',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          overflow: 'hidden',
          zIndex: 1000
        }}>
          {/* 面板标题 */}
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              📊 场景数据分析
            </h3>
            <button
              onClick={() => setShowDataPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: '#666',
                padding: '4px'
              }}
              title="关闭面板"
            >
              ✕
            </button>
          </div>

          {/* 面板内容 */}
          <div style={{
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            padding: '16px'
          }}>
            {/* 统计信息 */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                📈 场景统计
              </h4>
              {(() => {
                const stats = getSceneStats();
                return (
                  <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>物体总数:</strong> {stats.totalObjects}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>物体类型分布:</strong>
                      <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                        {Object.entries(stats.objectTypes).map(([type, count]) => (
                          <div key={type} style={{ marginBottom: '2px' }}>
                            • {type}: {count}个
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>场景边界:</strong>
                      <div style={{ marginLeft: '16px', marginTop: '4px', fontFamily: 'monospace' }}>
                        X: [{stats.bounds.minX.toFixed(2)}, {stats.bounds.maxX.toFixed(2)}]<br/>
                        Y: [{stats.bounds.minY.toFixed(2)}, {stats.bounds.maxY.toFixed(2)}]<br/>
                        Z: [{stats.bounds.minZ.toFixed(2)}, {stats.bounds.maxZ.toFixed(2)}]
                      </div>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>几何统计:</strong>
                      <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                        顶点总数: ~{stats.totalVertices}<br/>
                        面片总数: ~{Math.floor(stats.totalFaces)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 物体列表 */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                📦 物体列表 ({objectsInfo.length})
              </h4>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {objectsInfo.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '20px', 
                    color: '#999', 
                    fontSize: '12px' 
                  }}>
                    暂无物体数据
                  </div>
                ) : (
                  objectsInfo.map((info, index) => (
                    <div
                      key={info.id}
                      style={{
                        padding: '8px',
                        marginBottom: '8px',
                        backgroundColor: selectedObject === info.mesh ? '#e3f2fd' : '#f9f9f9',
                        border: selectedObject === info.mesh ? '2px solid #2196f3' : '1px solid #e0e0e0',
                        borderRadius: '4px',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                      onClick={() => info.mesh && selectObject(info.mesh)}
                      title="点击选中此物体"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <strong style={{ color: '#333' }}>
                          #{index + 1} {info.name}
                        </strong>
                        <div style={{ 
                          width: '16px', 
                          height: '16px', 
                          backgroundColor: `#${info.color.toString(16).padStart(6, '0')}`,
                          border: '1px solid #ccc',
                          borderRadius: '2px'
                        }}></div>
                      </div>
                      <div style={{ color: '#666', fontFamily: 'monospace', lineHeight: '1.4' }}>
                        <div>类型: {info.type}</div>
                        <div>位置: ({info.position.x.toFixed(2)}, {info.position.y.toFixed(2)}, {info.position.z.toFixed(2)})</div>
                        <div>旋转: ({(info.rotation.x * 180 / Math.PI).toFixed(1)}°, {(info.rotation.y * 180 / Math.PI).toFixed(1)}°, {(info.rotation.z * 180 / Math.PI).toFixed(1)}°)</div>
                        <div>缩放: ({info.scale.x.toFixed(2)}, {info.scale.y.toFixed(2)}, {info.scale.z.toFixed(2)})</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 快捷操作 */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                ⚡ 快捷操作
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <button
                  onClick={() => {
                    console.log('当前物体信息:', objectsInfo);
                    console.log('JSON格式:', JSON.stringify(objectsInfo.map(info => ({
                      id: info.id,
                      name: info.name,
                      type: info.type,
                      position: info.position,
                      rotation: info.rotation,
                      scale: info.scale,
                      color: info.color
                    })), null, 2));
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#607d8b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                  title="在控制台查看详细数据"
                >
                  🐛 控制台日志
                </button>
                <button
                  onClick={() => {
                    // 测试恢复场景功能
                    const testData = [
                      {
                        id: 'test-1',
                        name: 'Test Cube',
                        type: 'cube' as const,
                        position: { x: 1, y: 1, z: 1 },
                        rotation: { x: 0, y: Math.PI / 4, z: 0 },
                        scale: { x: 1.5, y: 1.5, z: 1.5 },
                        color: 0xff0000
                      },
                      {
                        id: 'test-2',
                        name: 'Test Sphere',
                        type: 'sphere' as const,
                        position: { x: -2, y: 2, z: 0 },
                        rotation: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 },
                        color: 0x00ff00
                      }
                    ];
                    restoreSceneFromData(testData);
                  }}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#8bc34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                  title="加载测试场景数据"
                >
                  🔄 测试场景
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeEditor;
