import { useEffect, useState, useCallback, useRef } from 'react';
import { useSessionStore } from '../stores/useSessionStore';

// 技能活动追踪器
interface SkillActivity {
  slug: string;
  lastUsed: number;
  isActive: boolean;
}

// 全局技能活动状态
let skillActivities: Map<string, SkillActivity> = new Map();
let listeners: Set<() => void> = new Set();

// 通知所有监听器
function notifyListeners() {
  listeners.forEach(listener => listener());
}

// 添加技能活动
export function recordSkillActivity(slug: string) {
  const existing = skillActivities.get(slug);
  skillActivities.set(slug, {
    slug,
    lastUsed: Date.now(),
    isActive: true,
  });
  notifyListeners();
  
  // 5分钟后自动标记为非活跃
  setTimeout(() => {
    const activity = skillActivities.get(slug);
    if (activity && activity.lastUsed === skillActivities.get(slug)?.lastUsed) {
      skillActivities.set(slug, { ...activity, isActive: false });
      notifyListeners();
    }
  }, 5 * 60 * 1000);
}

// 获取技能活动状态
export function getSkillActivity(slug: string): SkillActivity | undefined {
  return skillActivities.get(slug);
}

// 获取所有活跃的技能
export function getActiveSkills(): string[] {
  return Array.from(skillActivities.entries())
    .filter(([_, activity]) => activity.isActive)
    .map(([slug]) => slug);
}

// Hook: 追踪技能活动
export function useSkillActivity() {
  const [activities, setActivities] = useState<Map<string, SkillActivity>>(skillActivities);
  const lastCheckedRef = useRef<number>(0);
  
  useEffect(() => {
    const listener = () => {
      setActivities(new Map(skillActivities));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  
  // 检查消息中的 read_skill 调用
  const checkMessages = useCallback((messages: Array<{ toolName?: string; toolInput?: unknown; timestamp?: string }>) => {
    const now = Date.now();
    
    // 只检查最近5分钟的消息
    const recentMessages = messages.filter(msg => {
      if (!msg.timestamp) return true;
      const msgTime = new Date(msg.timestamp).getTime();
      return now - msgTime < 5 * 60 * 1000;
    });
    
    recentMessages.forEach(message => {
      if (message.toolName === 'read_skill') {
        const input = message.toolInput as { name?: string } | undefined;
        if (input?.name) {
          const existing = skillActivities.get(input.name);
          if (!existing || !existing.isActive) {
            recordSkillActivity(input.name);
          }
        }
      }
    });
    
    lastCheckedRef.current = now;
  }, []);
  
  return {
    activities,
    activeSkills: getActiveSkills(),
    isActive: (slug: string) => skillActivities.get(slug)?.isActive ?? false,
    checkMessages,
  };
}
