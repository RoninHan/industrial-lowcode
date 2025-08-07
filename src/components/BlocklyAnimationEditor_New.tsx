import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import 'blockly/javascript';
import * as THREE from 'three';

// 动画步骤接口
interface AnimationStep {
  id: string;
  type: 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight' | 'moveForward' | 'moveBackward' | 
        'rotateX' | 'rotateY' | 'rotateZ' | 'scaleUp' | 'scaleDown' | 'pause';
  duration: number;
  distance?: number;
  scale?: number;
}

interface BlocklyAnimationEditorProps {
  selectedObject: THREE.Mesh | null;
  onAnimationStepsChange?: (steps: AnimationStep[]) => void;
  onPlayAnimation?: (steps: AnimationStep[]) => void;
  onStopAnimation?: () => void;
  onResetAnimation?: () => void;
  visible?: boolean;
}

// 定义自定义动画块
const defineAnimationBlocks = () => {
  // 移动块
  Blockly.Blocks['move_animation'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('移动')
        .appendField(new Blockly.FieldDropdown([
          ['向上', 'moveUp'],
          ['向下', 'moveDown'],
          ['向左', 'moveLeft'],
          ['向右', 'moveRight'],
          ['向前', 'moveForward'],
          ['向后', 'moveBackward']
        ]), 'DIRECTION');
      this.appendValueInput('DISTANCE')
        .setCheck('Number')
        .appendField('距离');
      this.appendValueInput('DURATION')
        .setCheck('Number')
        .appendField('时长');
      this.appendDummyInput()
        .appendField('秒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('移动物体到指定方向');
      this.setHelpUrl('');
    }
  };

  // 旋转块
  Blockly.Blocks['rotate_animation'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('旋转')
        .appendField(new Blockly.FieldDropdown([
          ['X轴', 'rotateX'],
          ['Y轴', 'rotateY'],
          ['Z轴', 'rotateZ']
        ]), 'AXIS');
      this.appendValueInput('ANGLE')
        .setCheck('Number')
        .appendField('角度');
      this.appendValueInput('DURATION')
        .setCheck('Number')
        .appendField('时长');
      this.appendDummyInput()
        .appendField('秒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip('旋转物体');
      this.setHelpUrl('');
    }
  };

  // 缩放块
  Blockly.Blocks['scale_animation'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('缩放')
        .appendField(new Blockly.FieldDropdown([
          ['放大', 'scaleUp'],
          ['缩小', 'scaleDown']
        ]), 'TYPE');
      this.appendValueInput('SCALE')
        .setCheck('Number')
        .appendField('倍数');
      this.appendValueInput('DURATION')
        .setCheck('Number')
        .appendField('时长');
      this.appendDummyInput()
        .appendField('秒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip('缩放物体大小');
      this.setHelpUrl('');
    }
  };

  // 暂停块
  Blockly.Blocks['pause_animation'] = {
    init: function() {
      this.appendValueInput('DURATION')
        .setCheck('Number')
        .appendField('暂停');
      this.appendDummyInput()
        .appendField('秒');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(60);
      this.setTooltip('暂停指定时间');
      this.setHelpUrl('');
    }
  };

  // 数字输入块
  Blockly.Blocks['number_value'] = {
    init: function() {
      this.appendDummyInput()
        .appendField(new Blockly.FieldNumber(1, 0), 'VALUE');
      this.setOutput(true, 'Number');
      this.setColour(210);
      this.setTooltip('数字值');
      this.setHelpUrl('');
    }
  };

  // 循环块
  Blockly.Blocks['repeat_animation'] = {
    init: function() {
      this.appendValueInput('TIMES')
        .setCheck('Number')
        .appendField('重复');
      this.appendDummyInput()
        .appendField('次');
      this.appendStatementInput('DO')
        .appendField('执行');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip('重复执行动画序列');
      this.setHelpUrl('');
    }
  };
};

const BlocklyAnimationEditor: React.FC<BlocklyAnimationEditorProps> = ({
  selectedObject,
  onAnimationStepsChange,
  onPlayAnimation,
  onStopAnimation,
  onResetAnimation,
  visible = true
}) => {
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [animationSteps, setAnimationSteps] = useState<AnimationStep[]>([]);

  // 工具箱配置
  const toolboxXml = `
    <xml>
      <category name="移动" colour="120">
        <block type="move_animation">
          <value name="DISTANCE">
            <block type="number_value">
              <field name="VALUE">1</field>
            </block>
          </value>
          <value name="DURATION">
            <block type="number_value">
              <field name="VALUE">1</field>
            </block>
          </value>
        </block>
      </category>
      <category name="旋转" colour="230">
        <block type="rotate_animation">
          <value name="ANGLE">
            <block type="number_value">
              <field name="VALUE">90</field>
            </block>
          </value>
          <value name="DURATION">
            <block type="number_value">
              <field name="VALUE">1</field>
            </block>
          </value>
        </block>
      </category>
      <category name="缩放" colour="290">
        <block type="scale_animation">
          <value name="SCALE">
            <block type="number_value">
              <field name="VALUE">1.5</field>
            </block>
          </value>
          <value name="DURATION">
            <block type="number_value">
              <field name="VALUE">1</field>
            </block>
          </value>
        </block>
      </category>
      <category name="控制" colour="60">
        <block type="pause_animation">
          <value name="DURATION">
            <block type="number_value">
              <field name="VALUE">1</field>
            </block>
          </value>
        </block>
        <block type="repeat_animation">
          <value name="TIMES">
            <block type="number_value">
              <field name="VALUE">3</field>
            </block>
          </value>
        </block>
      </category>
      <category name="数值" colour="210">
        <block type="number_value"></block>
      </category>
    </xml>
  `;

  // 初始化 Blockly 工作区
  useEffect(() => {
    if (!blocklyDivRef.current || !visible) return;

    // 定义自定义块
    defineAnimationBlocks();

    // 创建工作区
    const workspace = Blockly.inject(blocklyDivRef.current, {
      toolbox: toolboxXml,
      grid: {
        spacing: 20,
        length: 3,
        colour: '#ccc',
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      trashcan: true,
      scrollbars: true,
      sounds: false
    });

    workspaceRef.current = workspace;

    // 监听工作区变化
    workspace.addChangeListener((event: any) => {
      if (event.type === Blockly.Events.BLOCK_CHANGE || 
          event.type === Blockly.Events.BLOCK_CREATE || 
          event.type === Blockly.Events.BLOCK_DELETE ||
          event.type === Blockly.Events.BLOCK_MOVE) {
        parseWorkspaceToAnimationSteps();
      }
    });

    // 清理函数
    return () => {
      if (workspaceRef.current) {
        workspaceRef.current.dispose();
        workspaceRef.current = null;
      }
    };
  }, [visible]);

  // 解析工作区为动画步骤
  const parseWorkspaceToAnimationSteps = useCallback(() => {
    if (!workspaceRef.current) return;

    const steps: AnimationStep[] = [];
    const topBlocks = workspaceRef.current.getTopBlocks(false);

    const parseBlock = (block: Blockly.Block) => {
      const blockType = block.type;

      switch (blockType) {
        case 'move_animation':
          const direction = block.getFieldValue('DIRECTION');
          const distance = getBlockValue(block, 'DISTANCE') || 1;
          const moveDuration = getBlockValue(block, 'DURATION') || 1;
          
          steps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: direction as any,
            duration: moveDuration,
            distance: distance
          });
          break;

        case 'rotate_animation':
          const axis = block.getFieldValue('AXIS');
          const angle = getBlockValue(block, 'ANGLE') || 90;
          const rotateDuration = getBlockValue(block, 'DURATION') || 1;
          
          steps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: axis as any,
            duration: rotateDuration,
            distance: angle * Math.PI / 180 // 转换为弧度
          });
          break;

        case 'scale_animation':
          const scaleType = block.getFieldValue('TYPE');
          const scale = getBlockValue(block, 'SCALE') || 1.5;
          const scaleDuration = getBlockValue(block, 'DURATION') || 1;
          
          steps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: scaleType as any,
            duration: scaleDuration,
            scale: scale
          });
          break;

        case 'pause_animation':
          const pauseDuration = getBlockValue(block, 'DURATION') || 1;
          
          steps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: 'pause',
            duration: pauseDuration
          });
          break;

        case 'repeat_animation':
          const times = getBlockValue(block, 'TIMES') || 1;
          const doBlock = block.getInputTargetBlock('DO');
          
          // 获取重复执行的步骤
          const repeatSteps: AnimationStep[] = [];
          if (doBlock) {
            let currentBlock: Blockly.Block | null = doBlock;
            while (currentBlock) {
              const subSteps: AnimationStep[] = [];
              parseBlockRecursive(currentBlock, subSteps);
              repeatSteps.push(...subSteps);
              currentBlock = currentBlock.getNextBlock();
            }
          }
          
          // 复制步骤指定次数
          for (let i = 0; i < times; i++) {
            repeatSteps.forEach(step => {
              steps.push({
                ...step,
                id: `step_${Date.now()}_${Math.random()}`
              });
            });
          }
          break;
      }

      // 处理下一个连接的块
      const nextBlock = block.getNextBlock();
      if (nextBlock) {
        parseBlock(nextBlock);
      }
    };

    // 递归解析块的辅助函数
    const parseBlockRecursive = (block: Blockly.Block, targetSteps: AnimationStep[]) => {
      const blockType = block.type;

      switch (blockType) {
        case 'move_animation':
          const direction = block.getFieldValue('DIRECTION');
          const distance = getBlockValue(block, 'DISTANCE') || 1;
          const moveDuration = getBlockValue(block, 'DURATION') || 1;
          
          targetSteps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: direction as any,
            duration: moveDuration,
            distance: distance
          });
          break;

        case 'rotate_animation':
          const axis = block.getFieldValue('AXIS');
          const angle = getBlockValue(block, 'ANGLE') || 90;
          const rotateDuration = getBlockValue(block, 'DURATION') || 1;
          
          targetSteps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: axis as any,
            duration: rotateDuration,
            distance: angle * Math.PI / 180
          });
          break;

        case 'scale_animation':
          const scaleType = block.getFieldValue('TYPE');
          const scale = getBlockValue(block, 'SCALE') || 1.5;
          const scaleDuration = getBlockValue(block, 'DURATION') || 1;
          
          targetSteps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: scaleType as any,
            duration: scaleDuration,
            scale: scale
          });
          break;

        case 'pause_animation':
          const pauseDuration = getBlockValue(block, 'DURATION') || 1;
          
          targetSteps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: 'pause',
            duration: pauseDuration
          });
          break;
      }
    };

    // 解析所有顶级块
    topBlocks.forEach(block => {
      parseBlock(block);
    });

    setAnimationSteps(steps);
    onAnimationStepsChange?.(steps);
  }, [onAnimationStepsChange]);

  // 获取块的数值输入
  const getBlockValue = (block: Blockly.Block, inputName: string): number => {
    const targetBlock = block.getInputTargetBlock(inputName);
    if (targetBlock && targetBlock.type === 'number_value') {
      return parseFloat(targetBlock.getFieldValue('VALUE')) || 0;
    }
    return 0;
  };

  // 播放动画
  const handlePlay = useCallback(() => {
    onPlayAnimation?.(animationSteps);
  }, [animationSteps, onPlayAnimation]);

  // 停止动画
  const handleStop = useCallback(() => {
    onStopAnimation?.();
  }, [onStopAnimation]);

  // 重置动画
  const handleReset = useCallback(() => {
    onResetAnimation?.();
  }, [onResetAnimation]);

  // 清空工作区
  const handleClear = useCallback(() => {
    if (workspaceRef.current) {
      workspaceRef.current.clear();
      setAnimationSteps([]);
      onAnimationStepsChange?.([]);
    }
  }, [onAnimationStepsChange]);

  // 加载示例动画
  const loadExample = useCallback(() => {
    if (!workspaceRef.current) return;

    const exampleXml = `
      <xml>
        <block type="move_animation" x="20" y="20">
          <field name="DIRECTION">moveUp</field>
          <value name="DISTANCE">
            <block type="number_value">
              <field name="VALUE">2</field>
            </block>
          </value>
          <value name="DURATION">
            <block type="number_value">
              <field name="VALUE">1</field>
            </block>
          </value>
          <next>
            <block type="rotate_animation">
              <field name="AXIS">rotateY</field>
              <value name="ANGLE">
                <block type="number_value">
                  <field name="VALUE">180</field>
                </block>
              </value>
              <value name="DURATION">
                <block type="number_value">
                  <field name="VALUE">2</field>
                </block>
              </value>
              <next>
                <block type="scale_animation">
                  <field name="TYPE">scaleUp</field>
                  <value name="SCALE">
                    <block type="number_value">
                      <field name="VALUE">1.5</field>
                    </block>
                  </value>
                  <value name="DURATION">
                    <block type="number_value">
                      <field name="VALUE">1</field>
                    </block>
                  </value>
                </block>
              </next>
            </block>
          </next>
        </block>
      </xml>
    `;

    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(exampleXml, 'text/xml');
      workspaceRef.current.clear();
      Blockly.Xml.domToWorkspace(xml.documentElement, workspaceRef.current);
    } catch (error) {
      console.error('Error loading example:', error);
    }
  }, []);

  if (!visible) return null;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f8f9fa'
    }}>
      {/* 工具栏 */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #dee2e6',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#495057' }}>
          Blockly 动画编辑器
        </span>
        <div style={{ flex: 1 }} />
        
        <button
          onClick={loadExample}
          style={{
            padding: '6px 12px',
            backgroundColor: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
          title="加载示例动画"
        >
          示例
        </button>
        
        <button
          onClick={handlePlay}
          disabled={animationSteps.length === 0}
          style={{
            padding: '6px 12px',
            backgroundColor: animationSteps.length === 0 ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: animationSteps.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          播放 ({animationSteps.length})
        </button>
        
        <button
          onClick={handleStop}
          style={{
            padding: '6px 12px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          停止
        </button>
        
        <button
          onClick={handleReset}
          style={{
            padding: '6px 12px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          重置
        </button>
        
        <button
          onClick={handleClear}
          style={{
            padding: '6px 12px',
            backgroundColor: '#ffc107',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold'
          }}
        >
          清空
        </button>
      </div>

      {/* Blockly 工作区 */}
      <div 
        ref={blocklyDivRef}
        style={{
          flex: 1,
          minHeight: '400px'
        }}
      />

      {/* 状态栏 */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#fff',
        borderTop: '1px solid #dee2e6',
        fontSize: '12px',
        color: '#6c757d',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <span>
          动画步骤: <strong>{animationSteps.length}</strong>
        </span>
        <span>
          总时长: <strong>
            {animationSteps.reduce((total, step) => total + step.duration, 0).toFixed(1)}秒
          </strong>
        </span>
        {selectedObject && (
          <span>
            目标物体: <strong>{selectedObject.uuid.slice(0, 8)}</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default BlocklyAnimationEditor;
