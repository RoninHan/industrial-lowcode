import { useEffect, useState } from "react";
import { threeStore } from "../../stores/threeStore";
import { Segmented, Tree } from "antd";
import Info from "./info";
import MonacoEditor from '@monaco-editor/react'

function Properties() {
    const { setSelectedObjName, selectedObj, meshArr, scene } = threeStore;

    const [treeData, setTreeData] = useState<any[]>();
    useEffect(() => {
        if(scene) {
            setTreeData([
                {
                    title: 'Scene',
                    key: 'root',
                    children: scene
                }
            ]);
        }
    }, [scene]);

    function handleSelect(selectKeys: any, info: any) {
        const name = info.node.name;
        setSelectedObjName(name);
    }

    const [key, setKey] = useState<string>('属性');

    return <div className="Properties">
        <Segmented value={key} onChange={setKey} block options={['属性', 'json']} />
        {
            key === '属性' ? <div>
                <Tree treeData={treeData} expandedKeys={['root']} onSelect={handleSelect}/>
                <Info/>
            </div> : null
        }
        { key === 'json' ? 
            <MonacoEditor
                height={'90%'}
                path='code.json'
                language='json'
                value={JSON.stringify(meshArr, null, 2)}
            /> : null
        }
    </div>
}

export default Properties;