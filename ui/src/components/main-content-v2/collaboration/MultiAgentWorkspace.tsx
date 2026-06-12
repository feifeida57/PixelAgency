/**
 * MultiAgentWorkspace - 多智能体协作工作区
 *
 * 展示多个智能体在协作会话中的工作状态和交流。
 * 支持三种视图模式：
 * - 独立面板：每个智能体一个面板，独立显示
 * - 时间线：按时间顺序显示所有发现
 * - 部门分组：按部门分组显示
 */

import React, { useState, useMemo } from 'react';
import AgentPanel, { type AgentFinding } from './AgentPanel';

export interface AgentInfo {
  id: string;
  role: string;
  department: string;
  departmentColor?: string;
  status: 'working' | 'completed' | 'waiting' | 'idle';
}

export interface MultiAgentWorkspaceProps {
  /** 协作会话 ID */
  sessionId: string;
  /** 协作主题 */
  topic: string;
  /** 参与的智能体列表 */
  agents: AgentInfo[];
  /** 所有发现 */
  findings: AgentFinding[];
  /** 协作阶段 */
  phase: 'collecting' | 'discussing' | 'merging' | 'completed';
  /** 查看发现详情回调 */
  onViewFinding?: (finding: AgentFinding) => void;
  /** 完成协作回调 */
  onComplete?: () => void;
}

type ViewMode = 'panels' | 'timeline' | 'department';

const PHASE_LABELS: Record<string, string> = {
  collecting: '收集阶段',
  discussing: '讨论阶段',
  merging: '合并阶段',
  completed: '已完成',
};

const PHASE_COLORS: Record<string, string> = {
  collecting: 'bg-blue-100 text-blue-800',
  discussing: 'bg-yellow-100 text-yellow-800',
  merging: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
};

const DEPARTMENT_COLORS: Record<string, string> = {
  '产品部': 'bg-orange-500',
  '设计部': 'bg-pink-500',
  '前端部': 'bg-blue-500',
  '后端部': 'bg-green-500',
  '数据部': 'bg-purple-500',
  '运维部': 'bg-gray-500',
  '市场部': 'bg-red-500',
  '销售部': 'bg-yellow-500',
  '电商部': 'bg-indigo-500',
  '专业团': 'bg-teal-500',
  '专家团': 'bg-cyan-500',
  '测试部': 'bg-lime-500',
  '项目办': 'bg-amber-500',
};

export default function MultiAgentWorkspace({
  sessionId,
  topic,
  agents,
  findings,
  phase,
  onViewFinding,
  onComplete,
}: MultiAgentWorkspaceProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('panels');

  // 按智能体分组的发现
  const findingsByAgent = useMemo(() => {
    const grouped = new Map<string, AgentFinding[]>();
    for (const finding of findings) {
      const existing = grouped.get(finding.agentRole) || [];
      existing.push(finding);
      grouped.set(finding.agentRole, existing);
    }
    return grouped;
  }, [findings]);

  // 按部门分组的发现
  const findingsByDepartment = useMemo(() => {
    const grouped = new Map<string, AgentFinding[]>();
    for (const finding of findings) {
      const existing = grouped.get(finding.department) || [];
      existing.push(finding);
      grouped.set(finding.department, existing);
    }
    return grouped;
  }, [findings]);

  // 按时间排序的发现
  const timelineFindings = useMemo(() => {
    return [...findings].sort((a, b) => a.timestamp - b.timestamp);
  }, [findings]);

  const renderTimeline = () => (
    <div className="space-y-4">
      {timelineFindings.map((finding) => (
        <div
          key={finding.id}
          className="flex gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
          onClick={() => onViewFinding?.(finding)}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">
            {finding.agentRole.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm text-gray-900">
                {finding.agentRole}
              </span>
              <span className="text-xs text-gray-500">{finding.department}</span>
              <span className="text-xs text-gray-400">
                {new Date(finding.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm text-gray-700">{finding.content}</p>
          </div>
        </div>
      ))}
      {timelineFindings.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          暂无发现
        </div>
      )}
    </div>
  );

  const renderDepartmentView = () => (
    <div className="space-y-6">
      {Array.from(findingsByDepartment.entries()).map(([dept, deptFindings]) => (
        <div key={dept} className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  DEPARTMENT_COLORS[dept] || 'bg-gray-500'
                }`}
              />
              <span className="font-medium text-gray-900">{dept}</span>
              <span className="text-xs text-gray-500">
                {deptFindings.length} 条发现
              </span>
            </div>
          </div>
          <div className="divide-y">
            {deptFindings.map((finding) => (
              <div
                key={finding.id}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onViewFinding?.(finding)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {finding.agentRole}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(finding.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {finding.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
      {findingsByDepartment.size === 0 && (
        <div className="text-center text-gray-400 py-8">
          暂无发现
        </div>
      )}
    </div>
  );

  const renderPanels = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {agents.map((agent) => (
        <AgentPanel
          key={agent.id}
          agentId={agent.id}
          agentRole={agent.role}
          department={agent.department}
          departmentColor={
            agent.departmentColor ||
            DEPARTMENT_COLORS[agent.department] ||
            'bg-gray-500'
          }
          status={agent.status}
          findings={findingsByAgent.get(agent.role) || []}
          onViewDetail={onViewFinding}
        />
      ))}
      {agents.length === 0 && (
        <div className="col-span-full text-center text-gray-400 py-8">
          暂无参与者
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{topic}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">会话 ID: {sessionId}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                PHASE_COLORS[phase]
              }`}
            >
              {PHASE_LABELS[phase]}
            </span>
            <span className="text-xs text-gray-500">
              {agents.length} 位参与者 · {findings.length} 条发现
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'completed' && onComplete && (
            <button
              onClick={onComplete}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              完成协作
            </button>
          )}
        </div>
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-gray-50">
        <button
          onClick={() => setViewMode('panels')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            viewMode === 'panels'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          独立面板
        </button>
        <button
          onClick={() => setViewMode('timeline')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            viewMode === 'timeline'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          时间线
        </button>
        <button
          onClick={() => setViewMode('department')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            viewMode === 'department'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          部门分组
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'panels' && renderPanels()}
        {viewMode === 'timeline' && renderTimeline()}
        {viewMode === 'department' && renderDepartmentView()}
      </div>
    </div>
  );
}
