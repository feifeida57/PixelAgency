/**
 * useCollaboration - 协作状态管理 Hook
 *
 * 提供协作会话的创建、查询、发布发现等功能。
 * 通过 WebSocket 与后端 CollaborationBus 通信。
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

export interface CollaborationSession {
  id: string;
  topic: string;
  participants: Array<{
    agentId: string;
    agentRole: string;
    department: string;
    status: string;
    joinedAt: number;
  }>;
  findings: Array<{
    id: string;
    agentId: string;
    agentRole: string;
    department: string;
    content: string;
    category: string;
    timestamp: number;
  }>;
  phase: string;
  createdAt: number;
}

export interface CollaborationState {
  sessions: CollaborationSession[];
  currentSession: CollaborationSession | null;
  isLoading: boolean;
  error: string | null;
}

export interface UseCollaborationReturn extends CollaborationState {
  /** 列出所有活跃协作会话 */
  listSessions: () => Promise<void>;
  /** 获取指定协作会话详情 */
  getSession: (sessionId: string) => Promise<void>;
  /** 创建新的协作会话 */
  createSession: (topic: string) => Promise<string | null>;
  /** 发布发现到协作会话 */
  postFinding: (params: {
    sessionId: string;
    agentId: string;
    agentRole: string;
    department: string;
    content: string;
    category?: string;
  }) => Promise<boolean>;
  /** 完成协作会话 */
  completeSession: (sessionId: string) => Promise<boolean>;
  /** 清除当前会话 */
  clearCurrentSession: () => void;
}

export function useCollaboration(): UseCollaborationReturn {
  const { sendMessage, subscribe } = useWebSocket();
  const [state, setState] = useState<CollaborationState>({
    sessions: [],
    currentSession: null,
    isLoading: false,
    error: null,
  });

  const requestIdRef = useRef(0);
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>>(new Map());

  // 订阅 WebSocket 响应
  useEffect(() => {
    const unsubscribe = subscribe((msg: any) => {
      if (msg.type === 'response' && msg.id) {
        const pending = pendingRequestsRef.current.get(msg.id);
        if (pending) {
          pendingRequestsRef.current.delete(msg.id);
          if (msg.ok) {
            pending.resolve(msg.result);
          } else {
            pending.reject(new Error(msg.error?.message || 'Unknown error'));
          }
        }
      }
    });
    return unsubscribe;
  }, [subscribe]);

  const sendRequest = useCallback(async <T>(method: string, params?: any): Promise<T> => {
    const id = `collab-${++requestIdRef.current}`;
    return new Promise((resolve, reject) => {
      pendingRequestsRef.current.set(id, { resolve, reject });
      sendMessage({ type: 'request', id, method, params });

      // 超时处理
      setTimeout(() => {
        if (pendingRequestsRef.current.has(id)) {
          pendingRequestsRef.current.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 10000);
    });
  }, [sendMessage]);

  const listSessions = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await sendRequest<{ sessions: any[] }>('collaboration_list_sessions');
      setState((prev) => ({
        ...prev,
        sessions: result.sessions.map((s) => ({
          ...s,
          participants: [],
          findings: [],
        })),
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to list sessions',
      }));
    }
  }, [sendRequest]);

  const getSession = useCallback(async (sessionId: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await sendRequest<{ session: CollaborationSession | null }>(
        'collaboration_get_session',
        { sessionId }
      );
      setState((prev) => ({
        ...prev,
        currentSession: result.session,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      }));
    }
  }, [sendRequest]);

  const createSession = useCallback(async (topic: string): Promise<string | null> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await sendRequest<{ sessionId: string; topic: string }>(
        'collaboration_create_session',
        { topic }
      );
      setState((prev) => ({ ...prev, isLoading: false }));
      return result.sessionId;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      }));
      return null;
    }
  }, [sendRequest]);

  const postFinding = useCallback(async (params: {
    sessionId: string;
    agentId: string;
    agentRole: string;
    department: string;
    content: string;
    category?: string;
  }): Promise<boolean> => {
    try {
      const result = await sendRequest<{ findingId: string; success: boolean }>(
        'collaboration_post_finding',
        params
      );
      return result.success;
    } catch (error) {
      console.error('Failed to post finding:', error);
      return false;
    }
  }, [sendRequest]);

  const completeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      const result = await sendRequest<{ success: boolean }>(
        'collaboration_complete_session',
        { sessionId }
      );
      return result.success;
    } catch (error) {
      console.error('Failed to complete session:', error);
      return false;
    }
  }, [sendRequest]);

  const clearCurrentSession = useCallback(() => {
    setState((prev) => ({ ...prev, currentSession: null }));
  }, []);

  return {
    ...state,
    listSessions,
    getSession,
    createSession,
    postFinding,
    completeSession,
    clearCurrentSession,
  };
}
