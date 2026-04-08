import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ProviderRegistry } from './providers/provider-registry';
import { AgentMessage } from './providers/provider.interface';

export interface Session {
  id: string;
  provider: string;
  model: string;
  createdAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
  abortController: AbortController | null;
  /** Claude Code session ID for resume support */
  claudeSessionId?: string;
}

/** Serializable session info (no AbortController) */
export interface SessionInfo {
  id: string;
  provider: string;
  model: string;
  createdAt: Date;
  lastMessageAt: Date;
  isActive: boolean;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly providerRegistry: ProviderRegistry) {}

  createSession(model?: string, provider?: string): SessionInfo {
    const id = uuidv4();
    const session: Session = {
      id,
      provider: provider || 'claude-code',
      model: model || 'claude-sonnet-4-20250514',
      createdAt: new Date(),
      lastMessageAt: new Date(),
      isActive: false,
      abortController: null,
    };
    this.sessions.set(id, session);
    this.logger.log(`Session created: ${id} (provider: ${session.provider}, model: ${session.model})`);
    return this.toSessionInfo(session);
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
    const systemPrompt = [
      `You have full access to a repository at ${repoRoot}.`,
      'Use git branches for changes: git checkout -b the-dev-team/<description>',
      'Commit with conventional messages (feat:, fix:, etc.).',
      'Push and create PRs when ready. Never push to main directly.',
    ].join('\n');

    try {
      const stream = provider.query(message, {
        cwd: repoRoot,
        model: session.model,
        systemPrompt,
        abortController,
        resume: session.claudeSessionId,
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
    this.logger.log(`Session ${sessionId} deleted`);
  }

  private getSessionInternal(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`Session "${sessionId}" not found`);
    }
    return session;
  }

  private toSessionInfo(session: Session): SessionInfo {
    return {
      id: session.id,
      provider: session.provider,
      model: session.model,
      createdAt: session.createdAt,
      lastMessageAt: session.lastMessageAt,
      isActive: session.isActive,
    };
  }
}
