import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { AgentState, AgentDocument, AGENT_TYPES } from '../core/base-agent';

/**
 * Brainstorming session metadata
 */
export interface BrainstormingSessionMeta {
  planId: string;
  planName: string;
  agentSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Brainstorming session with full state
 */
export interface BrainstormingSession {
  agent: AgentState;
  meta: BrainstormingSessionMeta;
}

/**
 * Plan state.json structure
 */
interface PlanState {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  created: string;
  updated: string;
  agentSessionId?: string;
}

/**
 * Cached session data
 */
interface CachedSession {
  state: AgentState;
  meta: BrainstormingSessionMeta;
}

// Constants (previously on BrainstormingAgent)
const PROMPT_FILE = '.agent-prompts/brainstorming.md';
const CONTEXT_FILES = ['docs/backlog-structure.md', 'docs/README.md'];

@Injectable()
export class BrainstormingService {
  private readonly logger = new Logger(BrainstormingService.name);
  private readonly backlogDir: string;
  private readonly repoRoot: string;

  // Cache of active brainstorming sessions by planId
  private sessions: Map<string, CachedSession> = new Map();

  constructor() {
    // Navigate up from dist directory to repo root
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
    this.backlogDir = path.join(this.repoRoot, '.coding-agent-data', 'backlog');
  }

  /**
   * Generate a new plan ID
   */
  private generatePlanId(): string {
    const hex = randomBytes(3).toString('hex');
    return `p-${hex}`;
  }

  /**
   * Build documents list for a brainstorming session
   */
  private buildDocuments(planId: string, planPath: string): AgentDocument[] {
    return [
      {
        id: 'brainstorming-prompt',
        name: 'brainstorming.md',
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
        id: `plan-${planId}`,
        name: 'plan.md',
        path: path.join(planPath, 'plan.md'),
        type: 'output' as const,
      },
    ];
  }

  /**
   * Build AgentState for a brainstorming session
   */
  private buildAgentState(planId: string, planName: string, planPath: string, agentSessionId?: string): AgentState {
    return {
      id: 'brainstorming-agent',
      name: planName || 'New Brainstorm',
      description: 'Helps develop and refine project plans through collaborative discussion',
      icon: 'lightbulb',
      type: AGENT_TYPES.brainstorming,
      status: 'idle',
      documents: this.buildDocuments(planId, planPath),
    };
  }

  /**
   * Build metadata for a brainstorming session
   */
  private buildMeta(planId: string, planName: string, agentSessionId?: string): BrainstormingSessionMeta {
    const now = new Date().toISOString();
    return {
      planId,
      planName,
      agentSessionId,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get or create cached session for a plan
   */
  private getOrCreateCachedSession(planId: string, planName: string, agentSessionId?: string): CachedSession {
    let cached = this.sessions.get(planId);
    if (!cached) {
      const planPath = path.join(this.backlogDir, planId);
      cached = {
        state: this.buildAgentState(planId, planName, planPath, agentSessionId),
        meta: this.buildMeta(planId, planName, agentSessionId),
      };
      this.sessions.set(planId, cached);
    } else {
      // Update name and agentSessionId from disk state
      cached.state.name = planName || 'New Brainstorm';
      cached.meta.planName = planName;
      if (agentSessionId) {
        cached.meta.agentSessionId = agentSessionId;
      }
    }
    return cached;
  }

  /**
   * Create a new brainstorming session
   */
  async createSession(name?: string): Promise<BrainstormingSession> {
    const planId = this.generatePlanId();
    const planPath = path.join(this.backlogDir, planId);
    const sessionName = name || 'Untitled Session';

    this.logger.log(
      `Creating new brainstorming session: ${planId} - ${sessionName}`,
    );

    // Create the plan directory
    await fs.mkdir(planPath, { recursive: true });

    // Create initial state.json
    const state: PlanState = {
      id: planId,
      name: sessionName,
      status: 'active',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
    await fs.writeFile(
      path.join(planPath, 'state.json'),
      JSON.stringify(state, null, 2),
    );

    // Create empty plan.md
    await fs.writeFile(
      path.join(planPath, 'plan.md'),
      `# ${sessionName}\n\n*Brainstorming session started...*\n`,
    );

    // Build and cache session
    const cached = this.getOrCreateCachedSession(planId, sessionName);

    return {
      agent: cached.state,
      meta: cached.meta,
    };
  }

  /**
   * Get all brainstorming sessions
   */
  async listSessions(): Promise<BrainstormingSession[]> {
    const sessions: BrainstormingSession[] = [];

    try {
      // Read the backlog directory
      const entries = await fs.readdir(this.backlogDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('p-')) {
          const planId = entry.name;
          const planPath = path.join(this.backlogDir, planId);

          try {
            // Read state.json
            const stateContent = await fs.readFile(
              path.join(planPath, 'state.json'),
              'utf-8',
            );
            const state: PlanState = JSON.parse(stateContent);

            // Get or create cached session
            const cached = this.getOrCreateCachedSession(planId, state.name, state.agentSessionId);

            sessions.push({
              agent: cached.state,
              meta: cached.meta,
            });
          } catch (err) {
            this.logger.warn(`Failed to load plan ${planId}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      // Backlog dir might not exist yet
      if (err.code !== 'ENOENT') {
        this.logger.error(`Failed to list sessions: ${err.message}`);
      }
    }

    // Sort by creation date, newest first
    sessions.sort(
      (a, b) =>
        new Date(b.meta.createdAt).getTime() -
        new Date(a.meta.createdAt).getTime(),
    );

    return sessions;
  }

  /**
   * Get a specific brainstorming session
   */
  async getSession(planId: string): Promise<BrainstormingSession | null> {
    const planPath = path.join(this.backlogDir, planId);

    try {
      // Check if plan exists
      await fs.access(planPath);

      // Read state.json
      const stateContent = await fs.readFile(
        path.join(planPath, 'state.json'),
        'utf-8',
      );
      const state: PlanState = JSON.parse(stateContent);

      // Get or create cached session
      const cached = this.getOrCreateCachedSession(planId, state.name, state.agentSessionId);

      return {
        agent: cached.state,
        meta: cached.meta,
      };
    } catch (err) {
      this.logger.warn(`Failed to get session ${planId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Update a brainstorming session's name
   */
  async updateSessionName(
    planId: string,
    name: string,
  ): Promise<BrainstormingSession | null> {
    const planPath = path.join(this.backlogDir, planId);

    try {
      // Read state.json
      const stateContent = await fs.readFile(
        path.join(planPath, 'state.json'),
        'utf-8',
      );
      const state: PlanState = JSON.parse(stateContent);

      // Update name
      state.name = name;
      state.updated = new Date().toISOString();

      // Write back
      await fs.writeFile(
        path.join(planPath, 'state.json'),
        JSON.stringify(state, null, 2),
      );

      // Update cache
      const cached = this.sessions.get(planId);
      if (cached) {
        cached.state.name = name;
        cached.meta.planName = name;
      }

      return this.getSession(planId);
    } catch (err) {
      this.logger.error(`Failed to update session name: ${err.message}`);
      return null;
    }
  }

  /**
   * Link a Claude Code session to a brainstorming session
   */
  async linkAgentSession(
    planId: string,
    agentSessionId: string,
  ): Promise<void> {
    const planPath = path.join(this.backlogDir, planId);

    try {
      // Read state.json
      const stateContent = await fs.readFile(
        path.join(planPath, 'state.json'),
        'utf-8',
      );
      const state: PlanState = JSON.parse(stateContent);

      // Update agent session ID
      state.agentSessionId = agentSessionId;
      state.updated = new Date().toISOString();

      // Write back
      await fs.writeFile(
        path.join(planPath, 'state.json'),
        JSON.stringify(state, null, 2),
      );

      // Update cache
      const cached = this.sessions.get(planId);
      if (cached) {
        cached.meta.agentSessionId = agentSessionId;
      }

      this.logger.log(`Linked session ${agentSessionId} to plan ${planId}`);
    } catch (err) {
      this.logger.error(`Failed to link agent session: ${err.message}`);
    }
  }

  /**
   * Get the prompt file path for brainstorming
   */
  getPromptFilePath(): string {
    return path.join(this.repoRoot, PROMPT_FILE);
  }

  /**
   * Get the context file paths for brainstorming
   */
  getContextFilePaths(): string[] {
    return CONTEXT_FILES.map((file) =>
      path.join(this.repoRoot, file),
    );
  }

  /**
   * Delete a brainstorming session
   */
  async deleteSession(planId: string): Promise<boolean> {
    const planPath = path.join(this.backlogDir, planId);

    try {
      await fs.rm(planPath, { recursive: true });
      this.sessions.delete(planId);
      this.logger.log(`Deleted brainstorming session: ${planId}`);
      return true;
    } catch (err) {
      this.logger.error(`Failed to delete session ${planId}: ${err.message}`);
      return false;
    }
  }
}
