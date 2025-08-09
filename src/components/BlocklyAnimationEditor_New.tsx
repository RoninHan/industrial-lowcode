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
  existingAnimationSteps?: AnimationStep[]; // 新增：已有的动画步骤
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

  // 开始块
  Blockly.Blocks['start_animation'] = {
    init: function() {
      this.appendDummyInput()
        .appendField('开始');
      this.setNextStatement(true, null);
      this.setColour(0);
      this.setTooltip('动画开始标记，所有动画必须从这里开始');
      this.setHelpUrl('');
      this.setDeletable(false); // 不允许删除开始块
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
  existingAnimationSteps = [], // 接收已有的动画步骤
  onAnimationStepsChange,
  onPlayAnimation,
  onStopAnimation,
  onResetAnimation,
  visible = true
}) => {
  const blocklyDivRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [animationSteps, setAnimationSteps] = useState<AnimationStep[]>([]);
  const isRestoringRef = useRef<boolean>(false); // 标记是否正在恢复工作区，避免循环
  const lastRestoredStepsRef = useRef<string>(''); // 记录上次恢复的步骤JSON字符串，避免重复恢复
  const parseTimeoutRef = useRef<number | null>(null); // 防抖计时器

  // 从动画步骤恢复 Blockly 工作区 - 包含开始块
  const restoreAnimationStepsToWorkspace = useCallback((steps: AnimationStep[]) => {
    if (!workspaceRef.current || steps.length === 0) return;

    console.log('开始恢复动画步骤到工作区，步骤数量:', steps.length);
    
    // 设置恢复标记，避免在恢复过程中触发解析
    isRestoringRef.current = true;

    // 清空当前工作区
    workspaceRef.current.clear();

    // 首先创建开始块
    const startBlock = workspaceRef.current.newBlock('start_animation');
    (startBlock as any).initSvg();
    (startBlock as any).render();
    startBlock.moveBy(20, 20);

    let previousBlock: Blockly.Block | null = startBlock;

    steps.forEach((step) => {
      let block: Blockly.Block | null = null;

      switch (step.type) {
        case 'moveUp':
        case 'moveDown':
        case 'moveLeft':
        case 'moveRight':
        case 'moveForward':
        case 'moveBackward':
          block = workspaceRef.current!.newBlock('move_animation');
          block.setFieldValue(step.type, 'DIRECTION');
          
          // 设置距离值
          if (step.distance !== undefined) {
            const distanceBlock = workspaceRef.current!.newBlock('number_value');
            distanceBlock.setFieldValue(step.distance.toString(), 'VALUE');
            (distanceBlock as any).initSvg();
            (distanceBlock as any).render();
            block.getInput('DISTANCE')?.connection?.connect(distanceBlock.outputConnection!);
          }
          
          // 设置时长值
          const durationBlock = workspaceRef.current!.newBlock('number_value');
          durationBlock.setFieldValue(step.duration.toString(), 'VALUE');
          (durationBlock as any).initSvg();
          (durationBlock as any).render();
          block.getInput('DURATION')?.connection?.connect(durationBlock.outputConnection!);
          break;

        case 'rotateX':
        case 'rotateY':
        case 'rotateZ':
          block = workspaceRef.current!.newBlock('rotate_animation');
          block.setFieldValue(step.type, 'AXIS');
          
          // 设置角度值 (需要将弧度转换为度)
          const angle = step.distance ? step.distance * 180 / Math.PI : 90;
          const angleBlock = workspaceRef.current!.newBlock('number_value');
          angleBlock.setFieldValue(angle.toString(), 'VALUE');
          (angleBlock as any).initSvg();
          (angleBlock as any).render();
          block.getInput('ANGLE')?.connection?.connect(angleBlock.outputConnection!);
          
          // 设置时长值
          const rotDurationBlock = workspaceRef.current!.newBlock('number_value');
          rotDurationBlock.setFieldValue(step.duration.toString(), 'VALUE');
          (rotDurationBlock as any).initSvg();
          (rotDurationBlock as any).render();
          block.getInput('DURATION')?.connection?.connect(rotDurationBlock.outputConnection!);
          break;

        case 'scaleUp':
        case 'scaleDown':
          block = workspaceRef.current!.newBlock('scale_animation');
          block.setFieldValue(step.type, 'TYPE');
          
          // 设置缩放值
          if (step.scale !== undefined) {
            const scaleBlock = workspaceRef.current!.newBlock('number_value');
            scaleBlock.setFieldValue(step.scale.toString(), 'VALUE');
            (scaleBlock as any).initSvg();
            (scaleBlock as any).render();
            block.getInput('SCALE')?.connection?.connect(scaleBlock.outputConnection!);
          }
          
          // 设置时长值
          const scaleDurationBlock = workspaceRef.current!.newBlock('number_value');
          scaleDurationBlock.setFieldValue(step.duration.toString(), 'VALUE');
          (scaleDurationBlock as any).initSvg();
          (scaleDurationBlock as any).render();
          block.getInput('DURATION')?.connection?.connect(scaleDurationBlock.outputConnection!);
          break;

        case 'pause':
          block = workspaceRef.current!.newBlock('pause_animation');
          
          // 设置暂停时长
          const pauseDurationBlock = workspaceRef.current!.newBlock('number_value');
          pauseDurationBlock.setFieldValue(step.duration.toString(), 'VALUE');
          (pauseDurationBlock as any).initSvg();
          (pauseDurationBlock as any).render();
          block.getInput('DURATION')?.connection?.connect(pauseDurationBlock.outputConnection!);
          break;

        default:
          console.warn('未知的动画步骤类型:', step.type);
          return;
      }

      if (block) {
        // 初始化并渲染块
        (block as any).initSvg();
        (block as any).render();

        // 连接到前一个块
        if (previousBlock && previousBlock.nextConnection && block.previousConnection) {
          previousBlock.nextConnection.connect(block.previousConnection);
        }

        previousBlock = block;
      }
    });

    console.log(`已恢复 ${steps.length} 个动画步骤到 Blockly 工作区（包含开始块）`);
    
    // 恢复完成后清除标记，不设置状态避免循环
    setTimeout(() => {
      console.log('恢复过程完成，清除恢复标记');
      isRestoringRef.current = false;
      // 不在这里设置animationSteps状态，避免触发循环
    }, 200); // 增加延迟确保所有渲染完成
  }, [onAnimationStepsChange]);

  // 工具箱配置 - 类别工具箱，包含开始块
  const toolboxConfig = {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: '开始',
        colour: '0',
        expanded: true,
        contents: [
          {
            kind: 'block',
            type: 'start_animation'
          }
        ]
      },
      {
        kind: 'category',
        name: '移动',
        colour: '120',
        contents: [
          {
            kind: 'block',
            type: 'move_animation',
            inputs: {
              DISTANCE: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 1
                  }
                }
              },
              DURATION: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 1
                  }
                }
              }
            }
          }
        ]
      },
      {
        kind: 'category',
        name: '旋转',
        colour: '230',
        contents: [
          {
            kind: 'block',
            type: 'rotate_animation',
            inputs: {
              ANGLE: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 90
                  }
                }
              },
              DURATION: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 1
                  }
                }
              }
            }
          }
        ]
      },
      {
        kind: 'category',
        name: '缩放',
        colour: '290',
        contents: [
          {
            kind: 'block',
            type: 'scale_animation',
            inputs: {
              SCALE: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 1.5
                  }
                }
              },
              DURATION: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 1
                  }
                }
              }
            }
          }
        ]
      },
      {
        kind: 'category',
        name: '控制',
        colour: '60',
        contents: [
          {
            kind: 'block',
            type: 'pause_animation',
            inputs: {
              DURATION: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 1
                  }
                }
              }
            }
          },
          {
            kind: 'block',
            type: 'repeat_animation',
            inputs: {
              TIMES: {
                block: {
                  type: 'number_value',
                  fields: {
                    VALUE: 3
                  }
                }
              }
            }
          }
        ]
      },
      {
        kind: 'category',
        name: '数值',
        colour: '210',
        contents: [
          {
            kind: 'block',
            type: 'number_value'
          }
        ]
      }
    ]
  } as any;

  // 初始化 Blockly 工作区
  useEffect(() => {
    if (!blocklyDivRef.current || !visible) return;

    // 使用setTimeout确保DOM完全渲染并且没有其他操作干扰
    const initTimeout = setTimeout(() => {
      if (!blocklyDivRef.current) return;

      try {
        // 定义自定义块
        defineAnimationBlocks();

        // 确保容器有正确的尺寸
        const container = blocklyDivRef.current;
        if (container.clientWidth === 0 || container.clientHeight === 0) {
          console.warn('Blockly容器尺寸为0，延迟初始化');
          return;
        }

        // 创建工作区
        const workspace = Blockly.inject(blocklyDivRef.current, {
          toolbox: toolboxConfig,
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
          move: {
            scrollbars: false, // 禁用工作区滚动条
            drag: true,
            wheel: true
          },
          trashcan: true,
          scrollbars: false, // 全局禁用滚动条
          sounds: false,
          // 关键的拖拽配置
          readOnly: false,
          maxBlocks: Infinity,
          collapse: true,
          comments: true,
          disable: true,
          // 渲染器和主题设置
          renderer: 'geras',
          theme: Blockly.Themes.Classic,
          // 添加这些关键配置来控制拖拽行为
          toolboxPosition: 'start',
          horizontalLayout: false,
          // 修复拖拽敏感度的关键配置
          oneBasedIndex: false,
          rtl: false
        });

        workspaceRef.current = workspace;

        // 修复拖拽敏感度问题的关键配置
        // 设置拖拽阈值，防止轻微移动就触发拖拽
        try {
          // 设置更大的拖拽阈值
          (Blockly as any).DRAG_RADIUS = 15; // 增加拖拽阈值
          (Blockly as any).FLYOUT_DRAG_RADIUS = 15;
          
          // 设置工作区的拖拽配置
          if (workspace.getFlyout && workspace.getFlyout()) {
            const flyout = workspace.getFlyout();
            if (flyout) {
              // 设置flyout的拖拽配置
              (flyout as any).MARGIN = 10;
            }
          }
        } catch (error) {
          console.warn('设置拖拽配置失败:', error);
        }

        // 监听工作区变化 - 处理所有相关的变化事件
        workspace.addChangeListener((event: any) => {
          try {
            // 在恢复过程中不触发解析，避免循环
            if (isRestoringRef.current) {
              console.log('忽略恢复过程中的事件:', event.type);
              return;
            }
            
            // 处理块移动事件（包括重新排序）
            if (event.type === Blockly.Events.BLOCK_MOVE) {
              // 忽略程序化的移动操作
              if (event.reason && event.reason !== 'drag') {
                console.log('忽略非拖拽移动事件:', event.reason);
                return;
              }
              console.log('检测到块移动操作（可能是重新排序）');
            }
            
            // 处理所有可能影响动画步骤的事件
            if (event.type === Blockly.Events.BLOCK_CHANGE || 
                event.type === Blockly.Events.BLOCK_CREATE || 
                event.type === Blockly.Events.BLOCK_DELETE ||
                event.type === Blockly.Events.BLOCK_MOVE ||
                event.type === Blockly.Events.BLOCK_DRAG) {
              
              console.log('处理工作区变化事件:', event.type, event.reason || 'unknown');
              
              // 清除之前的计时器
              if (parseTimeoutRef.current) {
                clearTimeout(parseTimeoutRef.current);
              }
              
              // 添加防抖延迟处理，避免过于频繁的解析
              parseTimeoutRef.current = setTimeout(() => {
                try {
                  if (!isRestoringRef.current && workspaceRef.current) {
                    console.log('开始解析工作区变化（包括重新排序）');
                    parseWorkspaceToAnimationSteps();
                  }
                } catch (parseError) {
                  console.error('解析工作区动画步骤时出错:', parseError);
                }
                parseTimeoutRef.current = null;
              }, 200) as unknown as number; // 减少防抖延迟，提高响应性
            } else {
              console.log('忽略事件类型:', event.type);
            }
          } catch (listenerError) {
            console.error('工作区变化监听器出错:', listenerError);
          }
        });

        // 移除重复的监听器以避免冲突

        console.log('Blockly工作区初始化成功，拖拽功能应该正常工作');
        
      } catch (error) {
        console.error('Blockly初始化失败:', error);
        // 确保即使初始化失败也不会导致页面刷新
      }
    }, 100); // 增加延迟确保DOM渲染完成

    // 清理函数
    return () => {
      try {
        clearTimeout(initTimeout);
        if (parseTimeoutRef.current) {
          clearTimeout(parseTimeoutRef.current);
          parseTimeoutRef.current = null;
        }
        if (workspaceRef.current) {
          workspaceRef.current.dispose();
          workspaceRef.current = null;
        }
      } catch (cleanupError) {
        console.error('清理Blockly工作区时出错:', cleanupError);
      }
    };
  }, [visible]); // 移除 existingAnimationSteps 依赖，避免不必要的重新初始化

  // 监听选中物体变化，恢复对应的动画步骤
  useEffect(() => {
    // 如果工作区还没有初始化，延迟处理
    if (!workspaceRef.current) {
      if (existingAnimationSteps.length > 0) {
        const restoreTimer = setTimeout(() => {
          if (workspaceRef.current) {
            console.log('延迟恢复动画步骤');
            restoreAnimationStepsToWorkspace(existingAnimationSteps);
          }
        }, 500);
        return () => clearTimeout(restoreTimer);
      }
      return;
    }
    
    // 避免在恢复过程中重复触发
    if (isRestoringRef.current) {
      console.log('跳过恢复（正在恢复中）');
      return;
    }
    
    // 检查是否和上次恢复的步骤相同，避免重复恢复
    const currentStepsString = JSON.stringify(existingAnimationSteps);
    if (lastRestoredStepsRef.current === currentStepsString) {
      console.log('跳过恢复（步骤未变化）');
      return;
    }
    
    // 检查当前工作区的内容是否已经匹配期望的步骤
    const currentBlocks = workspaceRef.current.getAllBlocks();
    if (existingAnimationSteps.length === 0 && currentBlocks.length === 0) {
      // 如果期望为空且当前也为空，无需操作
      lastRestoredStepsRef.current = currentStepsString;
      console.log('跳过恢复（都为空）');
      return;
    }
    
    if (existingAnimationSteps.length > 0) {
      // 需要恢复步骤
      lastRestoredStepsRef.current = currentStepsString;
      console.log('准备恢复动画步骤到工作区，步骤数量:', existingAnimationSteps.length);
      setTimeout(() => {
        if (!isRestoringRef.current) { // 再次检查恢复状态
          restoreAnimationStepsToWorkspace(existingAnimationSteps);
        }
      }, 100);
    } else if (currentBlocks.length > 0) {
      // 如果没有已有动画步骤但工作区有内容，清空工作区
      lastRestoredStepsRef.current = '';
      console.log('清空工作区（无动画步骤）');
      isRestoringRef.current = true;
      workspaceRef.current.clear();
      setTimeout(() => {
        isRestoringRef.current = false;
        console.log('工作区清空完成');
      }, 100);
    }
  }, [selectedObject]); // 只依赖选中物体变化，避免循环

  // 解析工作区为动画步骤 - 确保从开始块开始
  const parseWorkspaceToAnimationSteps = useCallback(() => {
    if (!workspaceRef.current || isRestoringRef.current) return;

    console.log('开始解析工作区动画步骤（必须从开始块开始）...');
    
    const steps: AnimationStep[] = [];
    const topBlocks = workspaceRef.current.getTopBlocks(false);

    // 查找开始块
    const startBlock = topBlocks.find(block => block.type === 'start_animation');
    
    if (!startBlock) {
      console.log('未找到开始块，动画序列无效');
      setAnimationSteps([]);
      onAnimationStepsChange?.([]);
      return;
    }

    console.log('找到开始块，开始解析动画序列');

    const parseBlock = (block: Blockly.Block) => {
      const blockType = block.type;
      console.log('解析块:', blockType, '位置:', block.getRelativeToSurfaceXY());

      switch (blockType) {
        case 'start_animation':
          console.log('  → 跳过开始块');
          break;

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
          console.log('  → 添加移动步骤:', direction, '距离:', distance, '时长:', moveDuration);
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
          console.log('  → 添加旋转步骤:', axis, '角度:', angle, '时长:', rotateDuration);
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
          console.log('  → 添加缩放步骤:', scaleType, '倍数:', scale, '时长:', scaleDuration);
          break;

        case 'pause_animation':
          const pauseDuration = getBlockValue(block, 'DURATION') || 1;
          
          steps.push({
            id: `step_${Date.now()}_${Math.random()}`,
            type: 'pause',
            duration: pauseDuration
          });
          console.log('  → 添加暂停步骤，时长:', pauseDuration);
          break;

        case 'repeat_animation':
          const times = getBlockValue(block, 'TIMES') || 1;
          const doBlock = block.getInputTargetBlock('DO');
          
          console.log('  → 处理重复块，次数:', times);
          
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
          console.log('     重复块生成了', repeatSteps.length * times, '个步骤');
          break;
      }

      // 处理下一个连接的块
      const nextBlock = block.getNextBlock();
      if (nextBlock) {
        console.log('  → 处理下一个连接的块:', nextBlock.type);
        parseBlock(nextBlock);
      }
    };

    // 递归解析块的辅助函数
    const parseBlockRecursive = (block: Blockly.Block, targetSteps: AnimationStep[]) => {
      const blockType = block.type;

      switch (blockType) {
        case 'start_animation':
          // 跳过开始块
          break;

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

    // 从开始块开始解析整个序列
    parseBlock(startBlock);

    console.log(`解析完成，共 ${steps.length} 个动画步骤，步骤顺序:`, steps.map(s => s.type));
    
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

  // 播放动画 - 检查是否有开始块
  const handlePlay = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    // 检查工作区是否有开始块
    if (workspaceRef.current) {
      const topBlocks = workspaceRef.current.getTopBlocks(false);
      const hasStartBlock = topBlocks.some(block => block.type === 'start_animation');
      
      if (!hasStartBlock) {
        alert('动画必须从"开始"块开始！请从工具箱中拖入"开始"块。');
        return;
      }
    }
    
    if (animationSteps.length === 0) {
      alert('没有动画步骤可以播放！请添加动画块并连接到"开始"块。');
      return;
    }
    
    onPlayAnimation?.(animationSteps);
  }, [animationSteps, onPlayAnimation]);

  // 停止动画
  const handleStop = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onStopAnimation?.();
  }, [onStopAnimation]);

  // 重置动画
  const handleReset = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onResetAnimation?.();
  }, [onResetAnimation]);

  // 清空工作区
  const handleClear = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (workspaceRef.current) {
      workspaceRef.current.clear();
      setAnimationSteps([]);
      onAnimationStepsChange?.([]);
    }
  }, [onAnimationStepsChange]);

  // 加载示例动画 - 包含开始块
  const loadExample = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!workspaceRef.current) return;

    const exampleXml = `
      <xml>
        <block type="start_animation" x="20" y="20">
          <next>
            <block type="move_animation">
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
      {/* 添加Blockly专用样式 */}
      <style>
        {`
          /* 关键的拖拽修复样式 */
          .blocklyToolboxDiv {
            background-color: #ddd !important;
            user-select: none !important;
          }
          .blocklyFlyout {
            fill: #ddd !important;
            fill-opacity: 0.8 !important;
          }
          .blocklyToolboxCategory {
            cursor: pointer !important;
            user-select: none !important;
          }
          
          /* 修复拖拽敏感度的关键样式 */
          .blocklyDraggable {
            cursor: move !important;
            pointer-events: auto !important;
          }
          
          .blocklyBlockCanvas .blocklyDraggable {
            cursor: move !important;
          }
          
          /* 防止意外的自动拖拽 */
          .blocklyFlyoutButton {
            pointer-events: auto !important;
            cursor: pointer !important;
          }
          
          .blocklyFlyoutBackground {
            pointer-events: none !important;
          }
          
          /* 工作区块的拖拽控制 */
          .blocklySelected {
            stroke: #666 !important;
            stroke-width: 1px !important;
          }
          
          /* 修复可能的CSS冲突 */
          .blocklyMainBackground {
            stroke: #c6c6c6 !important;
          }
          
          .blocklySvg {
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            /* 关键：防止触摸设备上的拖拽问题 */
            touch-action: none !important;
          }
          
          /* 确保拖拽手势正常工作 */
          .blocklyFlyoutBackground {
            fill-opacity: 0.8 !important;
          }
          
          .blocklyScrollbarBackground {
            fill: #fff !important;
            fill-opacity: 0.8 !important;
          }
          
          /* 修复块连接时的视觉反馈 */
          .blocklyConnection {
            stroke: #c6c6c6 !important;
            stroke-width: 1px !important;
          }
          
          .blocklyConnectionHighlight {
            stroke: #4CAF50 !important;
            stroke-width: 2px !important;
          }
          
          /* 最关键的修复：防止过度敏感的拖拽 */
          .blocklyDraggable > .blocklyPath {
            pointer-events: visiblePainted !important;
          }
          
          .blocklyFlyout .blocklyDraggable {
            cursor: pointer !important;
          }
          
          .blocklyWorkspace .blocklyDraggable {
            cursor: move !important;
          }
          
          /* 修复工作区内块的重新排序问题 */
          .blocklyWorkspace .blocklySelected {
            cursor: move !important;
            filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.2)) !important;
          }
          
          /* 优化工具箱滚动条显示 - 强制隐藏所有滚动条 */
          .blocklyScrollbarVertical,
          .blocklyScrollbarHorizontal,
          .blocklyScrollbar {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
          }
          
          /* 特别针对flyout的滚动条 */
          .blocklyFlyout .blocklyScrollbarVertical,
          .blocklyFlyout .blocklyScrollbarHorizontal,
          .blocklyFlyout .blocklyScrollbar {
            display: none !important;
          }
          
          /* 工作区滚动条也隐藏 */
          .blocklyWorkspace .blocklyScrollbarVertical,
          .blocklyWorkspace .blocklyScrollbarHorizontal,
          .blocklyWorkspace .blocklyScrollbar {
            display: none !important;
          }
          
          /* 确保所有SVG滚动条元素都被隐藏 */
          svg .blocklyScrollbarVertical,
          svg .blocklyScrollbarHorizontal,
          svg .blocklyScrollbar {
            display: none !important;
          }
          
          /* 工具箱优化 */
          .blocklyToolboxDiv {
            overflow: hidden !important;
          }
          
          .blocklyFlyout {
            overflow: hidden !important;
          }
        `}
      </style>
      
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
          type="button"
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
          type="button"
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
          type="button"
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
          type="button"
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
          type="button"
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
        onKeyDown={(e) => {
          // 阻止可能导致页面刷新的快捷键
          if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => {
          // 阻止默认的拖拽行为，让 Blockly 处理
          e.preventDefault();
        }}
        style={{
          flex: 1,
          minHeight: '400px',
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          // 确保拖拽事件正常工作的关键样式
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          // 确保鼠标事件正常传递
          pointerEvents: 'auto'
        } as React.CSSProperties}
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
