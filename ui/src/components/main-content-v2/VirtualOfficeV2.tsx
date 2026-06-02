import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Building } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { useWebSocket } from '../../contexts/WebSocketContext';
import agentIndex from '../../data/agent-index.json';

// ========== 类型 ==========
type AgentBehavior = 'working' | 'gaming' | 'sleeping' | 'coffee' | 'chatting' | 'idle' | 'walking';

interface Agent {
  id: string;
  name: string;
  description: string;
  emoji: string;
  department: string;
  departmentName: string;
  behavior: AgentBehavior;
  workingSince?: number;
  currentTask?: string;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  walkTimer: number;
  behaviorTimer: number;
}

// ========== 部门配置 ==========
const DEPT_LIST = [
  { key: 'engineering', name: '工程部', emoji: '💻', color: '#3B82F6' },
  { key: 'design', name: '设计部', emoji: '🎨', color: '#A855F7' },
  { key: 'marketing', name: '营销部', emoji: '📱', color: '#EC4899' },
  { key: 'product', name: '产品部', emoji: '📋', color: '#F59E0B' },
  { key: 'finance', name: '金融部', emoji: '💰', color: '#10B981' },
  { key: 'sales', name: '销售部', emoji: '💼', color: '#6366F1' },
  { key: 'specialized', name: '专家团', emoji: '⭐', color: '#F97316' },
  { key: 'testing', name: '测试部', emoji: '🧪', color: '#14B8A6' },
  { key: 'support', name: '支持部', emoji: '🛠️', color: '#8B5CF6' },
  { key: 'hr', name: '人事部', emoji: '👥', color: '#06B6D4' },
  { key: 'legal', name: '法务部', emoji: '⚖️', color: '#64748B' },
  { key: 'academic', name: '学术部', emoji: '📚', color: '#7C3AED' },
  { key: 'game-development', name: '游戏开发', emoji: '🎮', color: '#EF4444' },
  { key: 'supply-chain', name: '供应链', emoji: '📦', color: '#84CC16' },
  { key: 'project-management', name: '项目办', emoji: '📊', color: '#0EA5E9' },
  { key: 'paid-media', name: '投放部', emoji: '📢', color: '#D946EF' },
  { key: 'spatial-computing', name: 'XR部', emoji: '🥽', color: '#2DD4BF' },
];

// ========== 行为配置 ==========
const BEHAVIORS: Record<AgentBehavior, { label: string; icon: string; color: string; duration: [number, number] }> = {
  working:  { label: '工作中', icon: '💻', color: '#22C55E', duration: [15, 45] },
  gaming:   { label: '打游戏', icon: '🎮', color: '#F59E0B', duration: [5, 15] },
  sleeping: { label: '睡觉中', icon: '😴', color: '#6366F1', duration: [8, 20] },
  coffee:   { label: '喝咖啡', icon: '☕', color: '#92400E', duration: [3, 8] },
  chatting: { label: '聊天中', icon: '💬', color: '#3B82F6', duration: [4, 12] },
  idle:     { label: '发呆中', icon: '🫠', color: '#9CA3AF', duration: [5, 15] },
  walking:  { label: '走动中', icon: '🚶', color: '#A855F7', duration: [2, 5] },
};

// ========== 持久化 ==========
const STORAGE_KEY = 'pilotdeck-working-agents';

function getWorkingAgents(): Map<string, { since: number; task?: string }> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return new Map(Object.entries(data).map(([k, v]: [string, any]) => [k, { since: Number(v.since), task: v.task }]));
    }
  } catch {}
  return new Map();
}

function saveWorkingAgents(map: Map<string, { since: number; task?: string }>) {
  const obj: Record<string, { since: number; task?: string }> = {};
  map.forEach((v, k) => { obj[k] = v; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// ========== 像素角色绘制（增强动画版） ==========
function drawPixelCharacter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  emoji: string,
  behavior: AgentBehavior,
  frame: number,
  isWorking: boolean,
  name: string,
  isSearchMatch?: boolean,
) {
  const bc = BEHAVIORS[behavior];

  // 身体（方块人）
  ctx.fillStyle = isSearchMatch ? '#FEF3C7' : isWorking ? '#D1FAE5' : '#F3F4F6';
  ctx.strokeStyle = isSearchMatch ? '#F59E0B' : isWorking ? '#22C55E' : '#D1D5DB';
  ctx.lineWidth = isSearchMatch ? 3 : 2;
  roundRect(ctx, x - 24, y - 24, 48, 48, 7);
  ctx.fill();
  ctx.stroke();

  // 工作中发光
  if (isWorking) {
    ctx.save();
    ctx.globalAlpha = 0.3 + Math.sin(frame * 0.05) * 0.15;
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 3;
    roundRect(ctx, x - 27, y - 27, 54, 54, 9);
    ctx.stroke();
    ctx.restore();
  }

  // emoji
  ctx.font = '31px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x, y - 2);

  // 行为图标（气泡）+ 特殊动画
  const bubbleY = y - 43;
  const bobble = Math.sin(frame * 0.08) * 3;
  ctx.font = '19px serif';

  switch (behavior) {
    case 'working':
      // 打字动画：气泡上下抖动
      ctx.fillText(bc.icon, x, bubbleY + bobble);
      // 打字光标闪烁
      if (frame % 60 < 30) {
        ctx.font = '10px monospace';
        ctx.fillStyle = '#22C55E';
        ctx.fillText('▌', x + 12, bubbleY + bobble);
      }
      break;

    case 'gaming':
      // 手柄摇晃动画
      const shake = Math.sin(frame * 0.15) * 4;
      ctx.fillText(bc.icon, x + shake, bubbleY + bobble);
      break;

    case 'sleeping':
      // ZZZ 气泡动画
      ctx.fillText(bc.icon, x, bubbleY + bobble);
      // 漂浮的 Z
      ctx.font = '12px serif';
      ctx.fillStyle = '#6366F1';
      const zOffset = (frame % 120) / 120;
      ctx.globalAlpha = 1 - zOffset;
      ctx.fillText('z', x + 15 + zOffset * 10, bubbleY - zOffset * 15);
      ctx.fillText('Z', x + 20 + zOffset * 8, bubbleY - zOffset * 20 - 5);
      ctx.globalAlpha = 1;
      break;

    case 'coffee':
      // 咖啡冒热气动画
      ctx.fillText(bc.icon, x, bubbleY + bobble);
      // 热气
      ctx.font = '10px serif';
      ctx.fillStyle = '#92400E';
      const steamPhase = frame % 60;
      if (steamPhase < 20) {
        ctx.globalAlpha = 0.6;
        ctx.fillText('~', x - 8, bubbleY - 10 - steamPhase * 0.5);
      } else if (steamPhase < 40) {
        ctx.globalAlpha = 0.4;
        ctx.fillText('~', x + 5, bubbleY - 15 - (steamPhase - 20) * 0.3);
      } else {
        ctx.globalAlpha = 0.2;
        ctx.fillText('~', x - 3, bubbleY - 12 - (steamPhase - 40) * 0.4);
      }
      ctx.globalAlpha = 1;
      break;

    case 'chatting':
      // 聊天气泡动画
      ctx.fillText(bc.icon, x, bubbleY + bobble);
      // 小气泡
      ctx.font = '8px serif';
      ctx.fillStyle = '#3B82F6';
      const chatPhase = frame % 90;
      if (chatPhase < 30) {
        ctx.globalAlpha = 0.7;
        ctx.fillText('💭', x + 18, bubbleY - 5);
      } else if (chatPhase < 60) {
        ctx.globalAlpha = 0.5;
        ctx.fillText('💭', x + 22, bubbleY - 10);
      }
      ctx.globalAlpha = 1;
      break;

    case 'walking':
      // 走动动画：气泡左右摇摆
      const walkBob = Math.sin(frame * 0.2) * 5;
      ctx.fillText(bc.icon, x + walkBob, bubbleY + bobble);
      break;

    default:
      ctx.fillText(bc.icon, x, bubbleY + bobble);
  }

  // 名字
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText(name.slice(0, 6), x, y + 34);
}

// 圆角矩形辅助
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ========== 办公室场景绘制（支持深色主题） ==========
function drawOfficeScene(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, theme: 'light' | 'dark' = 'light') {
  const isDark = theme === 'dark';

  // 地板
  ctx.fillStyle = isDark ? '#1E1E1E' : '#F5F0EB';
  ctx.fillRect(0, 0, w, h);

  // 地板格子
  ctx.strokeStyle = isDark ? '#2D2D2D' : '#E8E0D8';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += 68) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 68) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // 墙壁（顶部）
  const wallH = 102;
  ctx.fillStyle = isDark ? '#2D2D2D' : '#E8E0D8';
  ctx.fillRect(0, 0, w, wallH);
  ctx.fillStyle = isDark ? '#3D3D3D' : '#D4C9BE';
  ctx.fillRect(0, wallH - 4, w, 4);

  // 窗户
  for (let i = 0; i < 4; i++) {
    const wx = 100 + i * 200;
    ctx.fillStyle = isDark ? '#1E3A5F' : '#BFDBFE';
    ctx.fillRect(wx, 17, 136, 68);
    ctx.strokeStyle = isDark ? '#2563EB' : '#93C5FD';
    ctx.lineWidth = 3;
    ctx.strokeRect(wx, 17, 136, 68);
    ctx.beginPath();
    ctx.moveTo(wx + 68, 17); ctx.lineTo(wx + 68, 85); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx, 51); ctx.lineTo(wx + 136, 51); ctx.stroke();
  }

  // 咖啡机（右上角）
  ctx.font = '41px serif';
  ctx.fillText('☕', w - 70, 60);

  // 植物
  ctx.fillText('🌿', 35, 60);
  ctx.fillText('🪴', 70, h - 35);
  ctx.fillText('🌱', w - 85, h - 35);

  // 白板
  ctx.fillStyle = isDark ? '#92400E' : '#FBBF24';
  ctx.fillRect(w / 2 - 102, 13, 204, 75);
  ctx.strokeStyle = isDark ? '#B45309' : '#D97706';
  ctx.lineWidth = 2;
  ctx.strokeRect(w / 2 - 102, 13, 204, 75);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = isDark ? '#FCD34D' : '#92400E';
  ctx.textAlign = 'center';
  ctx.fillText('📋 Sprint Board', w / 2, 38);
  ctx.fillText('✅ 进度: 68%', w / 2, 64);
  ctx.textAlign = 'left';
}

// ========== 布局计算（放大一倍） ==========
function layoutDesks(count: number, areaW: number, areaH: number, startY: number) {
  const cols = Math.min(Math.ceil(Math.sqrt(count * 1.6)), 6);
  const rows = Math.ceil(count / cols);
  const positions: Array<{ x: number; y: number }> = [];

  const cellW = 102;
  const cellH = 94;
  const startX = (areaW - cols * cellW) / 2 + cellW / 2;
  const baseY = startY + 60;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      x: startX + col * cellW,
      y: baseY + row * cellH,
    });
  }
  return positions;
}

// ========== 主组件 ==========
export default function VirtualOfficeV2() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<Agent[]>([]);
  const frameRef = useRef(0);
  const animRef = useRef<number>(0);
  const [dept, setDept] = useState<string | null>(null);
  const [sel, setSel] = useState<Agent | null>(null);
  const [stats, setStats] = useState({ total: 0, working: 0, gaming: 0, sleeping: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { subscribe } = useWebSocket();

  // 加载当前部门的智能体
  useEffect(() => {
    if (!dept) return;
    const wm = getWorkingAgents();
    const deptAgents = (agentIndex as any).agents.filter((a: any) => a.department === dept);
    const positions = layoutDesks(deptAgents.length, 1190, 850, 70);

    agentsRef.current = deptAgents.map((a: any, i: number) => {
      const isWorking = wm.has(a.id);
      const pos = positions[i] || { x: 100, y: 100 };
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        emoji: a.emoji || '👤',
        department: a.department,
        departmentName: a.departmentName,
        behavior: isWorking ? 'working' : randomBehavior(),
        workingSince: wm.get(a.id)?.since,
        currentTask: wm.get(a.id)?.task,
        x: pos.x,
        y: pos.y,
        walkTimer: Math.random() * 300,
        behaviorTimer: Math.random() * 200 + 100,
      };
    });
  }, [dept]);

  // ========== WebSocket 同步：监听 agent 工具调用 ==========
  useEffect(() => {
    const activeCalls = new Map<string, string>(); // toolCallId -> agentName

    const unsubscribe = subscribe((msg: any) => {
      if (!msg || msg.sessionId === undefined) return;

      // 监听 tool_use 事件（agent 工具被调用）
      if (msg.kind === 'tool_use' && msg.toolName === 'agent' && msg.toolInput) {
        const input = msg.toolInput as any;
        const prompt: string = input.prompt || '';
        const desc: string = input.description || '';

        // 从 prompt 中提取角色名：匹配多种格式
        // 格式1: "你是「财务分析师」"
        // 格式2: "你是"财务分析师""
        // 格式3: "你是财务分析师"
        // 格式4: "作为财务分析师"
        const roleMatch = prompt.match(/你是[「"""]*([^「」"""，。\s]{2,10})/) ||
                          prompt.match(/作为[「"""]*([^「」"""，。\s]{2,10})/) ||
                          prompt.match(/[「"""]([^「」""""]{2,10})[「」"""]/) ||
                          desc.match(/([^\s，。]{2,10})/);
        if (!roleMatch) return;

        const roleName = roleMatch[1];
        activeCalls.set(msg.toolId || msg.id, roleName);

        // 在 agent-index 中查找匹配的智能体
        const agents = agentsRef.current;
        const match = agents.find(a =>
          a.name.includes(roleName) || roleName.includes(a.name)
        );
        if (match) {
          match.behavior = 'working';
          match.workingSince = Date.now();
          match.currentTask = desc || '执行任务中';
          // 保存到 localStorage
          const wm = getWorkingAgents();
          wm.set(match.id, { since: Date.now(), task: match.currentTask });
          saveWorkingAgents(wm);
        }
      }

      // 监听 tool_result 事件（agent 工具完成）
      if (msg.kind === 'tool_result' && msg.toolId) {
        const roleName = activeCalls.get(msg.toolId);
        if (roleName) {
          activeCalls.delete(msg.toolId);
          const agents = agentsRef.current;
          const match = agents.find(a =>
            a.name.includes(roleName) || roleName.includes(a.name)
          );
          if (match) {
            match.behavior = randomBehavior();
            match.workingSince = undefined;
            match.currentTask = undefined;
            // 从 localStorage 移除
            const wm = getWorkingAgents();
            wm.delete(match.id);
            saveWorkingAgents(wm);
          }
        }
      }
    });

    return unsubscribe;
  }, [subscribe]);

  // 动画循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dept) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1190;
    const H = 850;
    canvas.width = W * 2; // 高清
    canvas.height = H * 2;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(2, 2);

    const wm = getWorkingAgents();

    // 互动系统状态
    let interactionTimer = 300 + Math.random() * 600; // 5-15秒触发一次互动
    let activeInteraction: { type: string; agents: number[] } | null = null;
    let interactionDuration = 0;

    function animate() {
      frameRef.current++;
      const frame = frameRef.current;

      ctx!.clearRect(0, 0, W, H);
      drawOfficeScene(ctx!, W, H, frame, theme);

      // 绘制每个角色
      // 互动系统逻辑
      interactionTimer--;
      if (interactionTimer <= 0 && !activeInteraction) {
        // 随机触发互动
        const agents = agentsRef.current;
        const idleAgents = agents.filter(a => !getWorkingAgents().has(a.id));
        if (idleAgents.length >= 2) {
          const interactionTypes = ['chat', 'coffee', 'meeting', 'collaborate'];
          const type = interactionTypes[Math.floor(Math.random() * interactionTypes.length)];
          const count = type === 'meeting' ? Math.min(3 + Math.floor(Math.random() * 3), idleAgents.length) : 2;
          const selectedIndices: number[] = [];

          // 选择参与互动的智能体（优先选择相邻的）
          const firstIdx = Math.floor(Math.random() * idleAgents.length);
          selectedIndices.push(firstIdx);
          for (let i = 1; i < count; i++) {
            // 选择距离最近的
            let minDist = Infinity;
            let nearestIdx = -1;
            for (let j = 0; j < idleAgents.length; j++) {
              if (selectedIndices.includes(j)) continue;
              const dx = idleAgents[j].x - idleAgents[firstIdx].x;
              const dy = idleAgents[j].y - idleAgents[firstIdx].y;
              const dist = dx * dx + dy * dy;
              if (dist < minDist) {
                minDist = dist;
                nearestIdx = j;
              }
            }
            if (nearestIdx >= 0) selectedIndices.push(nearestIdx);
          }

          activeInteraction = {
            type,
            agents: selectedIndices.map(i => idleAgents[i].id)
          };
          interactionDuration = 300 + Math.random() * 300; // 5-10秒

          // 设置互动状态
          selectedIndices.forEach(i => {
            const agent = idleAgents[i];
            switch (type) {
              case 'chat': agent.behavior = 'chatting'; break;
              case 'coffee': agent.behavior = 'coffee'; break;
              case 'meeting': agent.behavior = 'chatting'; break;
              case 'collaborate': agent.behavior = 'working'; break;
            }
          });
        }
        interactionTimer = 600 + Math.random() * 1200; // 10-30秒后下次互动
      }

      // 互动持续中
      if (activeInteraction) {
        interactionDuration--;
        if (interactionDuration <= 0) {
          // 互动结束
          activeInteraction.agents.forEach(id => {
            const agent = agentsRef.current.find(a => a.id === id);
            if (agent && !getWorkingAgents().has(agent.id)) {
              agent.behavior = randomBehavior();
            }
          });
          activeInteraction = null;
        }
      }

      agentsRef.current.forEach(agent => {
        // 行为切换（互动中的智能体不切换）
        const isInInteraction = activeInteraction?.agents.includes(agent.id);
        if (!isInInteraction) {
          agent.behaviorTimer--;
          if (agent.behaviorTimer <= 0) {
            const wmNow = getWorkingAgents();
            if (!wmNow.has(agent.id)) {
              agent.behavior = randomBehavior();
            }
            const [, maxDur] = BEHAVIORS[agent.behavior].duration;
            agent.behaviorTimer = Math.random() * maxDur * 60 + 100;
          }
        }

        // 走动动画（互动中不走动）
        if (agent.behavior === 'walking' && !isInInteraction) {
          agent.walkTimer--;
          if (agent.walkTimer <= 0) {
            agent.targetX = agent.x + (Math.random() - 0.5) * 80;
            agent.targetY = agent.y + (Math.random() - 0.5) * 60;
            agent.targetX = Math.max(40, Math.min(W - 40, agent.targetX!));
            agent.targetY = Math.max(100, Math.min(H - 40, agent.targetY!));
            agent.walkTimer = 60 + Math.random() * 120;
          }
          if (agent.targetX !== undefined) {
            agent.x += (agent.targetX - agent.x) * 0.02;
            agent.y += (agent.targetY! - agent.y) * 0.02;
          }
        }

        const wmNow = getWorkingAgents();
        const isWorking = wmNow.has(agent.id);
        const isSearchMatch = searchQuery && agent.name.toLowerCase().includes(searchQuery.toLowerCase());
        drawPixelCharacter(ctx!, agent.x, agent.y, agent.emoji, agent.behavior, frame, isWorking, agent.name, isSearchMatch);

        // 互动连线效果
        if (isInInteraction && activeInteraction) {
          const otherIds = activeInteraction.agents.filter(id => id !== agent.id);
          otherIds.forEach(otherId => {
            const other = agentsRef.current.find(a => a.id === otherId);
            if (other) {
              ctx!.save();
              ctx!.strokeStyle = '#3B82F6';
              ctx!.globalAlpha = 0.3 + Math.sin(frame * 0.1) * 0.2;
              ctx!.lineWidth = 2;
              ctx!.setLineDash([4, 4]);
              ctx!.beginPath();
              ctx!.moveTo(agent.x, agent.y);
              ctx!.lineTo(other.x, other.y);
              ctx!.stroke();
              ctx!.setLineDash([]);
              ctx!.restore();
            }
          });
        }
      });

      // 更新统计
      const wmNow = getWorkingAgents();
      let working = 0, gaming = 0, sleeping = 0;
      agentsRef.current.forEach(a => {
        if (wmNow.has(a.id)) working++;
        else if (a.behavior === 'gaming') gaming++;
        else if (a.behavior === 'sleeping') sleeping++;
      });
      setStats({ total: agentsRef.current.length, working, gaming, sleeping });

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [dept]);

  // 点击检测
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (const agent of agentsRef.current) {
      const dx = mx - agent.x;
      const dy = my - agent.y;
      if (Math.abs(dx) < 27 && Math.abs(dy) < 27) {
        setSel(agent);
        return;
      }
    }
    setSel(null);
  }, []);

  // 分配/结束任务
  const startTask = useCallback((agent: Agent) => {
    const wm = getWorkingAgents();
    wm.set(agent.id, { since: Date.now() });
    saveWorkingAgents(wm);
    agent.behavior = 'working';
    agent.workingSince = Date.now();
    setSel(null);
  }, []);

  const stopTask = useCallback((agent: Agent) => {
    const wm = getWorkingAgents();
    wm.delete(agent.id);
    saveWorkingAgents(wm);
    agent.behavior = randomBehavior();
    agent.workingSince = undefined;
    agent.currentTask = undefined;
    setSel(null);
  }, []);

  return (
    <div className="flex h-full flex-col bg-neutral-100 dark:bg-neutral-900">
      {/* 头部 */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-6 py-3">
        <div className="flex items-center gap-3 mb-3">
          <Building className="h-5 w-5 text-blue-500" />
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-white">智能体虚拟办公室</h1>
        </div>

        {/* 部门选择器 + 搜索 */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 flex-1">
            {DEPT_LIST.map(d => {
              const count = (agentIndex as any).departments[d.key]?.count || 0;
              return (
                <button
                  key={d.key}
                  onClick={() => setDept(d.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all",
                    dept === d.key
                      ? "text-white shadow-md"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  )}
                  style={dept === d.key ? { backgroundColor: d.color } : undefined}
                >
                  {d.emoji} {d.name} ({count})
                </button>
              );
            })}
          </div>
          {/* 搜索框 */}
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 搜索智能体..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 pr-8 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-neutral-900 dark:text-white placeholder-neutral-400 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                ✕
              </button>
            )}
          </div>
          {/* 主题切换 */}
          <button
            onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            title="切换主题"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      {/* 办公室 */}
      <div className="flex-1 overflow-auto p-4">
        {!dept ? (
          <div className="text-center text-neutral-500 dark:text-neutral-400 h-full flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">🏢</div>
            <p className="text-lg">选择一个部门进入办公室</p>
            <p className="text-sm mt-2">215 位智能体等待你的召唤</p>
          </div>
        ) : (
          <div className="inline-block min-w-full">
            {/* 状态栏 */}
            <div className="flex gap-4 text-xs text-neutral-500 dark:text-neutral-400 px-2 mb-2">
              <span>👥 {stats.total} 人</span>
              <span>🔥 {stats.working} 工作中</span>
              <span>🎮 {stats.gaming} 摸鱼</span>
              <span>😴 {stats.sleeping} 睡觉</span>
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="rounded-lg shadow-lg cursor-pointer border border-neutral-200 dark:border-neutral-700"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {sel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSel(null)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-5xl">{sel.emoji}</div>
              <div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">{sel.name}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: BEHAVIORS[sel.behavior].color + '20', color: BEHAVIORS[sel.behavior].color }}>
                  {BEHAVIORS[sel.behavior].icon} {BEHAVIORS[sel.behavior].label}
                </span>
              </div>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{sel.description}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">部门</span>
                <span className="text-neutral-900 dark:text-white">{sel.departmentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">ID</span>
                <span className="font-mono text-xs text-neutral-900 dark:text-white">{sel.id}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {getWorkingAgents().has(sel.id) ? (
                <button onClick={() => stopTask(sel)} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
                  结束工作
                </button>
              ) : (
                <button onClick={() => startTask(sel)} className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  分配任务
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========== 工具函数 ==========
function randomBehavior(): AgentBehavior {
  const r = Math.random();
  if (r < 0.45) return 'working';
  if (r < 0.60) return 'gaming';
  if (r < 0.72) return 'sleeping';
  if (r < 0.82) return 'coffee';
  if (r < 0.90) return 'chatting';
  if (r < 0.96) return 'idle';
  return 'walking';
}
