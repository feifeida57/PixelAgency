/**
 * Department Registry
 *
 * 部门 Agent 注册表，管理所有部门 Agent 的定义和调度。
 * 提供按 ID、部门、角色名查找 Agent 的能力。
 */

import {
  type DepartmentAgentDefinition,
  DEPARTMENT_AGENT_DEFINITIONS,
  getAllDepartmentAgents,
  getAgentsByDepartment,
  getDepartmentAgent,
  findAgentByRole,
  getDepartmentList,
} from "./definitions.js";

export type { DepartmentAgentDefinition };

export class DepartmentRegistry {
  private definitions: Map<string, DepartmentAgentDefinition>;

  constructor() {
    this.definitions = new Map(Object.entries(DEPARTMENT_AGENT_DEFINITIONS));
  }

  /**
   * 按 ID 获取 Agent 定义
   */
  getById(id: string): DepartmentAgentDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * 按角色名查找 Agent（支持模糊匹配）
   */
  findByRole(roleName: string): DepartmentAgentDefinition | undefined {
    return findAgentByRole(roleName);
  }

  /**
   * 获取指定部门的所有 Agent
   */
  getByDepartment(department: string): DepartmentAgentDefinition[] {
    return getAgentsByDepartment(department);
  }

  /**
   * 获取所有 Agent 定义
   */
  getAll(): DepartmentAgentDefinition[] {
    return getAllDepartmentAgents();
  }

  /**
   * 获取部门列表
   */
  listDepartments(): Array<{ id: string; name: string; count: number }> {
    return getDepartmentList();
  }

  /**
   * 构建部门 Agent 的完整系统提示
   * 将部门 Agent 的专业提示与父 Agent 的上下文合并
   */
  buildSystemPrompt(agentId: string, parentSystemPrompt?: string): string {
    const agent = this.definitions.get(agentId);
    if (!agent) {
      throw new Error(`Unknown department agent: ${agentId}`);
    }

    const parts = [agent.systemPrompt];

    if (parentSystemPrompt) {
      // 保留父 Agent 的项目指令部分，但剥离通用前缀
      parts.push("\n\n---\n\n项目上下文：\n");
      parts.push(parentSystemPrompt);
    }

    return parts.join("");
  }

  /**
   * 获取 Agent 的工具权限列表
   */
  getAllowedTools(agentId: string): string[] {
    const agent = this.definitions.get(agentId);
    if (!agent) return [];
    return [...agent.allowedTools];
  }

  /**
   * 检查 Agent 是否只读
   */
  isReadOnly(agentId: string): boolean {
    const agent = this.definitions.get(agentId);
    return agent?.isReadOnly ?? true;
  }

  /**
   * 按专业领域标签搜索 Agent
   */
  searchByExpertise(keyword: string): DepartmentAgentDefinition[] {
    const lower = keyword.toLowerCase();
    return getAllDepartmentAgents().filter((agent) =>
      agent.expertise.some((tag) => tag.toLowerCase().includes(lower)) ||
      agent.name.includes(keyword) ||
      agent.description.includes(keyword),
    );
  }
}

// 单例实例
let _instance: DepartmentRegistry | undefined;

/**
 * 获取 DepartmentRegistry 单例
 */
export function getDepartmentRegistry(): DepartmentRegistry {
  if (!_instance) {
    _instance = new DepartmentRegistry();
  }
  return _instance;
}
