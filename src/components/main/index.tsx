import { useEffect, useRef } from "react";
import { observer } from "mobx-react";
import { init } from "./init.ts";
import { MeshTypes, threeStore } from "../../stores/threeStore";
import * as THREE from 'three';
import { FloatButton } from "antd";
import { ArrowsAltOutlined, DragOutlined, RetweetOutlined } from "@ant-design/icons";

const Main = observer(() => {
    const { selectedObjName, setSceneTree, meshArr, addMesh, selectedObj, removeMesh, updateMeshInfo } = threeStore;

    const sceneRef = useRef<any>(null);
    const transformControlsModeRef = useRef<any>(null);
    const transformControlsAttachObjRef = useRef<any>(null);

    function onSelected(obj: any) {
        threeStore.setSelectedObj(obj);
    }

    useEffect(() => {
        if (selectedObjName && sceneRef.current) {
            const obj = (sceneRef.current as any).getObjectByName(selectedObjName);
            threeStore.setSelectedObj(obj);
            (transformControlsAttachObjRef.current as any)(obj);
        }
    }, [selectedObjName]);

    useEffect(() => {
        function handleKeydown(e: KeyboardEvent) {
            if (e.key === 'Backspace') {
                if (selectedObj) {
                    (transformControlsAttachObjRef.current as any)(null);
                    (sceneRef.current as any).remove(selectedObj);
                    removeMesh(selectedObj.name);
                }
            }
        }
        window.addEventListener('keydown', handleKeydown);
        return () => {
            window.removeEventListener('keydown', handleKeydown);
        }
    }, [selectedObj]);

    useEffect(() => {
        const dom = document.getElementById('threejs-container');
        if (!dom) return;
        const { scene, setTransformControlsMode, transformControlsAttachObj } = init(
            dom,
            { meshArr },
            onSelected,
            (name: string, info: any, type: string) => {
                // 这里将 type 的类型改为 string，兼容 init 的参数类型
                updateMeshInfo(name, info, type as "position" | "scale" | "rotation");
            }
        );

        sceneRef.current = scene;
        transformControlsModeRef.current = setTransformControlsMode;
        transformControlsAttachObjRef.current = transformControlsAttachObj;

        const tree = (scene.children as any[]).map((item: any) => {
            if (item.isTransformControlsRoot) {
                return null;
            }

            return {
                title: item.isMesh ? item.geometry.type : item.type,
                key: item.type + item.name + item.id,
                name: item.name
            }
        }).filter((item: any) => item !== null);

        setSceneTree(tree);
        return () => {
            dom.innerHTML = '';
        }
    }, []);

    useEffect(() => {
        const scene = sceneRef.current as any;
        if (!scene) return;
        // 先移除所有 meshArr 相关的 mesh
        meshArr.forEach((item: any) => {
            const oldMesh = scene.getObjectByName(item.name);
            if (oldMesh) {
                scene.remove(oldMesh);
            }
        });
        // 再添加所有 meshArr 的 mesh
        meshArr.forEach((item: any) => {
            let mesh;
            if (item.type === MeshTypes.Box) {
                const { width, height, depth, material: { color }, position, scale, rotation } = item.props;
                const geometry = new THREE.BoxGeometry(width, height, depth);
                const material = new THREE.MeshPhongMaterial({ color });
                mesh = new THREE.Mesh(geometry, material);
            } else if (item.type === MeshTypes.Cylinder) {
                const { radiusTop, radiusBottom, height, material: { color }, position, scale, rotation } = item.props;
                const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height);
                const material = new THREE.MeshPhongMaterial({ color });
                mesh = new THREE.Mesh(geometry, material);
            }
            if (mesh) {
                mesh.name = item.name;
                mesh.position.copy(item.props.position);
                mesh.scale.copy(item.props.scale);
                mesh.rotation.x = item.props.rotation.x;
                mesh.rotation.y = item.props.rotation.y;
                mesh.rotation.z = item.props.rotation.z;
                mesh.material.color = new THREE.Color(item.props.material.color);
                scene.add(mesh);
            }
        });

        const tree = (scene.children as any[]).map((item: any) => {
            if (item.isTransformControlsRoot) {
                return null;
            }
            return {
                title: item.isMesh ? item.geometry.type : item.type,
                key: item.type + item.name + item.id,
                name: item.name
            }
        }).filter((item: any) => item !== null);

        setSceneTree(tree);
    }, [meshArr]);

    function setMode(mode: string) {
        transformControlsModeRef.current(mode);
    }

    return <div className="Main">
        <div id="threejs-container"></div>
        <FloatButton.Group className="btn-group">
            <FloatButton icon={<DragOutlined />} onClick={() => setMode('translate')} />
            <FloatButton icon={<RetweetOutlined />} onClick={() => setMode('rotate')} />
            <FloatButton icon={<ArrowsAltOutlined />} onClick={() => setMode('scale')} />
        </FloatButton.Group>
    </div>
});

export default Main;