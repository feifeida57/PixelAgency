/**
 * CollaborationBus - 跨部门协作总线
 *
 * 管理多智能体协作会话，提供共享工作区让不同部门的智能体
 * 可以发布发现、读取他人结果、请求其他部门输入。
 */

export interface Finding {
  id: string;
  agentId: string;
  agentRole: string;
  department: string;
  content: string;
  category: "analysis" | "recommendation" | "concern" | "data" | "decision";
  timestamp: number;
}

export interface Participant {
  agentId: string;
  agentRole: string;
  department: string;
  status: "working" | "completed" | "waiting";
  joinedAt: number;
}

export interface CollaborationSession {
  id: string;
  topic: string;
  participants: Map<string, Participant>;
  findings: Finding[];
  phase: "collecting" | "discussing" | "merging" | "completed";
  createdAt: number;
}

export interface CollaborationSummary {
  sessionId: string;
  topic: string;
  participantCount: number;
  findingCount: number;
  phase: string;
  findingsByDepartment: Record<string, Finding[]>;
}

// 会话存储
const sessions = new Map<string, CollaborationSession>();

// 自增 ID
let nextSessionId = 1;
let nextFindingId = 1;

function generateSessionId(): string {
  return `collab-${nextSessionId++}`;
}

function generateFindingId(): string {
  return `f-${nextFindingId++}`;
}

/**
 * 创建新的协作会话
 */
export function createSession(topic: string): CollaborationSession {
  const session: CollaborationSession = {
    id: generateSessionId(),
    topic,
    participants: new Map(),
    findings: [],
    phase: "collecting",
    createdAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

/**
 * 获取协作会话
 */
export function getSession(sessionId: string): CollaborationSession | undefined {
  return sessions.get(sessionId);
}

/**
 * 获取或创建活跃会话（如果没有则自动创建）
 */
export function getOrCreateSession(topic: string): CollaborationSession {
  // 查找最近的 collecting 阶段会话
  for (const session of sessions.values()) {
    if (session.phase === "collecting" && session.topic === topic) {
      return session;
    }
  }
  return createSession(topic);
}

/**
 * 添加参与者到协作会话
 */
export function addParticipant(
  sessionId: string,
  agentId: string,
  agentRole: string,
  department: string
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  session.participants.set(agentId, {
    agentId,
    agentRole,
    department,
    status: "working",
    joinedAt: Date.now(),
  });
  return true;
}

/**
 * 更新参与者状态
 */
export function updateParticipantStatus(
  sessionId: string,
  agentId: string,
  status: Participant["status"]
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const participant = session.participants.get(agentId);
  if (!participant) return false;

  participant.status = status;
  return true;
}

/**
 * 发布发现到协作会话
 */
export function postFinding(
  sessionId: string,
  agentId: string,
  agentRole: string,
  department: string,
  content: string,
  category: Finding["category"] = "analysis"
): Finding | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const finding: Finding = {
    id: generateFindingId(),
    agentId,
    agentRole,
    department,
    content,
    category,
    timestamp: Date.now(),
  };

  session.findings.push(finding);
  return finding;
}

/**
 * 读取协作会话中的所有发现
 */
export function readFindings(sessionId: string): Finding[] {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return [...session.findings];
}

/**
 * 按部门读取发现
 */
export function readFindingsByDepartment(
  sessionId: string,
  department: string
): Finding[] {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.findings.filter((f) => f.department === department);
}

/**
 * 按类别读取发现
 */
export function readFindingsByCategory(
  sessionId: string,
  category: Finding["category"]
): Finding[] {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.findings.filter((f) => f.category === category);
}

/**
 * 更新协作阶段
 */
export function updatePhase(
  sessionId: string,
  phase: CollaborationSession["phase"]
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.phase = phase;
  return true;
}

/**
 * 获取协作摘要
 */
export function getSummary(sessionId: string): CollaborationSummary | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const findingsByDepartment: Record<string, Finding[]> = {};
  for (const finding of session.findings) {
    if (!findingsByDepartment[finding.department]) {
      findingsByDepartment[finding.department] = [];
    }
    findingsByDepartment[finding.department].push(finding);
  }

  return {
    sessionId: session.id,
    topic: session.topic,
    participantCount: session.participants.size,
    findingCount: session.findings.length,
    phase: session.phase,
    findingsByDepartment,
  };
}

/**
 * 列出所有活跃会话
 */
export function listActiveSessions(): CollaborationSession[] {
  return Array.from(sessions.values()).filter(
    (s) => s.phase !== "completed"
  );
}

/**
 * 完成并清理会话
 */
export function completeSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  session.phase = "completed";
  return true;
}

/**
 * 删除会话
 */
export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}
