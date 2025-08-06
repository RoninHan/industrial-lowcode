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
        {/* 3D场景容器 */}
        <div
          ref={containerRef}
          style={{ 
            flex: showPropertiesPanel ? '1' : '1',
            width: showPropertiesPanel ? 'calc(100% - 320px)' : '100%',
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
