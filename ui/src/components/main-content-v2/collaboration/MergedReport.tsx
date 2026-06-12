/**
 * MergedReport - 合并报告组件
 *
 * 将多个智能体的协作结果合并成一份统一的报告。
 * 支持按类别分组、按部门分组、按重要性排序等视图。
 */

import React, { useState, useMemo } from 'react';
import type { AgentFinding } from './AgentPanel';

export interface MergedReportProps {
  /** 协作主题 */
  topic: string;
  /** 所有发现 */
  findings: AgentFinding[];
  /** 参与的部门列表 */
  departments: string[];
  /** 协作阶段 */
  phase: 'collecting' | 'discussing' | 'merging' | 'completed';
  /** 导出回调 */
  onExport?: (format: 'markdown' | 'json') => void;
  /** 返回协作工作区回调 */
  onBackToWorkspace?: () => void;
}

type GroupBy = 'category' | 'department' | 'priority';

const CATEGORY_ORDER = ['decision', 'recommendation', 'concern', 'analysis', 'data'];

const CATEGORY_LABELS: Record<string, string> = {
  analysis: '分析',
  recommendation: '建议',
  concern: '关注点',
  data: '数据支撑',
  decision: '决策',
};

const CATEGORY_COLORS: Record<string, string> = {
  analysis: 'border-blue-200 bg-blue-50',
  recommendation: 'border-green-200 bg-green-50',
  concern: 'border-yellow-200 bg-yellow-50',
  data: 'border-purple-200 bg-purple-50',
  decision: 'border-red-200 bg-red-50',
};

const CATEGORY_ICON: Record<string, string> = {
  analysis: '📊',
  recommendation: '💡',
  concern: '⚠️',
  data: '📈',
  decision: '🎯',
};

export default function MergedReport({
  topic,
  findings,
  departments,
  phase,
  onExport,
  onBackToWorkspace,
}: MergedReportProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>('category');

  // 按类别分组
  const findingsByCategory = useMemo(() => {
    const grouped = new Map<string, AgentFinding[]>();
    for (const finding of findings) {
      const existing = grouped.get(finding.category) || [];
      existing.push(finding);
      grouped.set(finding.category, existing);
    }
    // 按优先级排序
    return new Map(
      CATEGORY_ORDER
        .filter((cat) => grouped.has(cat))
        .map((cat) => [cat, grouped.get(cat)!])
    );
  }, [findings]);

  // 按部门分组
  const findingsByDepartment = useMemo(() => {
    const grouped = new Map<string, AgentFinding[]>();
    for (const finding of findings) {
      const existing = grouped.get(finding.department) || [];
      existing.push(finding);
      grouped.set(finding.department, existing);
    }
    return grouped;
  }, [findings]);

  // 统计信息
  const stats = useMemo(() => {
    const categoryCounts = new Map<string, number>();
    const departmentCounts = new Map<string, number>();
    for (const finding of findings) {
      categoryCounts.set(
        finding.category,
        (categoryCounts.get(finding.category) || 0) + 1
      );
      departmentCounts.set(
        finding.department,
        (departmentCounts.get(finding.department) || 0) + 1
      );
    }
    return { categoryCounts, departmentCounts };
  }, [findings]);

  const renderCategoryView = () => (
    <div className="space-y-6">
      {Array.from(findingsByCategory.entries()).map(([category, categoryFindings]) => (
        <div
          key={category}
          className={`border rounded-lg overflow-hidden ${
            CATEGORY_COLORS[category] || 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <span className="text-lg">{CATEGORY_ICON[category]}</span>
              <h3 className="font-semibold text-gray-900">
                {CATEGORY_LABELS[category]}
              </h3>
              <span className="text-sm text-gray-500">
                ({categoryFindings.length})
              </span>
            </div>
          </div>
          <div className="divide-y">
            {categoryFindings.map((finding) => (
              <div key={finding.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {finding.agentRole}
                  </span>
                  <span className="text-xs text-gray-500">
                    {finding.department}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{finding.content}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderDepartmentView = () => (
    <div className="space-y-6">
      {Array.from(findingsByDepartment.entries()).map(([dept, deptFindings]) => (
        <div key={dept} className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-semibold text-gray-900">{dept}</h3>
            <p className="text-sm text-gray-500">{deptFindings.length} 条发现</p>
          </div>
          <div className="divide-y">
            {deptFindings.map((finding) => (
              <div key={finding.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {finding.agentRole}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      CATEGORY_COLORS[finding.category]
                    }`}
                  >
                    {CATEGORY_LABELS[finding.category]}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{finding.content}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderPriorityView = () => {
    // 按优先级排序：决策 > 建议 > 关注 > 分析 > 数据
    const sorted = [...findings].sort((a, b) => {
      const aIdx = CATEGORY_ORDER.indexOf(a.category);
      const bIdx = CATEGORY_ORDER.indexOf(b.category);
      return aIdx - bIdx;
    });

    return (
      <div className="space-y-4">
        {sorted.map((finding, index) => (
          <div
            key={finding.id}
            className={`border rounded-lg p-4 ${
              CATEGORY_COLORS[finding.category] || 'border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{CATEGORY_ICON[finding.category]}</span>
              <span className="font-medium text-gray-900">
                {finding.agentRole}
              </span>
              <span className="text-sm text-gray-500">{finding.department}</span>
              <span className="text-xs text-gray-400">
                #{index + 1}
              </span>
            </div>
            <p className="text-sm text-gray-700">{finding.content}</p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            📋 合并报告：{topic}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">
              {departments.length} 个部门 · {findings.length} 条发现
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                phase === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {phase === 'completed' ? '已完成' : '进行中'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onBackToWorkspace && (
            <button
              onClick={onBackToWorkspace}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              ← 返回工作区
            </button>
          )}
          {onExport && (
            <>
              <button
                onClick={() => onExport('markdown')}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                导出 Markdown
              </button>
              <button
                onClick={() => onExport('json')}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                导出 JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* 统计摘要 */}
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex flex-wrap gap-4">
          {Array.from(stats.categoryCounts.entries()).map(([category, count]) => (
            <div key={category} className="flex items-center gap-1">
              <span>{CATEGORY_ICON[category]}</span>
              <span className="text-sm text-gray-600">
                {CATEGORY_LABELS[category]}: {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-white">
        <button
          onClick={() => setGroupBy('category')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            groupBy === 'category'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          按类别
        </button>
        <button
          onClick={() => setGroupBy('department')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            groupBy === 'department'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          按部门
        </button>
        <button
          onClick={() => setGroupBy('priority')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            groupBy === 'priority'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          按优先级
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-auto p-4">
        {groupBy === 'category' && renderCategoryView()}
        {groupBy === 'department' && renderDepartmentView()}
        {groupBy === 'priority' && renderPriorityView()}

        {findings.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            暂无发现
          </div>
        )}
      </div>
    </div>
  );
}
