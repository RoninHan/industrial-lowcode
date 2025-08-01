
// 引入React及其hooks
import React, { useEffect, useRef } from 'react';
// 引入Ammo.js物理引擎
import Ammo from 'ammo.js';
// 引入Three.js用於3D渲染
import * as THREE from 'three';
// 引入Three.js的軌道控制器，支持滑鼠鏡頭移動
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';


// 定義AmmoDemo組件
const AmmoDemo: React.FC = () => {
  // canvasRef用於綁定渲染容器
  const canvasRef = useRef<HTMLDivElement>(null);

  // 組件掛載時執行初始化
  useEffect(() => {
    let physicsWorld: any; // 物理世界
    let boxBody: any; // 立方體剛體
    let groundBody: any; // 地面剛體
    let transform: any; // 剛體變換
    let scene: THREE.Scene; // Three.js場景
    let camera: THREE.PerspectiveCamera; // Three.js相機
    let renderer: THREE.WebGLRenderer; // Three.js渲染器
    let boxMesh: THREE.Mesh; // Three.js立方體網格
    let controls: OrbitControls; // Three.js鏡頭控制器
    let animationId: number; // 動畫ID

    // 初始化物理和渲染
    const initPhysics = async () => {
      let AmmoLib: any = Ammo; // Ammo.js庫
      if (typeof AmmoLib === 'function') { // 檢查是否需要Promise初始化
        AmmoLib = await AmmoLib(); // 初始化Ammo.js
      }

      const collisionConfiguration = new AmmoLib.btDefaultCollisionConfiguration(); // 碰撞配置
      const dispatcher = new AmmoLib.btCollisionDispatcher(collisionConfiguration); // 碰撞分發器
      const broadphase = new AmmoLib.btDbvtBroadphase(); // 廣義相位
      const solver = new AmmoLib.btSequentialImpulseConstraintSolver(); // 約束求解器
      physicsWorld = new AmmoLib.btDiscreteDynamicsWorld( // 創建物理世界
        dispatcher,
        broadphase,
        solver,
        collisionConfiguration
      );
      physicsWorld.setGravity(new AmmoLib.btVector3(0, -10, 0)); // 設置重力

      // 地面剛體
      const groundShape = new AmmoLib.btBoxShape(new AmmoLib.btVector3(50, 1, 50)); // 地面形狀
      const groundTransform = new AmmoLib.btTransform(); // 地面變換
      groundTransform.setIdentity(); // 變換初始化
      groundTransform.setOrigin(new AmmoLib.btVector3(0, -1, 0)); // 地面位置
      const groundMass = 0; // 地面質量
      const groundLocalInertia = new AmmoLib.btVector3(0, 0, 0); // 地面慣性
      const groundMotionState = new AmmoLib.btDefaultMotionState(groundTransform); // 地面運動狀態
      const groundRbInfo = new AmmoLib.btRigidBodyConstructionInfo( // 創建地面剛體信息
        groundMass,
        groundMotionState,
        groundShape,
        groundLocalInertia
      );
      groundBody = new AmmoLib.btRigidBody(groundRbInfo); // 創建地面剛體
      physicsWorld.addRigidBody(groundBody); // 加入物理世界

      // 立方體剛體
      const boxShape = new AmmoLib.btBoxShape(new AmmoLib.btVector3(1, 1, 1)); // 立方體形狀
      const boxTransform = new AmmoLib.btTransform(); // 立方體變換
      boxTransform.setIdentity(); // 變換初始化
      boxTransform.setOrigin(new AmmoLib.btVector3(0, 10, 0)); // 立方體初始位置
      const boxMass = 1; // 立方體質量
      const boxLocalInertia = new AmmoLib.btVector3(0, 0, 0); // 立方體慣性
      boxShape.calculateLocalInertia(boxMass, boxLocalInertia); // 計算慣性
      const boxMotionState = new AmmoLib.btDefaultMotionState(boxTransform); // 立方體運動狀態
      const boxRbInfo = new AmmoLib.btRigidBodyConstructionInfo( // 創建立方體剛體信息
        boxMass,
        boxMotionState,
        boxShape,
        boxLocalInertia
      );
      boxBody = new AmmoLib.btRigidBody(boxRbInfo); // 創建立方體剛體
      physicsWorld.addRigidBody(boxBody); // 加入物理世界

      transform = new AmmoLib.btTransform(); // 創建變換對象

      // Three.js渲染部分
      scene = new THREE.Scene(); // 創建場景
      camera = new THREE.PerspectiveCamera(75, 640 / 480, 0.1, 1000); // 創建相機
      camera.position.set(0, 5, 20); // 設置相機位置
      renderer = new THREE.WebGLRenderer(); // 創建渲染器
      renderer.setSize(640, 480); // 設置渲染尺寸
      if (canvasRef.current) { // 綁定渲染容器
        canvasRef.current.innerHTML = '';
        canvasRef.current.appendChild(renderer.domElement);
      }
      // 創建鏡頭控制器
      controls = new OrbitControls(camera, renderer.domElement); // 綁定控制器
      controls.enableDamping = true; // 啟用阻尼
      controls.dampingFactor = 0.1; // 阻尼係數
      controls.target.set(0, 0, 0); // 鏡頭目標

      // 地面網格
      const groundGeometry = new THREE.BoxGeometry(100, 2, 100); // 地面幾何
      const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 }); // 地面材質
      const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial); // 地面網格
      groundMesh.position.set(0, -1, 0); // 地面位置
      scene.add(groundMesh); // 加入場景

      // 立方體網格
      const boxGeometry = new THREE.BoxGeometry(2, 2, 2); // 立方體幾何
      const boxMaterial = new THREE.MeshPhongMaterial({ color: 0x2196f3 }); // 立方體材質
      boxMesh = new THREE.Mesh(boxGeometry, boxMaterial); // 立方體網格
      scene.add(boxMesh); // 加入場景

      // 光源
      const light = new THREE.DirectionalLight(0xffffff, 1); // 創建平行光
      light.position.set(10, 20, 10); // 光源位置
      scene.add(light); // 加入場景

      // 動畫循環
      const animate = () => {
        physicsWorld.stepSimulation(1 / 60, 10); // 物理世界步進
        boxBody.getMotionState().getWorldTransform(transform); // 取得立方體最新位置
        const origin = transform.getOrigin(); // 取得位置向量
        boxMesh.position.set(origin.x(), origin.y(), origin.z()); // 同步Three.js立方體位置
        controls.update(); // 更新鏡頭控制器
        renderer.render(scene, camera); // 渲染場景
        const posDiv = document.getElementById('ammo-box-pos'); // 取得位置顯示div
        if (posDiv) {
          posDiv.textContent =
            `Box position: x=${origin.x().toFixed(2)}, y=${origin.y().toFixed(2)}, z=${origin.z().toFixed(2)}`; // 顯示座標
        }
        animationId = requestAnimationFrame(animate); // 下一幀
      };
      animate(); // 啟動動畫
    };

    initPhysics(); // 初始化物理和渲染

    // 組件卸載時清理資源
    return () => {
      if (animationId) cancelAnimationFrame(animationId); // 停止動畫
      if (renderer) renderer.dispose(); // 釋放渲染器
      if (controls) controls.dispose(); // 釋放控制器
    };
  }, []);

  // 組件渲染
  return (
    <div style={{ padding: 24 }}>
      <h2>Ammo.js + Three.js Demo</h2> {/* Demo標題 */}
      <div ref={canvasRef} style={{ width: 640, height: 480, background: '#222' }} /> {/* 渲染容器 */}
      <div id="ammo-box-pos">Box position: </div> {/* 位置顯示 */}
      <p>這個Demo展示了一個立方體在重力作用下落到地面，並用Three.js渲染。</p> {/* 說明文字 */}
    </div>
  );
};

export default AmmoDemo; // 導出組件
