/**
 * AgentPanel - 单个智能体工作面板
 *
 * 显示单个智能体的工作状态、发布的发现、与其他智能体的交互。
 * 用于 MultiAgentWorkspace 中展示每个参与协作的智能体。
 */

import React, { useState, useCallback } from 'react';

export interface AgentFinding {
  id: string;
  agentRole: string;
  department: string;
  content: string;
  category: 'analysis' | 'recommendation' | 'concern' | 'data' | 'decision';
  timestamp: number;
}

export interface AgentPanelProps {
  /** 智能体 ID */
  agentId: string;
  /** 智能体角色名 */
  agentRole: string;
  /** 所属部门 */
  department: string;
  /** 部门颜色标识 */
  departmentColor?: string;
  /** 智能体状态 */
  status: 'working' | 'completed' | 'waiting' | 'idle';
  /** 智能体发布的发现 */
  findings: AgentFinding[];
  /** 是否展开显示 */
  isExpanded?: boolean;
  /** 点击展开/收起回调 */
  onToggleExpand?: () => void;
  /** 点击查看详情回调 */
  onViewDetail?: (finding: AgentFinding) => void;
}

const STATUS_ICONS: Record<string, string> = {
  working: '💻',
  completed: '✅',
  waiting: '⏳',
  idle: '🫠',
};

const STATUS_LABELS: Record<string, string> = {
  working: '工作中',
  completed: '已完成',
  waiting: '等待中',
  idle: '空闲',
};

const CATEGORY_COLORS: Record<string, string> = {
  analysis: 'bg-blue-100 text-blue-800',
  recommendation: 'bg-green-100 text-green-800',
  concern: 'bg-yellow-100 text-yellow-800',
  data: 'bg-purple-100 text-purple-800',
  decision: 'bg-red-100 text-red-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  analysis: '分析',
  recommendation: '建议',
  concern: '关注',
  data: '数据',
  decision: '决策',
};

export default function AgentPanel({
  agentId,
  agentRole,
  department,
  departmentColor = 'bg-gray-500',
  status,
  findings,
  isExpanded = true,
  onToggleExpand,
  onViewDetail,
}: AgentPanelProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);

  const handleToggle = useCallback(() => {
    setLocalExpanded((prev) => !prev);
    onToggleExpand?.();
  }, [onToggleExpand]);

  const latestFindings = findings.slice(-5);
  const findingCount = findings.length;

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${departmentColor}`} />
          <div>
            <div className="font-medium text-gray-900">{agentRole}</div>
            <div className="text-xs text-gray-500">{department}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {STATUS_ICONS[status]} {STATUS_LABELS[status]}
          </span>
          {findingCount > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
              {findingCount} 条发现
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${
              localExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>

      {/* 内容 */}
      {localExpanded && (
        <div className="border-t">
          {latestFindings.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              暂无发现
            </div>
          ) : (
            <div className="divide-y">
              {latestFindings.map((finding) => (
                <div
                  key={finding.id}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onViewDetail?.(finding)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            CATEGORY_COLORS[finding.category]
                          }`}
                        >
                          {CATEGORY_LABELS[finding.category]}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(finding.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {finding.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {findingCount > 5 && (
            <div className="px-4 py-2 text-center text-xs text-gray-500 border-t">
              还有 {findingCount - 5} 条更早的发现
            </div>
          )}
        </div>
      )}
    </div>
  );
}
