import { makeAutoObservable, observable } from 'mobx';

export type MeshType = 'Box' | 'Cylinder';

export interface Mesh {
    id: string;
    type: MeshType;
    name: string;
    props: any;
}

function createBox(): Mesh {
    const newId = Math.random().toString().slice(2, 8);
    return {
        id: newId,
        type: 'Box',
        name: 'Box' + newId,
        props: {
            width: 200,
            height: 200,
            depth: 200,
            material: {
                color: 'orange',
            },
            position: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            rotation: { x: 0, y: 0, z: 0 }
        }
    };
}

function createCylinder(): Mesh {
    const newId = Math.random().toString().slice(2, 8);
    return {
        id: newId,
        type: 'Cylinder',
        name: 'Cylinder' + newId,
        props: {
            radiusTop: 200,
            radiusBottom: 200,
            height: 300,
            material: {
                color: 'orange',
            },
            position: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            rotation: { x: 0, y: 0, z: 0 }
        }
    };
}

class ThreeStore {
    meshArr: Mesh[] = [];
    sceneInstance: any = null; // Three.js Scene 实例
    sceneTree: any = null;     // 用于 Tree 组件的数据
    selectedObj: any = null;
    selectedObjName: string | null = null;

    constructor() {
        makeAutoObservable(this);
    }

    setSceneInstance = (scene: any) => {
        this.sceneInstance = scene;
    }

    setSceneTree = (tree: any) => {
        this.sceneTree = tree;
    }

    setSelectedObj(obj: any) {
        this.selectedObj = obj;
    }

    setSelectedObjName(name: string) {
        this.selectedObjName = name;
    }

    removeMesh(name: string) {
        this.meshArr = this.meshArr.filter(mesh => mesh.name !== name);
    }

    addMesh(type: MeshType) {
        console.log(this);
        if (type === 'Box') {
            this.meshArr.push(createBox());
        } else if (type === 'Cylinder') {
            this.meshArr.push(createCylinder());
        }
    }

    updateMaterial(name: string, info: any) {
        this.meshArr = this.meshArr.map(mesh => {
            if (mesh.name === name) {
                mesh.props.material = {
                    ...mesh.props.material,
                    ...info
                };
            }
            return mesh;
        });
    }

    updateMeshInfo(name: string, info: any, type: 'position' | 'scale' | 'rotation') {
        this.meshArr = this.meshArr.map(mesh => {
            if (mesh.name === name) {
                if (type === 'position') {
                    mesh.props.position = info;
                } else if (type === 'scale') {
                    mesh.props.scale = info;
                } else if (type === 'rotation') {
                    mesh.props.rotation = {
                        x: info.x,
                        y: info.y,
                        z: info.z
                    };
                }
            }
            return mesh;
        });
    }
}

export const threeStore = new ThreeStore();

export const MeshTypes = {
    Box: 'Box',
    Cylinder: 'Cylinder'
};
