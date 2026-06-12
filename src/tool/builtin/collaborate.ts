/**
 * `collaborate` builtin tool — 跨部门协作工具
 *
 * 让智能体能够：
 * 1. 发布自己的分析结果到协作会话
 * 2. 读取其他部门智能体的分析结果
 * 3. 请求其他部门的输入
 * 4. 查看协作会话状态
 *
 * 与 dispatch 工具的区别：
 * - dispatch: 调度一个智能体去执行任务
 * - collaborate: 在协作会话中与其他智能体交流
 */

import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import {
  createSession,
  getSession,
  getOrCreateSession,
  addParticipant,
  updateParticipantStatus,
  postFinding,
  readFindings,
  readFindingsByDepartment,
  readFindingsByCategory,
  updatePhase,
  getSummary,
  listActiveSessions,
  completeSession,
} from "../../collaboration/index.js";
import type { Finding } from "../../collaboration/index.js";

export type CollaborateAction =
  | "create_session"
  | "join_session"
  | "post_finding"
  | "read_findings"
  | "request_input"
  | "list_sessions"
  | "get_summary"
  | "update_phase"
  | "complete_session";

export type CollaborateInput = {
  action: CollaborateAction;
  /** 协作会话 ID（join/post/read/summary/complete 时必填） */
  sessionId?: string;
  /** 协作主题（create 时必填） */
  topic?: string;
  /** 智能体身份信息 */
  agent?: {
    id: string;
    role: string;
    department: string;
  };
  /** 发布的发现内容 */
  finding?: {
    content: string;
    category?: Finding["category"];
  };
  /** 读取过滤条件 */
  filter?: {
    department?: string;
    category?: Finding["category"];
  };
  /** 请求输入的目标部门 */
  requestTo?: string;
  /** 请求输入的内容 */
  requestContent?: string;
  /** 更新的阶段 */
  phase?: "collecting" | "discussing" | "merging" | "completed";
};

export type CollaborateOutput = {
  action: string;
  success: boolean;
  sessionId?: string;
  data?: unknown;
  message: string;
};

export function createCollaborateTool(): PilotDeckToolDefinition<CollaborateInput, CollaborateOutput> {
  return {
    name: "collaborate",
    aliases: ["Collaborate", "协作"],
    description: buildCollaborateDescription(),
    kind: "custom",
    inputSchema: {
      type: "object",
      required: ["action"],
      additionalProperties: false,
      properties: {
        action: {
          type: "string",
          description: "协作操作类型",
          enum: [
            "create_session",
            "join_session",
            "post_finding",
            "read_findings",
            "request_input",
            "list_sessions",
            "get_summary",
            "update_phase",
            "complete_session",
          ],
        },
        sessionId: {
          type: "string",
          description: "协作会话 ID（join/post/read/summary/complete 时必填）",
        },
        topic: {
          type: "string",
          description: "协作主题（create 时必填）",
        },
        agent: {
          type: "object",
          description: "智能体身份信息",
          properties: {
            id: { type: "string", description: "智能体 ID" },
            role: { type: "string", description: "智能体角色名" },
            department: { type: "string", description: "所属部门" },
          },
          required: ["id", "role", "department"],
        },
        finding: {
          type: "object",
          description: "发布的发现内容",
          properties: {
            content: { type: "string", description: "发现内容" },
            category: {
              type: "string",
              description: "发现类别",
              enum: ["analysis", "recommendation", "concern", "data", "decision"],
            },
          },
          required: ["content"],
        },
        filter: {
          type: "object",
          description: "读取过滤条件",
          properties: {
            department: { type: "string", description: "按部门过滤" },
            category: {
              type: "string",
              description: "按类别过滤",
              enum: ["analysis", "recommendation", "concern", "data", "decision"],
            },
          },
        },
        requestTo: {
          type: "string",
          description: "请求输入的目标部门",
        },
        requestContent: {
          type: "string",
          description: "请求输入的内容",
        },
        phase: {
          type: "string",
          description: "更新的协作阶段",
          enum: ["collecting", "discussing", "merging", "completed"],
        },
      },
    },
    maxResultBytes: 100_000,
    isReadOnly: (input) => {
      const readOnlyActions = ["read_findings", "list_sessions", "get_summary"];
      return readOnlyActions.includes(input.action);
    },
    isConcurrencySafe: () => true,
    isOpenWorld: () => false,
    checkPermissions: async () => ({
      type: "allow" as const,
      reason: {
        type: "tool" as const,
        toolName: "collaborate",
        message: "Collaboration tool is allowed.",
      },
    }),
    execute: async (input, context) => {
      return executeCollaborate(input, context);
    },
  };
}

async function executeCollaborate(
  input: CollaborateInput,
  _context: PilotDeckToolRuntimeContext,
): Promise<PilotDeckToolExecutionOutput<CollaborateOutput>> {
  const { action } = input;

  switch (action) {
    case "create_session": {
      if (!input.topic) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "create_session 需要 topic 参数",
        );
      }
      const session = createSession(input.topic);
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: session.id,
        message: `协作会话已创建：${session.id}（主题：${input.topic}）`,
        data: { sessionId: session.id, topic: session.topic },
      };
      return formatOutput(output);
    }

    case "join_session": {
      if (!input.sessionId || !input.agent) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "join_session 需要 sessionId 和 agent 参数",
        );
      }
      const session = getSession(input.sessionId);
      if (!session) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      addParticipant(
        input.sessionId,
        input.agent.id,
        input.agent.role,
        input.agent.department,
      );
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `${input.agent.role}（${input.agent.department}）已加入协作会话 ${input.sessionId}`,
      };
      return formatOutput(output);
    }

    case "post_finding": {
      if (!input.sessionId || !input.agent || !input.finding) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "post_finding 需要 sessionId、agent 和 finding 参数",
        );
      }
      const session = getSession(input.sessionId);
      if (!session) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      const finding = postFinding(
        input.sessionId,
        input.agent.id,
        input.agent.role,
        input.agent.department,
        input.finding.content,
        input.finding.category,
      );
      if (!finding) {
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          "发布发现失败",
        );
      }
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `${input.agent.role} 已发布发现（${finding.category}）：${finding.content.substring(0, 100)}...`,
        data: { findingId: finding.id, category: finding.category },
      };
      return formatOutput(output);
    }

    case "read_findings": {
      if (!input.sessionId) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "read_findings 需要 sessionId 参数",
        );
      }
      const session = getSession(input.sessionId);
      if (!session) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      let findings: Finding[];
      if (input.filter?.department) {
        findings = readFindingsByDepartment(
          input.sessionId,
          input.filter.department,
        );
      } else if (input.filter?.category) {
        findings = readFindingsByCategory(
          input.sessionId,
          input.filter.category,
        );
      } else {
        findings = readFindings(input.sessionId);
      }
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `读取到 ${findings.length} 条发现`,
        data: {
          findings: findings.map((f) => ({
            id: f.id,
            agentRole: f.agentRole,
            department: f.department,
            content: f.content,
            category: f.category,
            timestamp: f.timestamp,
          })),
        },
      };
      return formatOutput(output);
    }

    case "request_input": {
      if (!input.sessionId || !input.agent || !input.requestTo || !input.requestContent) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "request_input 需要 sessionId、agent、requestTo 和 requestContent 参数",
        );
      }
      const session = getSession(input.sessionId);
      if (!session) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      // 作为 finding 发布请求，标记为 concern 类型
      const finding = postFinding(
        input.sessionId,
        input.agent.id,
        input.agent.role,
        input.agent.department,
        `[请求 ${input.requestTo} 输入] ${input.requestContent}`,
        "concern",
      );
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `已向 ${input.requestTo} 发出输入请求`,
        data: { findingId: finding?.id, requestTo: input.requestTo },
      };
      return formatOutput(output);
    }

    case "list_sessions": {
      const sessions = listActiveSessions();
      const output: CollaborateOutput = {
        action,
        success: true,
        message: `当前有 ${sessions.length} 个活跃协作会话`,
        data: {
          sessions: sessions.map((s) => ({
            id: s.id,
            topic: s.topic,
            participantCount: s.participants.size,
            findingCount: s.findings.length,
            phase: s.phase,
          })),
        },
      };
      return formatOutput(output);
    }

    case "get_summary": {
      if (!input.sessionId) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "get_summary 需要 sessionId 参数",
        );
      }
      const summary = getSummary(input.sessionId);
      if (!summary) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `协作会话 ${summary.topic}：${summary.participantCount} 位参与者，${summary.findingCount} 条发现，阶段：${summary.phase}`,
        data: summary,
      };
      return formatOutput(output);
    }

    case "update_phase": {
      if (!input.sessionId || !input.phase) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "update_phase 需要 sessionId 和 phase 参数",
        );
      }
      const success = updatePhase(input.sessionId, input.phase);
      if (!success) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `协作阶段已更新为：${input.phase}`,
      };
      return formatOutput(output);
    }

    case "complete_session": {
      if (!input.sessionId) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          "complete_session 需要 sessionId 参数",
        );
      }
      const success = completeSession(input.sessionId);
      if (!success) {
        throw new PilotDeckToolRuntimeError(
          "invalid_tool_input",
          `协作会话 ${input.sessionId} 不存在`,
        );
      }
      const output: CollaborateOutput = {
        action,
        success: true,
        sessionId: input.sessionId,
        message: `协作会话 ${input.sessionId} 已完成`,
      };
      return formatOutput(output);
    }

    default:
      throw new PilotDeckToolRuntimeError(
        "invalid_tool_input",
        `未知的协作操作：${action}`,
      );
  }
}

function formatOutput(output: CollaborateOutput): PilotDeckToolExecutionOutput<CollaborateOutput> {
  return {
    content: [
      {
        type: "text",
        text: `[collaborate] ${output.message}`,
      },
      { type: "json", value: output },
    ],
    data: output,
    metadata: {
      action: output.action,
      success: output.success,
      sessionId: output.sessionId,
    },
  };
}

function buildCollaborateDescription(): string {
  return [
    "跨部门协作工具 — 让多个智能体在协作会话中交流。",
    "",
    "使用场景：",
    "- 需要多个部门的智能体共同讨论一个问题",
    "- 需要收集不同专业视角的分析结果",
    "- 需要跨部门传递信息或请求输入",
    "",
    "操作类型：",
    "- create_session: 创建协作会话（需要 topic）",
    "- join_session: 加入协作会话（需要 sessionId + agent）",
    "- post_finding: 发布分析结果（需要 sessionId + agent + finding）",
    "- read_findings: 读取其他智能体的分析结果（需要 sessionId）",
    "- request_input: 请求其他部门输入（需要 sessionId + agent + requestTo + requestContent）",
    "- list_sessions: 列出所有活跃协作会话",
    "- get_summary: 获取协作会话摘要（需要 sessionId）",
    "- update_phase: 更新协作阶段（需要 sessionId + phase）",
    "- complete_session: 完成协作会话（需要 sessionId）",
    "",
    "协作流程：",
    "1. 秘书创建协作会话（create_session）",
    "2. 各智能体加入会话（join_session）",
    "3. 各智能体发布自己的分析结果（post_finding）",
    "4. 智能体可以读取他人的发现（read_findings）",
    "5. 智能体可以请求其他部门输入（request_input）",
    "6. 秘书汇总各方结果，更新阶段（update_phase）",
    "7. 协作完成（complete_session）",
  ].join("\n");
}
