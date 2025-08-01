import React from 'react';

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
