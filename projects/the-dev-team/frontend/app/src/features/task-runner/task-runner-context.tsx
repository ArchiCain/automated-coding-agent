import { createContext, useContext, type ReactNode } from 'react';
import { useTaskRunner } from './use-task-runner';

type TaskRunnerContextValue = ReturnType<typeof useTaskRunner>;

const TaskRunnerContext = createContext<TaskRunnerContextValue | null>(null);

export function TaskRunnerProvider({ children }: { children: ReactNode }) {
  const value = useTaskRunner();
  return (
    <TaskRunnerContext.Provider value={value}>{children}</TaskRunnerContext.Provider>
  );
}

export function useTaskRunnerContext(): TaskRunnerContextValue {
  const ctx = useContext(TaskRunnerContext);
  if (!ctx) {
    throw new Error('useTaskRunnerContext must be used within TaskRunnerProvider');
  }
  return ctx;
}
