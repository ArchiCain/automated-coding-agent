import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Session, AgentMessage } from '../shared';

export function useChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Map<string, AgentMessage[]>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io('/agent', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('agent:message', (msg: AgentMessage) => {
      const sid = msg.sessionId;
      if (!sid) return;
      setMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(sid) ?? [];
        next.set(sid, [...existing, msg]);
        return next;
      });
    });

    socket.on('agent:done', (data: { sessionId: string }) => {
      const { sessionId } = data;
      setIsStreaming(false);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, lastMessageAt: new Date().toISOString() }
            : s,
        ),
      );
    });

    socket.on('agent:error', (data: { sessionId: string; error: string }) => {
      const { sessionId, error } = data;
      setMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(sessionId) ?? [];
        next.set(sessionId, [
          ...existing,
          { type: 'error', sessionId, content: error },
        ]);
        return next;
      });
      setIsStreaming(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const createSession = useCallback(async () => {
    const res = await fetch('/api/agent/sessions', { method: 'POST' });
    const session = (await res.json()) as Session;
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessages((prev) => {
      const next = new Map(prev);
      next.set(session.id, []);
      return next;
    });
  }, []);

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await fetch(`/api/agent/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setMessages((prev) => {
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
    },
    [activeSessionId],
  );

  const sendMessage = useCallback(
    (message: string) => {
      if (!activeSessionId || !socketRef.current) return;
      setIsStreaming(true);
      setMessages((prev) => {
        const next = new Map(prev);
        const existing = next.get(activeSessionId) ?? [];
        next.set(activeSessionId, [
          ...existing,
          { type: 'user', sessionId: activeSessionId, content: message },
        ]);
        return next;
      });
      socketRef.current.emit('message', {
        sessionId: activeSessionId,
        message,
      });
    },
    [activeSessionId],
  );

  const cancelMessage = useCallback(() => {
    if (!activeSessionId || !socketRef.current) return;
    socketRef.current.emit('cancel', { sessionId: activeSessionId });
    setIsStreaming(false);
  }, [activeSessionId]);

  const activeMessages = activeSessionId
    ? messages.get(activeSessionId) ?? []
    : [];

  return {
    sessions,
    activeSessionId,
    activeMessages,
    isStreaming,
    createSession,
    deleteSession,
    sendMessage,
    cancelMessage,
    setActiveSessionId,
  };
}
