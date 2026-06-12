/**
 * `dispatch` builtin tool — 调度部门 Agent 执行专业任务
 *
 * 与 `agent` 工具的区别：
 * - `agent`: 通用子代理，无身份，fire-and-forget
 * - `dispatch`: 面向部门调度，携带 Agent 专业身份和上下文，支持协作
 *
 * 使用方式：
 * dispatch({
 *   department: "product",
 *   agentRole: "产品经理",
 *   task: "分析用户需求并输出 PRD",
 *   context: "其他 Agent 的讨论结果（可选）"
 * })
 */

import { randomUUID } from "node:crypto";
import type { CanonicalModelRequest, CanonicalUsage } from "../../model/index.js";
import type { PermissionResult } from "../../permission/index.js";
import { PilotDeckToolRuntimeError } from "../protocol/errors.js";
import type {
  PilotDeckSubagentForkApi,
  PilotDeckToolDefinition,
  PilotDeckToolExecutionOutput,
  PilotDeckToolModelClient,
  PilotDeckToolRuntimeContext,
} from "../protocol/types.js";
import {
  getDepartmentAgent,
  findAgentByRole,
  getDepartmentList,
  type DepartmentAgentDefinition,
} from "../../agent/departments/index.js";

export type DispatchInput = {
  /** 部门 ID，如 "product", "engineering", "design" */
  department: string;
  /** 具体角色名，如 "产品经理", "React工程师" */
  agentRole: string;
  /** 任务描述 */
  task: string;
  /** 附加上下文（其他 Agent 的讨论结果等） */
  context?: string;
  /** 需要协作的其他 Agent 角色名列表 */
  collaborationWith?: string[];
};

export type DispatchOutput = {
  agentId: string;
  agentName: string;
  department: string;
  departmentName: string;
  task: string;
  text: string;
  usage?: CanonicalUsage;
  turns?: number;
  durationMs?: number;
  parsed?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 60 * 60_000;

export function createDispatchTool(): PilotDeckToolDefinition<DispatchInput, DispatchOutput> {
  return {
    name: "dispatch",
    aliases: ["Dispatch", "调度"],
    description: buildDispatchToolDescription(),
    kind: "agent",
    inputSchema: {
      type: "object",
      required: ["department", "agentRole", "task"],
      additionalProperties: false,
      properties: {
        department: {
          type: "string",
          description: `部门 ID。可用部门：${getDepartmentList().map((d) => `${d.id}(${d.name})`).join("、")}`,
        },
        agentRole: {
          type: "string",
          description: '具体角色名，如 "产品经理"、"React工程师"、"UI设计师"。会按名称模糊匹配。',
        },
        task: {
          type: "string",
          description: "任务描述。请详细说明目标、约束和期望输出。",
        },
        context: {
          type: "string",
          description: "附加上下文，如其他 Agent 的讨论结果、项目背景等。",
        },
        collaborationWith: {
          type: "array",
          items: { type: "string" },
          description: "需要协作的其他 Agent 角色名列表（预留字段，后续支持跨 Agent 讨论）。",
        },
      },
    },
    maxResultBytes: 200_000,
    isReadOnly: () => false,
    isConcurrencySafe: () => true, // 多个 dispatch 可以并行执行
    isOpenWorld: () => true,
    checkPermissions: async (): Promise<PermissionResult> => ({
      type: "allow",
      reason: {
        type: "tool",
        toolName: "dispatch",
        message: "Department agent dispatch is allowed.",
      },
    }),
    execute: async (input, context) => {
      const agent = resolveAgent(input);
      const directive = buildDirective(input, agent);

      // 优先使用 full fork 模式
      if (context.subagent) {
        return runFullFork({
          input,
          context,
          agent,
          directive,
          fork: context.subagent,
        });
      }

      // Fallback: 单次模型调用
      return runFallback({
        input,
        context,
        agent,
        directive,
      });
    },
  };
}

/**
 * 解析目标 Agent：先按 ID 查，再按角色名模糊匹配
 */
function resolveAgent(input: DispatchInput): DepartmentAgentDefinition {
  // 先尝试 department + agentRole 组合查找
  const byId = getDepartmentAgent(`${input.department}-${input.agentRole}`);
  if (byId) return byId;

  // 按角色名模糊匹配
  const byRole = findAgentByRole(input.agentRole);
  if (byRole) return byRole;

  // 按部门列出可用 Agent
  const deptAgents = getDepartmentList();
  const deptInfo = deptAgents.find((d) => d.id === input.department);

  throw new PilotDeckToolRuntimeError(
    "invalid_tool_input",
    `找不到角色「${input.agentRole}」。` +
      (deptInfo
        ? `部门「${deptInfo.name}」可用的角色请查阅部门定义。`
        : `部门「${input.department}」不存在。可用部门：${deptAgents.map((d) => `${d.id}(${d.name})`).join("、")}`),
  );
}

/**
 * 构建给部门 Agent 的指令
 */
function buildDirective(input: DispatchInput, agent: DepartmentAgentDefinition): string {
  const parts: string[] = [];

  parts.push(`## 任务分配\n\n${input.task}`);

  if (input.context) {
    parts.push(`\n\n## 背景信息\n\n${input.context}`);
  }

  if (input.collaborationWith && input.collaborationWith.length > 0) {
    parts.push(`\n\n## 协作要求\n\n本任务需要与以下角色协作：${input.collaborationWith.join("、")}。请在输出中明确标注需要其他角色配合的事项。`);
  }

  parts.push(`\n\n## 你的身份\n\n你是「${agent.name}」（${agent.departmentName}）。${agent.description}`);

  return parts.join("");
}

/**
 * Full fork 模式：使用 SubAgentSession 运行独立 AgentLoop
 */
async function runFullFork(args: {
  input: DispatchInput;
  context: PilotDeckToolRuntimeContext;
  agent: DepartmentAgentDefinition;
  directive: string;
  fork: PilotDeckSubagentForkApi;
}): Promise<PilotDeckToolExecutionOutput<DispatchOutput>> {
  const { input, context, agent, directive, fork } = args;

  const definitionId = `dept:${agent.id}`;

  // 检查定义是否已注册
  if (!fork.isAllowedDefinition(definitionId)) {
    throw new PilotDeckToolRuntimeError(
      "invalid_tool_input",
      `部门 Agent 定义「${definitionId}」未注册。请确认 builtinSubagentTypes.ts 已正确扩展。`,
    );
  }

  const currentDepth = context.subagentDepth ?? fork.depth ?? 0;
  if (currentDepth >= fork.maxSubagentDepth) {
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      `subagent_depth_exceeded (depth=${currentDepth}, max=${fork.maxSubagentDepth})`,
      { errorCode: "subagent_depth_exceeded" },
    );
  }

  const subagentId = randomUUID();
  const timeoutMs = context.subagentTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  let report;
  try {
    report = await fork.fork({
      definitionId,
      directive,
      subagentId,
      abortSignal: context.abortSignal,
      timeoutMs,
    });
  } catch (error) {
    if (context.abortSignal?.aborted) {
      throw new PilotDeckToolRuntimeError("tool_aborted", "部门 Agent 调度被中断。");
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new PilotDeckToolRuntimeError(
      "tool_execution_failed",
      `部门 Agent 执行失败: ${message}`,
      { errorCode: "subagent_execution_failed" },
    );
  }

  if (context.abortSignal?.aborted) {
    throw new PilotDeckToolRuntimeError("tool_aborted", "部门 Agent 调度被中断。");
  }

  const output: DispatchOutput = {
    agentId: agent.id,
    agentName: agent.name,
    department: agent.department,
    departmentName: agent.departmentName,
    task: input.task,
    text: report.markdown,
    usage: report.usage,
    turns: report.turns,
    durationMs: report.durationMs,
    parsed: report.parsed,
  };

  return {
    content: [
      {
        type: "text",
        text: `[${agent.emoji} ${agent.name}] ${input.task}\n\n${report.markdown}`,
      },
      { type: "json", value: output },
    ],
    data: output,
    metadata: {
      subagent: definitionId,
      subagentId,
      forkMode: "full",
      department: agent.department,
      agentName: agent.name,
      turns: report.turns,
      durationMs: report.durationMs,
    },
  };
}

/**
 * Fallback 模式：单次模型调用
 */
async function runFallback(args: {
  input: DispatchInput;
  context: PilotDeckToolRuntimeContext;
  agent: DepartmentAgentDefinition;
  directive: string;
}): Promise<PilotDeckToolExecutionOutput<DispatchOutput>> {
  const { input, context, agent, directive } = args;

  const model = context.model;
  if (!model) {
    throw new PilotDeckToolRuntimeError(
      "unsupported_tool",
      "dispatch 工具需要模型客户端。请配置 dependencies.model 或确保 context.subagent 可用。",
    );
  }

  const request: CanonicalModelRequest = {
    provider: "pilotdeck",
    model: "moonshotai/kimi-k2.6",
    messages: [{ role: "user", content: [{ type: "text", text: directive }] }],
    systemPrompt: agent.systemPrompt,
    maxOutputTokens: 4_096,
    temperature: 0,
    stream: true,
    metadata: { subagent: `dept:${agent.id}`, description: input.task },
  };

  let text = "";
  let usage: CanonicalUsage | undefined;

  for await (const event of model.stream(request, context.abortSignal)) {
    if (context.abortSignal?.aborted) {
      throw new PilotDeckToolRuntimeError("tool_aborted", "部门 Agent 调度被中断。");
    }
    switch (event.type) {
      case "text_delta":
        text += event.text;
        break;
      case "usage":
        usage = event.usage;
        break;
      case "error":
        throw new PilotDeckToolRuntimeError(
          "tool_execution_failed",
          `部门 Agent 模型错误: ${event.error.message}`,
          { errorCode: event.error.code },
        );
      default:
        break;
    }
  }

  const trimmed = text.trim();
  const output: DispatchOutput = {
    agentId: agent.id,
    agentName: agent.name,
    department: agent.department,
    departmentName: agent.departmentName,
    task: input.task,
    text: trimmed.length > 0 ? trimmed : "(部门 Agent 未返回内容)",
    usage,
  };

  return {
    content: [
      {
        type: "text",
        text: `[${agent.emoji} ${agent.name}] ${input.task}\n\n${output.text}`,
      },
      { type: "json", value: output },
    ],
    data: output,
    metadata: {
      subagent: `dept:${agent.id}`,
      forkMode: "fallback",
      department: agent.department,
      agentName: agent.name,
    },
  };
}

/**
 * 构建 dispatch 工具描述
 */
function buildDispatchToolDescription(): string {
  const deptList = getDepartmentList();
  const deptSummary = deptList.map((d) => `${d.name}(${d.count}人)`).join("、");

  return [
    "调度专业部门 Agent 执行任务。与 agent 工具不同，dispatch 会为每个 Agent 注入其专业领域的系统提示，使其以真正的专业身份工作。",
    "",
    "使用场景：",
    "- 需要专业领域知识（产品规划、技术架构、UI设计等）",
    "- 需要深度分析（竞品分析、数据分析、安全审计等）",
    "- 需要跨部门协作（产品+技术讨论方案）",
    "",
    "参数：",
    "- department: 部门 ID",
    "- agentRole: 具体角色名（支持模糊匹配）",
    "- task: 任务描述（越详细越好）",
    "- context: 附加上下文（可选，如其他 Agent 的输出）",
    "- collaborationWith: 协作角色列表（可选）",
    "",
    `可用部门：${deptSummary}`,
    "",
    "返回：Agent 的专业分析报告。",
  ].join("\n");
}
