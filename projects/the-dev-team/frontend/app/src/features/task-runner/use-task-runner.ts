import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { TaskRunInfo, TaskStatus } from './types';

export function useTaskRunner() {
  const [tasks, setTasks] = useState<TaskRunInfo[]>([]);
  const [taskOutput, setTaskOutput] = useState<Map<string, string[]>>(new Map());
  const [allowedTasks, setAllowedTasks] = useState<string[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load existing tasks and allowed tasks on mount
  useEffect(() => {
    fetch('/api/task-runner/tasks')
      .then((res) => res.json())
      .then((data: TaskRunInfo[]) => setTasks(data))
      .catch(() => {});

    fetch('/api/task-runner/allowed-tasks')
      .then((res) => res.json())
      .then((data: string[]) => setAllowedTasks(data))
      .catch(() => {});
  }, []);

  // Connect to task-runner WebSocket
  useEffect(() => {
    const socket = io('/task-runner', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('task:output', (data: { taskId: string; line: string; stream: string }) => {
      setTaskOutput((prev) => {
        const next = new Map(prev);
        const lines = next.get(data.taskId) ?? [];
        next.set(data.taskId, [...lines, data.line]);
        return next;
      });
    });

    socket.on('task:status', (data: { taskId: string; status: TaskStatus; exitCode?: number }) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === data.taskId
            ? {
                ...t,
                status: data.status,
                exitCode: data.exitCode,
                finishedAt: data.status !== 'running' ? new Date().toISOString() : t.finishedAt,
              }
            : t,
        ),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const startTask = useCallback(
    async (taskName: string, vars?: Record<string, string>) => {
      const res = await fetch('/api/task-runner/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName, vars }),
      });
      const task: TaskRunInfo = await res.json();
      setTasks((prev) => [task, ...prev]);
      setTaskOutput((prev) => {
        const next = new Map(prev);
        next.set(task.id, []);
        return next;
      });

      // Subscribe to the task's output stream
      socketRef.current?.emit('subscribe', { taskId: task.id });

      // Auto-open drawer and select this task
      setActiveTaskId(task.id);
      setDrawerOpen(true);

      return task;
    },
    [],
  );

  const cancelTask = useCallback((taskId: string) => {
    socketRef.current?.emit('cancel', { taskId });
  }, []);

  const dismissTask = useCallback((taskId: string) => {
    fetch(`/api/task-runner/tasks/${taskId}/dismiss`, { method: 'POST' }).catch(() => {});
    socketRef.current?.emit('unsubscribe', { taskId });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setTaskOutput((prev) => {
      const next = new Map(prev);
      next.delete(taskId);
      return next;
    });
    setActiveTaskId((prev) => (prev === taskId ? null : prev));
  }, []);

  // Subscribe to output of any running tasks on reconnect
  useEffect(() => {
    const running = tasks.filter((t) => t.status === 'running');
    for (const t of running) {
      socketRef.current?.emit('subscribe', { taskId: t.id });
    }
  }, [tasks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const runningCount = tasks.filter((t) => t.status === 'running').length;

  return {
    tasks,
    taskOutput,
    allowedTasks,
    activeTaskId,
    setActiveTaskId,
    drawerOpen,
    setDrawerOpen,
    runningCount,
    startTask,
    cancelTask,
    dismissTask,
  };
}
