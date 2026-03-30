import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { AgentState, AgentDocument, AGENT_TYPES } from '../core/base-agent';

/**
 * Execution session metadata
 */
export interface ExecutionSessionMeta {
  sessionId: string;
  planId: string;
  taskName: string;
  taskPath: string;
  taskMdPath: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Execution session with full state
 */
export interface ExecutionSession {
  agent: AgentState;
  meta: ExecutionSessionMeta;
}

/**
 * Cached session data
 */
interface CachedSession {
  state: AgentState;
  meta: ExecutionSessionMeta;
}

// Constants (previously on ExecutionAgent)
const PROMPT_FILE = '.agent-prompts/execution.md';
const CONTEXT_FILES = [
  'docs/backlog-structure.md',
  'docs/feature-architecture.md',
  'projects/README.md',
];

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);
  private readonly backlogDir: string;
  private readonly repoRoot: string;

  // Cache of active sessions by sessionId (ephemeral, in-memory only)
  private sessions: Map<string, CachedSession> = new Map();

  constructor() {
    // Navigate up from dist directory to repo root
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
    this.backlogDir = path.join(this.repoRoot, '.coding-agent-data', 'backlog');
  }

  /**
   * Generate a new execution session ID
   */
  private generateSessionId(): string {
    const hex = randomBytes(3).toString('hex');
    return `e-${hex}`;
  }

  /**
   * Build documents list for an execution session
   */
  private buildDocuments(taskMdPath: string): AgentDocument[] {
    return [
      {
        id: 'execution-prompt',
        name: 'execution.md',
        path: path.join(this.repoRoot, PROMPT_FILE),
        type: 'prompt',
      },
      ...CONTEXT_FILES.map((file, index) => ({
        id: `context-${index}`,
        name: path.basename(file),
        path: path.join(this.repoRoot, file),
        type: 'context' as const,
      })),
      {
        id: 'task-file',
        name: path.basename(taskMdPath),
        path: taskMdPath,
        type: 'context' as const,
      },
    ];
  }

  /**
   * Create a new execution session for a task
   * @param planId The plan ID (e.g., "p-abc123")
   * @param taskPath The relative task path (e.g., "backend" or "backend/features/auth")
   */
  async createSession(
    planId: string,
    taskPath: string,
  ): Promise<ExecutionSession> {
    const sessionId = this.generateSessionId();
    const planPath = path.join(this.backlogDir, planId);
    const fullTaskPath = path.join(planPath, 'tasks', taskPath);
    const taskMdPath = path.join(fullTaskPath, 'task.md');

    this.logger.log(`Creating execution session ${sessionId} for task ${planId}/${taskPath}`);

    // Read task.md to get the name
    let taskName = 'Task';
    try {
      const taskContent = await fs.readFile(taskMdPath, 'utf-8');
      const nameMatch = taskContent.match(/^#\s+(?:Task:\s+)?(.+)$/m);
      taskName = nameMatch ? nameMatch[1] : path.basename(taskPath);
    } catch {
      taskName = path.basename(taskPath);
    }

    // Verify the task file exists
    try {
      await fs.access(taskMdPath);
    } catch {
      throw new Error(`Task file not found: ${taskMdPath}`);
    }

    const now = new Date().toISOString();

    const state: AgentState = {
      id: 'execution-agent',
      name: `Execute: ${taskName}`,
      description: 'Implements tasks from the backlog',
      icon: 'play_circle',
      type: AGENT_TYPES.execution,
      status: 'idle',
      documents: this.buildDocuments(taskMdPath),
    };

    const meta: ExecutionSessionMeta = {
      sessionId,
      planId,
      taskName,
      taskPath: fullTaskPath,
      taskMdPath,
      createdAt: now,
      updatedAt: now,
    };

    // Cache the session (ephemeral, no disk persistence)
    this.sessions.set(sessionId, { state, meta });

    return { agent: state, meta };
  }

  /**
   * Get an execution session (in-memory only)
   */
  getSession(sessionId: string): ExecutionSession | null {
    const cached = this.sessions.get(sessionId);
    if (!cached) {
      return null;
    }

    return {
      agent: cached.state,
      meta: { ...cached.meta, updatedAt: new Date().toISOString() },
    };
  }
}
