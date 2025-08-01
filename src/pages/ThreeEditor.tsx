import React from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// 引入draco_encoder.js
import 'three/examples/jsm/libs/draco/draco_encoder.js';
// 引入codemirror.css
import 'codemirror/lib/codemirror.css';
// 引入monokai.css
import './ThreeEditorAssets/js/libs/codemirror/codemirror.css';
// 引入codemirror.js
import './ThreeEditorAssets/js/libs/codemirror/codemirror.js';
// javascript.js
import './ThreeEditorAssets/js/libs/codemirror/mode/javascript.js';
// glsl.js
import './ThreeEditorAssets/js/libs/codemirror/mode/glsl.js';
// esprima.js
import './ThreeEditorAssets/js/libs/esprima.js';
// jsonlint.js
import './ThreeEditorAssets/js/libs/jsonlint.js';
// dialog.css
import './ThreeEditorAssets/js/libs/codemirror/addon/dialog.css';
// show-hint.css
import './ThreeEditorAssets/js/libs/codemirror/addon/show-hint.css';
// tern.css
import './ThreeEditorAssets/js/libs/codemirror/addon/tern.css';



const ThreeEditor: React.FC = () => {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <iframe
        src="https://threejs.org/editor/"
        title="Three.js Editor"
        style={{ border: 'none', width: '100%', height: '100%' }}
        allowFullScreen
      />
    </div>
  );
};

export default ThreeEditor;
