import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderRegistry } from './providers/provider-registry';
import { AgentMessage } from './providers/provider.interface';
import { RoleRegistry } from './roles/role-registry';

/** Normalized message stored in session history */
export interface NormalizedMessage {
  sessionId: string;
  type: string;
  content?: string;
  tool?: string;
  input?: unknown;
  output?: unknown;
}

export interface Session {
  id: string;
  provider: string;
  model: string;
  role: string;
  createdAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
  abortController: AbortController | null;
  /** Claude Code session ID for resume support */
  claudeSessionId?: string;
  /** System prompt given to the agent */
  systemPrompt: string;
  /** Full normalized message history */
  messages: NormalizedMessage[];
}

/** Serializable session info (no AbortController) */
export interface SessionInfo {
  id: string;
  provider: string;
  model: string;
  role: string;
  createdAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
}

/** Fields persisted to disk (excludes runtime-only state) */
interface PersistedSession {
  id: string;
  provider: string;
  model: string;
  role: string;
  createdAt: string;
  lastMessageAt: string;
  claudeSessionId?: string;
  systemPrompt: string;
  messages: NormalizedMessage[];
}

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private readonly sessions = new Map<string, Session>();
  private readonly sessionsDir: string;

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly roleRegistry: RoleRegistry,
  ) {
    const repoRoot = process.env.REPO_ROOT || '/workspace';
    this.sessionsDir = path.join(repoRoot, '.dev-team', 'sessions');
  }

  onModuleInit(): void {
    this.loadSessions();
  }

  private loadSessions(): void {
    try {
      if (!fs.existsSync(this.sessionsDir)) return;
      const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(this.sessionsDir, file), 'utf-8');
          const data: PersistedSession = JSON.parse(raw);
          const session: Session = {
            ...data,
            role: data.role || 'default',
            createdAt: new Date(data.createdAt),
            lastMessageAt: new Date(data.lastMessageAt),
            isActive: false,
            abortController: null,
          };
          this.sessions.set(session.id, session);
        } catch (err) {
          this.logger.warn(`Failed to load session file ${file}`, err);
        }
      }
      this.logger.log(`Restored ${this.sessions.size} sessions from disk`);
    } catch (err) {
      this.logger.warn('Failed to load sessions from disk', err);
    }
  }

  private persistSession(session: Session): void {
    try {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
      const data: PersistedSession = {
        id: session.id,
        provider: session.provider,
        model: session.model,
        role: session.role,
        createdAt: session.createdAt.toISOString(),
        lastMessageAt: session.lastMessageAt.toISOString(),
        claudeSessionId: session.claudeSessionId,
        systemPrompt: session.systemPrompt,
        messages: session.messages,
      };
      fs.writeFileSync(
        path.join(this.sessionsDir, `${session.id}.json`),
        JSON.stringify(data, null, 2),
      );
    } catch (err) {
      this.logger.warn(`Failed to persist session ${session.id}`, err);
    }
  }

  private deleteSessionFile(sessionId: string): void {
    try {
      const filePath = path.join(this.sessionsDir, `${sessionId}.json`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      this.logger.warn(`Failed to delete session file ${sessionId}`, err);
    }
  }

  createSession(model?: string, provider?: string, role?: string): SessionInfo {
    const id = uuidv4();
    const agentRole = this.roleRegistry.getRole(role || 'default');
    const systemPrompt = agentRole.buildSystemPrompt();
    const session: Session = {
      id,
      provider: provider || 'claude-code',
      model: model || 'claude-sonnet-4-20250514',
      role: role || 'default',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      isActive: false,
      abortController: null,
      systemPrompt,
      messages: [],
    };
    this.sessions.set(id, session);
    this.persistSession(session);
    this.logger.log(`Session created: ${id} (provider: ${session.provider}, model: ${session.model})`);
    return this.toSessionInfo(session);
  }

  /** Append a normalized message to the session history */
  addMessage(sessionId: string, message: NormalizedMessage): void {
    const session = this.getSessionInternal(sessionId);
    session.messages.push(message);
    this.persistSession(session);
  }

  /** Get the system prompt and full message history for a session */
  getHistory(sessionId: string): { systemPrompt: string; messages: NormalizedMessage[] } {
    const session = this.getSessionInternal(sessionId);
    return { systemPrompt: session.systemPrompt, messages: [...session.messages] };
  }

  async *sendMessage(sessionId: string, message: string): AsyncIterable<AgentMessage> {
    const session = this.getSessionInternal(sessionId);

    if (session.isActive) {
      throw new Error('Session is already processing a message. Cancel it first or wait.');
    }

    const provider = this.providerRegistry.getProvider(session.provider);
    const abortController = new AbortController();
    session.abortController = abortController;
    session.isActive = true;
    session.lastMessageAt = new Date();

    const repoRoot = process.env.REPO_ROOT || '/workspace';
    const agentRole = this.roleRegistry.getRole(session.role);

    try {
      const stream = provider.query(message, {
        cwd: repoRoot,
        model: session.model,
        systemPrompt: session.systemPrompt,
        abortController,
        resume: session.claudeSessionId,
        allowedTools: agentRole.allowedTools,
        disallowedTools: agentRole.disallowedTools,
        mcpServers: agentRole.mcpServers,
      });

      for await (const msg of stream) {
        // Capture Claude Code session ID from result messages for resume support
        if (msg.type === 'result' && msg.session_id) {
          session.claudeSessionId = msg.session_id as string;
        }
        yield msg;
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        this.logger.log(`Session ${sessionId} was cancelled`);
        return;
      }
      throw err;
    } finally {
      session.isActive = false;
      session.abortController = null;
      this.persistSession(session);
    }
  }

  getSession(sessionId: string): SessionInfo {
    return this.toSessionInfo(this.getSessionInternal(sessionId));
  }

  listSessions(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => this.toSessionInfo(s));
  }

  cancelSession(sessionId: string): void {
    const session = this.getSessionInternal(sessionId);
    if (session.abortController) {
      session.abortController.abort();
      this.logger.log(`Session ${sessionId} cancelled`);
    }
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session "${sessionId}" not found`);
    }
    if (session.abortController) {
      session.abortController.abort();
    }
    this.sessions.delete(sessionId);
    this.deleteSessionFile(sessionId);
    this.logger.log(`Session ${sessionId} deleted`);
  }

  private getSessionInternal(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session "${sessionId}" not found`);
    }
    return session;
  }

  listRoles(): Array<{ name: string; displayName: string; description: string }> {
    return this.roleRegistry.listRoles();
  }

  private toSessionInfo(session: Session): SessionInfo {
    return {
      id: session.id,
      provider: session.provider,
      model: session.model,
      role: session.role,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt,
      isActive: session.isActive,
    };
  }
}
