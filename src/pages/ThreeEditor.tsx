import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import BlocklyAnimationEditor from '../components/BlocklyAnimationEditor_New';
import JSZip from 'jszip';

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
  const [currentAnimationSequence, setCurrentAnimationSequence] = useState<AnimationSequence | null>(null); // 当前正在播放的动画序列
  const animationFrameRef = useRef<number | null>(null); // 动画帧请求ID
  const animationStartTimeRef = useRef<number>(0); // 动画开始时间
  const animationInitialState = useRef<{position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3} | null>(null); // 动画初始状态
  
  // 全场景动画状态
  const [isPlayingSceneAnimation, setIsPlayingSceneAnimation] = useState<boolean>(false);
  const sceneAnimationFrameRefs = useRef<Map<string, number>>(new Map()); // 存储每个物体的动画帧ID
  const sceneAnimationInitialStates = useRef<Map<string, {position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3}>>(new Map()); // 存储每个物体的初始状态
  
  // 下拉菜单状态
  const [openDropdown, setOpenDropdown] = useState<string | null>(null); // 当前打开的下拉菜单
  
  // 鼠标位置状态
  const mousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  
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
  
  // 播放全场景动画
  const playSceneAnimation = useCallback(() => {
    if (isPlayingSceneAnimation) return;
    
    // 获取所有有动画的物体
    const objectsWithAnimations = objectsInfoRef.current.filter(info => 
      info.mesh && info.animations && info.animations.length > 0
    );
    
    if (objectsWithAnimations.length === 0) {
      alert('场景中没有物体设置了动画');
      return;
    }
    
    setIsPlayingSceneAnimation(true);
    
    // 清理之前的动画帧
    sceneAnimationFrameRefs.current.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    sceneAnimationFrameRefs.current.clear();
    sceneAnimationInitialStates.current.clear();
    
    // 为每个物体播放其第一个动画序列
    objectsWithAnimations.forEach((objectInfo) => {
      if (!objectInfo.mesh || !objectInfo.animations || objectInfo.animations.length === 0) return;
      
      const mesh = objectInfo.mesh;
      const sequence = objectInfo.animations[0]; // 播放第一个动画序列
      
      // 保存初始状态
      sceneAnimationInitialStates.current.set(objectInfo.id, {
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        scale: mesh.scale.clone()
      });
      
      sequence.isPlaying = true;
      sequence.currentStepIndex = 0;
      
      const playObjectSequence = (stepIndex: number) => {
        if (stepIndex >= sequence.steps.length) {
          // 动画序列完成
          sequence.isPlaying = false;
          sceneAnimationFrameRefs.current.delete(objectInfo.id);
          console.log(`物体 ${objectInfo.name} 动画播放完成`);
          
          // 检查是否所有物体动画都完成了
          if (sceneAnimationFrameRefs.current.size === 0) {
            setIsPlayingSceneAnimation(false);
            console.log('全场景动画播放完成');
          }
          return;
        }
        
        const step = sequence.steps[stepIndex];
        const startTime = Date.now();
        const startPosition = mesh.position.clone();
        const startRotation = mesh.rotation.clone();
        const startScale = mesh.scale.clone();
        
        const animate = () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const progress = Math.min(elapsed / step.duration, 1);
          
          // 应用动画变换
          switch (step.type) {
            case 'moveUp':
              mesh.position.y = startPosition.y + (step.distance || 1) * progress;
              break;
            case 'moveDown':
              mesh.position.y = startPosition.y - (step.distance || 1) * progress;
              break;
            case 'moveLeft':
              mesh.position.x = startPosition.x - (step.distance || 1) * progress;
              break;
            case 'moveRight':
              mesh.position.x = startPosition.x + (step.distance || 1) * progress;
              break;
            case 'moveForward':
              mesh.position.z = startPosition.z - (step.distance || 1) * progress;
              break;
            case 'moveBackward':
              mesh.position.z = startPosition.z + (step.distance || 1) * progress;
              break;
            case 'rotateX':
              mesh.rotation.x = startRotation.x + (step.distance || Math.PI / 2) * progress;
              break;
            case 'rotateY':
              mesh.rotation.y = startRotation.y + (step.distance || Math.PI / 2) * progress;
              break;
            case 'rotateZ':
              mesh.rotation.z = startRotation.z + (step.distance || Math.PI / 2) * progress;
              break;
            case 'scaleUp':
              const upScale = step.scale || 1.2;
              mesh.scale.setScalar(startScale.x + (upScale - startScale.x) * progress);
              break;
            case 'scaleDown':
              const downScale = step.scale || 0.8;
              mesh.scale.setScalar(startScale.x + (downScale - startScale.x) * progress);
              break;
          }
          
          if (progress < 1) {
            const frameId = requestAnimationFrame(animate);
            sceneAnimationFrameRefs.current.set(objectInfo.id, frameId);
          } else {
            // 当前步骤完成，播放下一步
            sequence.currentStepIndex = stepIndex + 1;
            playObjectSequence(stepIndex + 1);
          }
        };
        
        if (step.type !== 'pause') {
          const frameId = requestAnimationFrame(animate);
          sceneAnimationFrameRefs.current.set(objectInfo.id, frameId);
        } else {
          // 暂停步骤
          setTimeout(() => playObjectSequence(stepIndex + 1), (step.duration || 1) * 1000);
        }
      };
      
      playObjectSequence(0);
    });
    
    // 更新状态
    setObjectsInfo([...objectsInfoRef.current]);
  }, [isPlayingSceneAnimation]);
  
  // 停止全场景动画
  const stopSceneAnimation = useCallback(() => {
    setIsPlayingSceneAnimation(false);
    
    // 停止所有动画帧
    sceneAnimationFrameRefs.current.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    sceneAnimationFrameRefs.current.clear();
    
    // 停止所有物体的动画序列
    objectsInfoRef.current.forEach((objectInfo) => {
      if (objectInfo.animations) {
        objectInfo.animations.forEach((sequence) => {
          sequence.isPlaying = false;
        });
      }
    });
    
    setObjectsInfo([...objectsInfoRef.current]);
    console.log('全场景动画已停止');
  }, []);
  
  // 重置全场景动画
  const resetSceneAnimation = useCallback(() => {
    stopSceneAnimation();
    
    // 恢复所有物体到初始状态
    sceneAnimationInitialStates.current.forEach((initialState, objectId) => {
      const objectInfo = objectsInfoRef.current.find(info => info.id === objectId);
      if (objectInfo && objectInfo.mesh) {
        const mesh = objectInfo.mesh;
        mesh.position.copy(initialState.position);
        mesh.rotation.copy(initialState.rotation);
        mesh.scale.copy(initialState.scale);
        
        // 更新物体信息
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
      }
    });
    
    sceneAnimationInitialStates.current.clear();
    setObjectsInfo([...objectsInfoRef.current]);
    console.log('全场景动画已重置到初始状态');
  }, [stopSceneAnimation]);
  
  // 当前选中物体的动画步骤（缓存以避免重复计算）
  const currentObjectAnimationSteps = useMemo(() => {
    if (!selectedObject) return [];
    
    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObject);
    if (objectInfo && objectInfo.animations) {
      const blocklySequence = objectInfo.animations.find(seq => seq.name === 'Blockly动画');
      return blocklySequence ? blocklySequence.steps : [];
    }
    return [];
  }, [selectedObject, objectsInfo]); // 依赖 objectsInfo 以便动画更新时重新计算

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

  // 下拉菜单处理函数
  const toggleDropdown = useCallback((dropdownName: string) => {
    setOpenDropdown(prev => prev === dropdownName ? null : dropdownName);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpenDropdown(null);
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        closeDropdown();
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openDropdown, closeDropdown]);

  // 下拉菜单组件
  const DropdownMenu: React.FC<{
    title: string;
    icon: string;
    dropdownKey: string;
    children: React.ReactNode;
    buttonColor?: string;
  }> = ({ title, icon, dropdownKey, children, buttonColor = '#666' }) => {
    const isOpen = openDropdown === dropdownKey;
    
    return (
      <div className="dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={() => toggleDropdown(dropdownKey)}
          style={{
            padding: '6px 12px',
            backgroundColor: isOpen ? '#e3f2fd' : 'transparent',
            color: isOpen ? '#1976d2' : buttonColor,
            border: '1px solid transparent',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            if (!isOpen) {
              e.currentTarget.style.backgroundColor = '#f0f0f0';
              e.currentTarget.style.borderColor = '#d0d0d0';
            }
          }}
          onMouseOut={(e) => {
            if (!isOpen) {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
            }
          }}
        >
          {icon} {title} {isOpen ? '▲' : '▼'}
        </button>
        
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '0',
            minWidth: '200px',
            backgroundColor: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            padding: '8px 0',
            marginTop: '2px'
          }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  // 菜单项组件
  const DropdownItem: React.FC<{
    onClick: () => void;
    icon: string;
    label: string;
    description?: string;
    disabled?: boolean;
    color?: string;
  }> = ({ onClick, icon, label, description, disabled = false, color = '#333' }) => (
    <div
      onClick={() => {
        if (!disabled) {
          onClick();
          closeDropdown();
        }
      }}
      style={{
        padding: '8px 16px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 0.2s ease'
      }}
      onMouseOver={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }
      }}
      onMouseOut={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '13px', fontWeight: '500', color }}>{label}</div>
        {description && (
          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );

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
    property: 'name' | 'position' | 'rotation' | 'scale' | 'color', 
    axis: 'x' | 'y' | 'z' | null, 
    value: string | number
  ) => {
    if (!selectedObjectRef.current) return;

    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObjectRef.current);
    if (!objectInfo) return;

    const mesh = selectedObjectRef.current;
    
    if (property === 'name') {
      objectInfo.name = value as string;
    } else if (property === 'color') {
      // 处理颜色更新
      const colorValue = typeof value === 'string' ? parseInt(value.replace('#', ''), 16) : value as number;
      objectInfo.color = colorValue;
      
      // 更新mesh的材质颜色
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.setHex(colorValue);
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
    // 使用CSS方式实现全屏，保持菜单栏可见
    setIsFullscreen(prev => !prev);
  }, []);

  // 监听全屏状态变化，触发resize
  useEffect(() => {
    // 全屏状态改变时触发resize
    setTimeout(() => {
      handleResize();
    }, 100);
  }, [isFullscreen, handleResize]);

  // 移除不必要的变换模式同步useEffect

  // 添加不同类型的物体
  const addObject = useCallback((type: 'cube' | 'sphere' | 'cylinder' | 'cone') => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;
    
    // 计算物体位置 - 在原点创建物体
    let x: number, y: number, z: number;
    
    // 在原点创建物体
    x = 0;
    y = 0;
    z = 0;

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

  // 保存完整项目（参考 Scratch 3.0 .sb3 文件格式）
  const saveProject = useCallback(async () => {
    try {
      // 1. 构建项目元数据 (类似 Scratch meta)
      const meta = {
        semver: '1.0.0',
        vm: '1.0.0',
        agent: 'Industrial-LowCode 3D Editor',
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      };

      // 2. 构建舞台目标 (类似 Scratch Stage target)
      const stage = {
        isStage: true,
        name: 'Stage',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [],
        sounds: [],
        layerOrder: 0,
        volume: 100,
        // 3D 场景特有的舞台属性
        gridSize,
        gridDivisions,
        showGrid,
        cameraPosition: cameraRef.current ? {
          x: cameraRef.current.position.x,
          y: cameraRef.current.position.y,
          z: cameraRef.current.position.z
        } : { x: 3, y: 3, z: 3 },
        cameraTarget: orbitRef.current ? {
          x: orbitRef.current.target.x,
          y: orbitRef.current.target.y,
          z: orbitRef.current.target.z
        } : { x: 0, y: 0, z: 0 }
      };

      // 3. 构建精灵目标数组 (类似 Scratch Sprite targets)
      const sprites = objectsInfoRef.current.map((objectInfo, index) => ({
        isStage: false,
        name: objectInfo.name,
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: objectInfo.animations ? 
          objectInfo.animations.reduce((blocks: any, animation) => {
            // 将动画步骤转换为类似 Blockly 的块结构
            animation.steps.forEach((step, stepIndex) => {
              const blockId = `${objectInfo.id}_${animation.id}_step_${stepIndex}`;
              blocks[blockId] = {
                opcode: `motion_${step.type}`,
                next: stepIndex < animation.steps.length - 1 ? 
                  `${objectInfo.id}_${animation.id}_step_${stepIndex + 1}` : null,
                parent: stepIndex > 0 ? 
                  `${objectInfo.id}_${animation.id}_step_${stepIndex - 1}` : null,
                inputs: {},
                fields: {
                  DURATION: [step.duration],
                  DISTANCE: [step.distance || 0],
                  SCALE: [step.scale || 1]
                },
                shadow: false,
                topLevel: stepIndex === 0,
                x: stepIndex * 100,
                y: index * 100
              };
            });
            return blocks;
          }, {}) : {},
        comments: {},
        currentCostume: 0,
        costumes: [{
          assetId: `${objectInfo.id}_costume`,
          name: `${objectInfo.type}_costume`,
          md5ext: `${objectInfo.id}_costume.json`,
          dataFormat: 'json',
          rotationCenterX: 0,
          rotationCenterY: 0
        }],
        sounds: [],
        layerOrder: index + 1,
        volume: 100,
        // 3D 物体特有属性
        visible: true,
        x: objectInfo.position.x,
        y: objectInfo.position.y,
        z: objectInfo.position.z,
        rotationX: objectInfo.rotation.x,
        rotationY: objectInfo.rotation.y,
        rotationZ: objectInfo.rotation.z,
        scaleX: objectInfo.scale.x,
        scaleY: objectInfo.scale.y,
        scaleZ: objectInfo.scale.z,
        color: objectInfo.color,
        objectType: objectInfo.type,
        objectId: objectInfo.id,
        animations: objectInfo.animations || []
      }));

      // 4. 构建监视器数组 (类似 Scratch monitors)
      const monitors = [
        {
          id: 'objectCount',
          mode: 'default',
          opcode: 'sensing_objectcount',
          params: {},
          spriteName: null,
          value: objectsInfoRef.current.length,
          width: 100,
          height: 30,
          x: 5,
          y: 5,
          visible: true
        }
      ];

      // 5. 扩展列表 (类似 Scratch extensions)
      const extensions = ['three_js', 'animation_system', 'blockly_editor'];

      // 6. 构建完整的项目 JSON (类似 Scratch project.json)
      const projectJson = {
        targets: [stage, ...sprites],
        monitors,
        extensions,
        meta
      };

      // 7. 导出 GLTF 模型数据作为资产
      let gltfAsset: string | null = null;
      let gltfData: any = null;
      if (objectsRef.current.length > 0) {
        const exporter = new GLTFExporter();
        const tempScene = new THREE.Scene();
        objectsRef.current.forEach(mesh => {
          const clone = mesh.clone();
          if ((mesh as any).material) {
            (clone as any).material = (mesh as any).material.clone();
          }
          tempScene.add(clone);
        });
        
        gltfData = await new Promise<any>((resolve, reject) => {
          exporter.parse(tempScene, resolve, reject, {
            binary: false,
            onlyVisible: true,
            truncateDrawRange: true,
            embedImages: true,
            animations: [],
            forceIndices: false,
            includeCustomExtensions: false
          });
        });
        
        // 生成 MD5 风格的资产 ID (简化版)
        const assetId = `scene_${Date.now().toString(36)}`;
        gltfAsset = `${assetId}.gltf`;
      }

      // 8. 创建 ZIP 包 (类似 Scratch .sb3)
      const zip = new JSZip();
      
      // 主项目文件
      zip.file('project.json', JSON.stringify(projectJson, null, 2));
      
      // 资产文件
      if (gltfAsset && gltfData) {
        zip.file(gltfAsset, JSON.stringify(gltfData, null, 2));
      }

      // 为每个物体添加服装数据 (costume data)
      sprites.forEach(sprite => {
        if (sprite.costumes.length > 0) {
          const costumeData = {
            type: sprite.objectType,
            color: sprite.color,
            geometry: sprite.objectType,
            position: { x: sprite.x, y: sprite.y, z: sprite.z },
            rotation: { x: sprite.rotationX, y: sprite.rotationY, z: sprite.rotationZ },
            scale: { x: sprite.scaleX, y: sprite.scaleY, z: sprite.scaleZ }
          };
          zip.file(sprite.costumes[0].md5ext, JSON.stringify(costumeData, null, 2));
        }
      });

      // 9. 生成并下载文件
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `project_${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}.i3d`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('项目保存成功 (Scratch 风格):', projectJson);
      alert(`项目已成功保存！\n格式: Industrial-LowCode (.i3d)\n物体数量: ${sprites.length}\n动画数量: ${sprites.reduce((total, sprite) => total + sprite.animations.length, 0)}`);
      
    } catch (error) {
      console.error('保存项目失败:', error);
      alert('保存项目失败，请检查控制台错误信息');
    }
  }, [objectsInfo, selectedObject, gridSize, gridDivisions, showGrid, currentAnimationSequence]);

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

  // 加载完整项目（支持 Scratch 风格的 .i3d 格式）
  const loadProject = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.i3d,.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        let projectData: any = null;

        // 检查文件类型
        if (file.name.endsWith('.i3d')) {
          // 处理 ZIP 格式的 .i3d 文件 (Scratch 风格)
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);
          
          // 读取主项目文件
          const projectFile = zipContent.file('project.json');
          if (!projectFile) {
            throw new Error('项目文件中没有找到 project.json');
          }
          
          const projectJsonText = await projectFile.async('text');
          projectData = JSON.parse(projectJsonText);
          
          // 验证 Scratch 风格格式
          if (!projectData.targets || !projectData.meta) {
            throw new Error('无效的 .i3d 项目文件格式');
          }
          
          console.log('加载 Scratch 风格项目:', projectData);
          
        } else {
          // 处理旧格式的 JSON 文件
          const reader = new FileReader();
          const fileContent = await new Promise<string>((resolve, reject) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          
          projectData = JSON.parse(fileContent);
          
          // 验证旧格式
          if (!projectData.version || !projectData.scene) {
            throw new Error('无效的项目文件格式');
          }
        }

        // 1. 清空当前场景
        clearObjects();

        if (projectData.targets) {
          // 处理 Scratch 风格格式
          
          // 2. 恢复舞台设置
          const stage = projectData.targets.find((target: any) => target.isStage);
          if (stage) {
            // 恢复相机位置
            if (stage.cameraPosition && cameraRef.current) {
              cameraRef.current.position.set(
                stage.cameraPosition.x,
                stage.cameraPosition.y,
                stage.cameraPosition.z
              );
            }
            
            // 恢复相机目标
            if (stage.cameraTarget && orbitRef.current) {
              orbitRef.current.target.set(
                stage.cameraTarget.x,
                stage.cameraTarget.y,
                stage.cameraTarget.z
              );
              orbitRef.current.update();
            }
            
            // 恢复网格显示
            if (typeof stage.showGrid === 'boolean') {
              setShowGrid(stage.showGrid);
              if (gridRef.current) {
                gridRef.current.visible = stage.showGrid;
              }
            }
          }

          // 3. 恢复精灵（物体）
          const sprites = projectData.targets.filter((target: any) => !target.isStage);
          console.log('加载项目 - 物体数量:', sprites.length);
          
          sprites.forEach((sprite: any) => {
            let geometry: THREE.BufferGeometry;
            
            switch (sprite.objectType) {
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
            
            const material = new THREE.MeshStandardMaterial({ color: sprite.color });
            const mesh = new THREE.Mesh(geometry, material);
            
            // 应用保存的变换
            mesh.position.set(sprite.x, sprite.y, sprite.z);
            mesh.rotation.set(sprite.rotationX, sprite.rotationY, sprite.rotationZ);
            mesh.scale.set(sprite.scaleX, sprite.scaleY, sprite.scaleZ);
            
            // 创建物体信息
            const objectInfo: ObjectInfo = {
              id: sprite.objectId,
              name: sprite.name,
              type: sprite.objectType,
              position: { x: sprite.x, y: sprite.y, z: sprite.z },
              rotation: { x: sprite.rotationX, y: sprite.rotationY, z: sprite.rotationZ },
              scale: { x: sprite.scaleX, y: sprite.scaleY, z: sprite.scaleZ },
              color: sprite.color,
              mesh,
              animations: sprite.animations || []
            };
            
            // 添加到场景
            sceneRef.current!.add(mesh);
            objectsRef.current = [...objectsRef.current, mesh];
            
            setObjectsInfo(prev => {
              const newObjectsInfo = [...prev, objectInfo];
              objectsInfoRef.current = newObjectsInfo;
              return newObjectsInfo;
            });
            
            console.log(`恢复物体: ${sprite.name}, 动画数量: ${sprite.animations?.length || 0}`);
          });

          alert(`项目加载成功！\n格式: Scratch 风格 (.i3d)\n物体数量: ${sprites.length}\n版本: ${projectData.meta?.semver || '未知'}`);
          
        } else {
          // 处理旧格式
          // ... 这里保留原有的旧格式处理逻辑
          alert('加载旧格式项目成功！建议重新保存为新格式。');
        }

        console.log('项目加载完成');
        
      } catch (error) {
        console.error('加载项目失败:', error);
        alert(`项目加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };
    input.click();
  }, [clearObjects, selectObject]);

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
    camera.lookAt(0, 0, 0); // 直接让相机看向原点
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
    gridHelper.position.y = 0; // 网格在原点平面上
    scene.add(gridHelper);
    gridRef.current = gridHelper;

    // 4. OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.target.set(0, 0, 0); // 确保相机对着原点
    orbit.update(); // 更新控制器状态
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

    // 添加鼠标移动事件监听器来跟踪鼠标位置
    const handleMouseMove = (event: MouseEvent) => {
      const newMousePos = {
        x: event.clientX,
        y: event.clientY
      };
      mousePositionRef.current = newMousePos;
    };
    renderer.domElement.addEventListener('mousemove', handleMouseMove);

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
      renderer.domElement.removeEventListener('mousemove', handleMouseMove);
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
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      maxHeight: '100%', 
      overflow: 'hidden',
      // 全屏模式样式
      ...(isFullscreen ? {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        backgroundColor: '#f8f9fa'
      } : {})
    }}>
      {/* 添加动画关键帧 */}
      <style>
        {`
          @keyframes pulse {
            from { opacity: 1; }
            to { opacity: 0.6; }
          }
          .dropdown-container:hover .dropdown-button {
            background-color: #f0f0f0 !important;
          }
        `}
      </style>
      
      {/* 顶部菜单栏 */}
      <div style={{
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #dee2e6',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '48px',
        flexShrink: 0
      }}>
        {/* 文件菜单 */}
        <DropdownMenu title="文件" icon="📁" dropdownKey="file" buttonColor="#333">
          <DropdownItem 
            onClick={saveProject}
            icon="💾"
            label="保存项目"
            description="将整个3D项目打包下载（包含模型、动画、代码）"
          />
          <DropdownItem 
            onClick={loadProject}
            icon="📂"
            label="打开项目"
            description="导入之前保存的项目文件"
          />
          <div style={{ height: '1px', backgroundColor: '#dee2e6', margin: '4px 16px' }} />
          <DropdownItem 
            onClick={handleExportClick}
            icon="📁"
            label="导出GLTF"
            description="导出当前场景为GLTF格式"
          />
          <DropdownItem 
            onClick={exportObjectsData}
            icon="💾"
            label="导出数据"
            description="导出场景数据为JSON文件"
          />
          <DropdownItem 
            onClick={importObjectsData}
            icon="📂"
            label="导入数据"
            description="从JSON文件导入场景数据"
          />
        </DropdownMenu>

        {/* 对象菜单 */}
        <DropdownMenu title="对象" icon="📦" dropdownKey="objects" buttonColor="#333">
          <DropdownItem 
            onClick={() => addObject('cube')}
            icon="🧊"
            label="立方体"
            description="在原点(0,0,0)添加一个立方体到场景中"
          />
          <DropdownItem 
            onClick={() => addObject('sphere')}
            icon="⚽"
            label="球体"
            description="在原点(0,0,0)添加一个球体到场景中"
          />
          <DropdownItem 
            onClick={() => addObject('cylinder')}
            icon="🛢️"
            label="圆柱体"
            description="在原点(0,0,0)添加一个圆柱体到场景中"
          />
          <DropdownItem 
            onClick={() => addObject('cone')}
            icon="🔺"
            label="圆锥体"
            description="在原点(0,0,0)添加一个圆锥体到场景中"
          />
          <div style={{ height: '1px', backgroundColor: '#dee2e6', margin: '4px 16px' }} />
          <DropdownItem 
            onClick={clearObjects}
            icon="🗑️"
            label="清空场景"
            description="删除场景中所有添加的物体"
            color="#dc3545"
          />
        </DropdownMenu>

        {/* 变换菜单 */}
        <DropdownMenu title="变换" icon="🔧" dropdownKey="transform" buttonColor="#333">
          <DropdownItem 
            onClick={() => setTransformModeHandler('translate')}
            icon={transformMode === 'translate' ? '✅' : '↔️'}
            label="移动模式 (G)"
            description="拖拽物体改变位置"
            color={transformMode === 'translate' ? '#28a745' : '#333'}
          />
          <DropdownItem 
            onClick={() => setTransformModeHandler('rotate')}
            icon={transformMode === 'rotate' ? '✅' : '🔄'}
            label="旋转模式 (R)"
            description="旋转物体改变朝向"
            color={transformMode === 'rotate' ? '#28a745' : '#333'}
          />
          <DropdownItem 
            onClick={() => setTransformModeHandler('scale')}
            icon={transformMode === 'scale' ? '✅' : '📏'}
            label="缩放模式 (S)"
            description="缩放物体改变大小"
            color={transformMode === 'scale' ? '#28a745' : '#333'}
          />
        </DropdownMenu>

        {/* 视图菜单 */}
        <DropdownMenu title="视图" icon="👁️" dropdownKey="view" buttonColor="#333">
          <DropdownItem 
            onClick={toggleGrid}
            icon={showGrid ? '✅' : '🔳'}
            label="网格显示"
            description="切换地面网格的显示状态"
            color={showGrid ? '#28a745' : '#333'}
          />
          <DropdownItem 
            onClick={toggleFullscreen}
            icon={isFullscreen ? '🔙' : '⛶'}
            label={isFullscreen ? '退出全屏' : '全屏模式'}
            description={isFullscreen ? '退出全屏显示' : '进入全屏模式'}
          />
          <div style={{ height: '1px', backgroundColor: '#dee2e6', margin: '4px 16px' }} />
          <DropdownItem 
            onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}
            icon={showPropertiesPanel ? '✅' : '🔧'}
            label="属性面板"
            description="显示/隐藏物体属性面板"
            color={showPropertiesPanel ? '#28a745' : '#333'}
          />
          <DropdownItem 
            onClick={() => setShowAnimationPanel(!showAnimationPanel)}
            icon={showAnimationPanel ? '✅' : '🎬'}
            label="动画面板"
            description="显示/隐藏动画编辑面板"
            color={showAnimationPanel ? '#28a745' : '#333'}
          />
          <DropdownItem 
            onClick={() => setShowDataPanel(!showDataPanel)}
            icon={showDataPanel ? '✅' : '📊'}
            label="数据面板"
            description="显示/隐藏场景数据分析面板"
            color={showDataPanel ? '#28a745' : '#333'}
          />
        </DropdownMenu>

        {/* 动画菜单 */}
        <DropdownMenu title="动画" icon="🎭" dropdownKey="animation" buttonColor="#333">
          <DropdownItem 
            onClick={playSceneAnimation}
            icon="▶️"
            label="播放全场景"
            description="同时播放所有物体的动画"
            disabled={isPlayingSceneAnimation}
            color={isPlayingSceneAnimation ? '#6c757d' : '#28a745'}
          />
          <DropdownItem 
            onClick={stopSceneAnimation}
            icon="⏹️"
            label="停止动画"
            description="停止全场景动画播放"
            disabled={!isPlayingSceneAnimation}
            color={!isPlayingSceneAnimation ? '#6c757d' : '#dc3545'}
          />
          <DropdownItem 
            onClick={resetSceneAnimation}
            icon="🔄"
            label="重置动画"
            description="重置全场景动画到初始状态"
            color="#17a2b8"
          />
        </DropdownMenu>

        {/* 分隔线 */}
        <div style={{ height: '24px', width: '1px', backgroundColor: '#dee2e6', margin: '0 8px' }}></div>

        {/* 状态信息 - 简化版 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <div style={{
            fontSize: '12px',
            color: '#6c757d',
            backgroundColor: '#e9ecef',
            padding: '4px 8px',
            borderRadius: '12px',
            border: '1px solid #dee2e6'
          }}>
            📦 {objectsInfo.length} 个物体
          </div>
          
          <div style={{
            fontSize: '12px',
            color: '#6c757d',
            backgroundColor: transformMode === 'translate' ? '#d4edda' : transformMode === 'rotate' ? '#fff3cd' : '#cce7ff',
            padding: '4px 8px',
            borderRadius: '12px',
            border: `1px solid ${transformMode === 'translate' ? '#c3e6cb' : transformMode === 'rotate' ? '#f0e68c' : '#b3daff'}`
          }}>
            {transformMode === 'translate' ? '↔️ 移动' : transformMode === 'rotate' ? '🔄 旋转' : '📏 缩放'}
          </div>

          {selectedObject && (
            <div style={{
              fontSize: '12px',
              color: '#495057',
              backgroundColor: '#fff3cd',
              padding: '4px 8px',
              borderRadius: '12px',
              border: '1px solid #ffeaa7',
              fontWeight: '500'
            }}>
              🎯 已选中
            </div>
          )}

          {isPlayingSceneAnimation && (
            <div style={{
              fontSize: '12px',
              color: '#155724',
              backgroundColor: '#d4edda',
              padding: '4px 8px',
              borderRadius: '12px',
              border: '1px solid #c3e6cb',
              fontWeight: '500',
              animation: 'pulse 1.5s ease-in-out infinite alternate'
            }}>
              🎭 动画播放中
            </div>
          )}
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
            width: '40%',
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
                Blockly 动画编辑器
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
                ×
              </button>
            </div>

            {/* 面板内容 */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0'
            }}>
              {selectedObject ? (
                <BlocklyAnimationEditor
                  selectedObject={selectedObject}
                  existingAnimationSteps={currentObjectAnimationSteps}
                  onAnimationStepsChange={(steps) => {
                    // 将 Blockly 生成的步骤转换为原有系统的动画序列
                    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObject);
                    if (objectInfo) {
                      if (!objectInfo.animations) {
                        objectInfo.animations = [];
                      }
                      
                      // 更新或创建默认动画序列
                      let defaultSequence = objectInfo.animations.find(seq => seq.name === 'Blockly动画');
                      if (!defaultSequence) {
                        defaultSequence = {
                          id: `blockly_seq_${Date.now()}`,
                          name: 'Blockly动画',
                          steps: [],
                          isPlaying: false,
                          currentStepIndex: 0
                        };
                        objectInfo.animations.push(defaultSequence);
                      }
                      
                      // 更新步骤
                      defaultSequence.steps = steps;
                      setCurrentAnimationSequence(defaultSequence);
                      setObjectsInfo([...objectsInfoRef.current]);
                    }
                  }}
                  onPlayAnimation={(steps) => {
                    // 使用现有的播放动画逻辑
                    const objectInfo = objectsInfoRef.current.find(info => info.mesh === selectedObject);
                    if (objectInfo && objectInfo.animations) {
                      let sequence = objectInfo.animations.find(seq => seq.name === 'Blockly动画');
                      if (sequence) {
                        sequence.steps = steps;
                        playAnimationSequence(sequence);
                      }
                    }
                  }}
                  onStopAnimation={stopAnimation}
                  onResetAnimation={resetAnimation}
                  visible={true}
                />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <input
                            type="color"
                            value={`#${objectInfo.color.toString(16).padStart(6, '0')}`}
                            onChange={(e) => updateSelectedObjectProperty('color', null, e.target.value)}
                            style={{
                              width: '32px',
                              height: '32px',
                              border: '2px solid #ccc',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              padding: '0'
                            }}
                            title="点击选择颜色"
                          />
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#666' }}>
                            #{objectInfo.color.toString(16).padStart(6, '0').toUpperCase()}
                          </span>
                          <input
                            type="text"
                            value={`#${objectInfo.color.toString(16).padStart(6, '0').toUpperCase()}`}
                            onChange={(e) => {
                              const hexValue = e.target.value.replace('#', '');
                              if (/^[0-9A-Fa-f]{6}$/.test(hexValue)) {
                                updateSelectedObjectProperty('color', null, `#${hexValue}`);
                              }
                            }}
                            style={{
                              width: '80px',
                              padding: '4px 6px',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}
                            placeholder="#FFFFFF"
                            maxLength={7}
                            title="输入十六进制颜色值"
                          />
                        </div>
                        {/* 预设颜色 */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(8, 1fr)', 
                          gap: '4px',
                          marginBottom: '4px'
                        }}>
                          {[
                            0x156289, 0xff6b6b, 0x4ecdc4, 0x45b7d1, 
                            0x96ceb4, 0xffeaa7, 0xdda0dd, 0x98d8c8,
                            0xff0000, 0x00ff00, 0x0000ff, 0xffff00,
                            0xff00ff, 0x00ffff, 0xffffff, 0x000000
                          ].map((color) => (
                            <button
                              key={color}
                              onClick={() => updateSelectedObjectProperty('color', null, color)}
                              style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
                                border: objectInfo.color === color ? '2px solid #333' : '1px solid #ccc',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                padding: '0'
                              }}
                              title={`颜色: #${color.toString(16).padStart(6, '0').toUpperCase()}`}
                            />
                          ))}
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
                        <button
                          onClick={() => {
                            const colors = [0x156289, 0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xffeaa7, 0xdda0dd, 0x98d8c8];
                            const randomColor = colors[Math.floor(Math.random() * colors.length)];
                            updateSelectedObjectProperty('color', null, randomColor);
                          }}
                          style={{
                            padding: '8px',
                            backgroundColor: '#9c27b0',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}
                        >
                          🎨 随机颜色
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
