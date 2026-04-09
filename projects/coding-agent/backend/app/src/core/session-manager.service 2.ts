import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

export interface AgentSession {
  id: string;
  taskId: string;
  role: string;
  status: 'active' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  cost: number;
  messageCount: number;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly sessions = new Map<string, AgentSession>();

  createSession(taskId: string, role: string): AgentSession {
    const session: AgentSession = {
      id: uuidv4(),
      taskId,
      role,
      status: 'active',
      startedAt: new Date(),
      cost: 0,
      messageCount: 0,
    };

    this.sessions.set(session.id, session);
    this.logger.log(
      `Session created: ${session.id} for task ${taskId} (role: ${role})`,
    );
    return session;
  }

  completeSession(
    sessionId: string,
    result?: { cost?: number; status?: 'completed' | 'failed' },
  ): AgentSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found: ${sessionId}`);
      return undefined;
    }

    session.status = result?.status ?? 'completed';
    session.completedAt = new Date();
    if (result?.cost !== undefined) {
      session.cost = result.cost;
    }

    this.logger.log(
      `Session ${sessionId} completed with status ${session.status}`,
    );
    return session;
  }

  getActiveSessions(): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active',
    );
  }

  getSessionsForTask(taskId: string): AgentSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.taskId === taskId,
    );
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  resumeSession(sessionId: string): AgentSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session not found for resume: ${sessionId}`);
      return undefined;
    }

    if (session.status === 'paused') {
      session.status = 'active';
      this.logger.log(`Session ${sessionId} resumed`);
    }

    return session;
  }

  pauseSession(sessionId: string): AgentSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (session.status === 'active') {
      session.status = 'paused';
      this.logger.log(`Session ${sessionId} paused`);
    }

    return session;
  }
}
