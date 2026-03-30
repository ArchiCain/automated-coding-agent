import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { AgentProviderRegistry, AgentMessage } from '../providers';
import { AgentsService } from './agents.service';

/**
 * Session status
 */
export type SessionStatus = 'active' | 'completed' | 'failed' | 'paused';

/**
 * Session metadata
 */
export interface SessionMetadata {
  sessionId: string;
  cwd: string;
  status: SessionStatus;
  model: string;
  startedAt: string;
  lastActivityAt: string;
  completedAt?: string;
  error?: string;
  title?: string;
  agentName?: string;
  agentSlug?: string;
  startedFromRoute?: string;
  planDir?: string;
  sdkSessionId?: string;
  conversational?: boolean;
  provider?: string;
  readOnly?: boolean;
}

/**
 * Persisted session data
 */
export interface PersistedSession {
  metadata: SessionMetadata;
  transcript: string[];
}

/**
 * Options for starting a new session
 */
export interface StartSessionOptions {
  cwd: string;
  model?: string;
  title?: string;
  agentName?: string;
  agentSlug?: string;
  startedFromRoute?: string;
  planDir?: string;
  conversational?: boolean;
  instructionsFile?: string;
  knowledgeFiles?: string[];
  provider?: string;
  readOnly?: boolean;
}

/**
 * In-memory session state for active sessions
 */
interface ActiveSession {
  metadata: SessionMetadata;
  transcript: string[];
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  abortController: AbortController;
  instructionsFile?: string;
  knowledgeFiles?: string[];
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly repoRoot: string;

  // Active sessions in memory (ephemeral - no persistence)
  private activeSessions: Map<string, ActiveSession> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly providerRegistry: AgentProviderRegistry,
    @Inject(forwardRef(() => AgentsService))
    private readonly agentsService: AgentsService,
  ) {
    // Navigate from app/dist/features/claude-code-agent/services to repo root
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../');
  }

  /**
   * Get the repository root path
   */
  getRepoRoot(): string {
    return this.repoRoot;
  }

  /**
   * List all active sessions
   */
  listSessions(): SessionMetadata[] {
    return Array.from(this.activeSessions.values()).map(s => s.metadata);
  }

  /**
   * List available providers
   */
  async listProviders(): Promise<{ name: string; available: boolean }[]> {
    return this.providerRegistry.listAvailable();
  }

  /**
   * Start a new session
   */
  async startSession(prompt: string, options: StartSessionOptions): Promise<SessionMetadata> {
    const sessionId = uuidv4();
    const timestamp = new Date().toISOString();
    const model = options.model || 'claude-opus-4-5-20251101';
    const provider = options.provider || 'claude-code';

    const metadata: SessionMetadata = {
      sessionId,
      cwd: options.cwd,
      status: 'active',
      model,
      startedAt: timestamp,
      lastActivityAt: timestamp,
      title: options.title,
      agentName: options.agentName,
      agentSlug: options.agentSlug,
      startedFromRoute: options.startedFromRoute,
      planDir: options.planDir,
      conversational: options.conversational ?? false,
      provider,
      readOnly: options.readOnly ?? false,
    };

    // Auto-resolve instructions file from agent slug if not explicitly provided
    const instructionsFile = options.instructionsFile
      || (options.agentSlug ? `.coding-agent-data/agents/${options.agentSlug}/instructions.md` : undefined);

    // Initialize in-memory state
    const activeSession: ActiveSession = {
      metadata,
      transcript: [],
      messages: [],
      abortController: new AbortController(),
      instructionsFile,
      knowledgeFiles: options.knowledgeFiles,
    };
    this.activeSessions.set(sessionId, activeSession);

    this.logger.log(`Session ${sessionId} started in ${options.cwd} (provider=${provider}, readOnly=${options.readOnly ?? false})`);

    // Persist initial session state
    await this.persistSession(sessionId);

    // Emit started event
    this.emitEvent('session:started', { session: metadata });

    // Execute the initial prompt
    this.executePrompt(sessionId, prompt).catch((err) => {
      this.logger.error(`Session ${sessionId} initial prompt failed: ${err}`);
    });

    return metadata;
  }

  /**
   * End a session (marks as completed)
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    const timestamp = new Date().toISOString();

    if (session) {
      session.metadata.status = 'completed';
      session.metadata.completedAt = timestamp;
      session.metadata.lastActivityAt = timestamp;

      // Persist before removing from memory
      await this.persistSession(sessionId);

      this.emitEvent('session:completed', { session: session.metadata });
      this.activeSessions.delete(sessionId);
    }

    this.logger.log(`Session ${sessionId} ended`);
  }

  /**
   * Pause a session (keeps it resumable)
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.metadata.status = 'paused';
      session.metadata.lastActivityAt = new Date().toISOString();
      await this.persistSession(sessionId);
      this.logger.log(`Session ${sessionId} paused`);
    }
  }

  /**
   * Interrupt a running session via AbortController
   */
  interruptSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session ${sessionId} not found for interrupt`);
      return false;
    }

    this.logger.log(`Interrupting session ${sessionId}`);
    session.abortController.abort();
    session.metadata.status = 'paused';
    session.metadata.lastActivityAt = new Date().toISOString();

    this.emitEvent('session:paused', { sessionId });
    return true;
  }

  /**
   * Get session metadata (in-memory only)
   */
  getSession(sessionId: string): SessionMetadata | null {
    const active = this.activeSessions.get(sessionId);
    return active?.metadata || null;
  }

  /**
   * Get session transcript (in-memory only)
   */
  getSessionTranscript(sessionId: string): string[] {
    const active = this.activeSessions.get(sessionId);
    return active?.transcript || [];
  }

  /**
   * Check if a session is active in memory
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Load a persisted session from disk
   */
  async loadPersistedSession(sessionId: string, planDir: string): Promise<PersistedSession | null> {
    const sessionPath = path.join(planDir, 'sessions', sessionId, 'session.json');
    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      const data = JSON.parse(content) as PersistedSession;
      this.logger.log(`Loaded persisted session ${sessionId} from ${sessionPath}`);
      return data;
    } catch (err) {
      this.logger.debug(`No persisted session found at ${sessionPath}`);
      return null;
    }
  }

  /**
   * Persist session to disk (in planDir/sessions/{sessionId}/session.json)
   */
  private async persistSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.metadata.planDir) {
      return; // No planDir means we can't persist
    }

    const sessionsDir = path.join(session.metadata.planDir, 'sessions', sessionId);
    const sessionPath = path.join(sessionsDir, 'session.json');

    try {
      await fs.mkdir(sessionsDir, { recursive: true });
      const data: PersistedSession = {
        metadata: session.metadata,
        transcript: session.transcript,
      };
      await fs.writeFile(sessionPath, JSON.stringify(data, null, 2));
      this.logger.debug(`Persisted session ${sessionId} to ${sessionPath}`);
    } catch (err) {
      this.logger.error(`Failed to persist session ${sessionId}: ${err}`);
    }
  }

  /**
   * Update session status and persist
   */
  async updateSessionStatus(sessionId: string, status: SessionStatus): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.metadata.status = status;
      session.metadata.lastActivityAt = new Date().toISOString();
      if (status === 'completed' || status === 'failed') {
        session.metadata.completedAt = new Date().toISOString();
      }
      await this.persistSession(sessionId);
    }
  }

  /**
   * Send a message to an active session
   */
  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session ${sessionId} not found for message`);
      return;
    }

    // Store user message
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Create fresh AbortController for new turn
    session.abortController = new AbortController();

    // Execute the message
    await this.executePrompt(sessionId, message);
  }

  // ==================== Private Methods ====================

  /**
   * Build enriched prompt by reading instructionsFile and knowledgeFiles
   */
  private async buildEnrichedPrompt(
    userMessage: string,
    session: ActiveSession,
  ): Promise<{ enrichedMessage: string; systemPrompt?: string }> {
    let systemPrompt: string | undefined;
    const knowledgeParts: string[] = [];

    // Read instructions file as system prompt
    if (session.instructionsFile) {
      try {
        const resolvedPath = path.isAbsolute(session.instructionsFile)
          ? session.instructionsFile
          : path.join(this.repoRoot, session.instructionsFile);
        systemPrompt = await fs.readFile(resolvedPath, 'utf-8');
        this.logger.log(`Loaded instructions file: ${resolvedPath}`);
      } catch (err) {
        this.logger.warn(`Failed to read instructions file ${session.instructionsFile}: ${err}`);
      }
    }

    // Read knowledge files and prepend to user message
    if (session.knowledgeFiles && session.knowledgeFiles.length > 0) {
      for (const file of session.knowledgeFiles) {
        try {
          const resolvedPath = path.isAbsolute(file)
            ? file
            : path.join(this.repoRoot, file);
          const content = await fs.readFile(resolvedPath, 'utf-8');
          const fileName = path.basename(file);
          knowledgeParts.push(`--- ${fileName} ---\n\`\`\`\n${content}\n\`\`\``);
          this.logger.log(`Loaded knowledge file: ${resolvedPath}`);
        } catch (err) {
          this.logger.warn(`Failed to read knowledge file ${file}: ${err}`);
        }
      }
    }

    // Build enriched message
    let enrichedMessage = userMessage;
    if (knowledgeParts.length > 0) {
      enrichedMessage = `# Knowledge Files\n\n${knowledgeParts.join('\n\n')}\n\n# User Request\n\n${userMessage}`;
    }

    return { enrichedMessage, systemPrompt };
  }

  /**
   * Execute a prompt using the configured provider
   */
  private async executePrompt(sessionId: string, prompt: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      // Build enriched prompt with context files and system prompt
      const { enrichedMessage, systemPrompt } = await this.buildEnrichedPrompt(prompt, session);

      // Get the provider for this session
      const providerName = session.metadata.provider || 'claude-code';
      const provider = this.providerRegistry.get(providerName);

      // Build env vars
      const env: Record<string, string> = {};
      if (session.metadata.agentName) {
        env.CLAUDE_AGENT_NAME = session.metadata.agentName;
        env.CLAUDE_SESSION_ID = sessionId;
        this.logger.log(`Setting env vars: CLAUDE_AGENT_NAME=${session.metadata.agentName}`);
      }

      // Build resume ID for conversational mode
      const resume = (session.metadata.conversational && session.metadata.sdkSessionId)
        ? session.metadata.sdkSessionId
        : undefined;

      if (resume) {
        this.logger.log(`Resuming SDK session: ${resume}`);
      }

      const uploadsDir = path.join(this.repoRoot, '.uploads');
      const resolvedCwd = path.isAbsolute(session.metadata.cwd)
        ? session.metadata.cwd
        : path.resolve(this.repoRoot, session.metadata.cwd);
      const queryResult = provider.query(enrichedMessage, {
        cwd: resolvedCwd,
        model: session.metadata.model,
        systemPrompt,
        abortController: session.abortController,
        resume,
        env: Object.keys(env).length > 0 ? { ...process.env as Record<string, string>, ...env } : undefined,
        readOnly: session.metadata.readOnly,
        additionalDirectories: [uploadsDir],
      });

      let assistantResponse = '';

      for await (const message of queryResult) {
        // Check if session is still active
        if (!this.activeSessions.has(sessionId)) {
          break;
        }

        // Capture SDK session ID from init message
        if (message.type === 'system' && message.subtype === 'init') {
          const initData = message as unknown as { session_id?: string };
          if (initData.session_id) {
            session.metadata.sdkSessionId = initData.session_id;
            this.logger.log(`Captured SDK session ID: ${initData.session_id}`);
          }
        }

        const logLine = this.formatMessage(message);
        if (logLine) {
          // Store in transcript
          session.transcript.push(logLine);

          // Persist to agent's session directory
          if (session.metadata.agentSlug) {
            this.agentsService.appendSessionLine(session.metadata.agentSlug, sessionId, logLine).catch(() => {});
          }

          // Emit to WebSocket
          this.emitEvent('session:output', {
            sessionId,
            line: logLine,
            timestamp: new Date().toISOString(),
          });
        }

        // Capture assistant text
        if (message.type === 'assistant') {
          const msgContent = (message as any).message?.content;
          if (msgContent) {
            for (const block of msgContent) {
              if (block.type === 'text') {
                assistantResponse += block.text;
              }
            }
          }
        }

        // Handle completion
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            // Store assistant response
            if (assistantResponse) {
              session.messages.push({
                role: 'assistant',
                content: assistantResponse,
                timestamp: new Date().toISOString(),
              });
            }

            session.metadata.lastActivityAt = new Date().toISOString();
          } else {
            const errorMsg = 'errors' in message && Array.isArray(message.errors) && message.errors.length > 0
              ? message.errors.join(', ')
              : 'Unknown error';
            session.metadata.error = errorMsg;
          }
        }
      }

      // Mark session as paused and persist
      session.metadata.status = 'paused';
      session.metadata.lastActivityAt = new Date().toISOString();
      await this.persistSession(sessionId);

      // Emit paused event
      this.emitEvent('session:paused', {
        sessionId,
      });

      // Emit turn complete
      this.emitEvent('session:turn_complete', {
        sessionId,
        timestamp: new Date().toISOString(),
      });

    } catch (err) {
      // Handle abort (clean interruption, not a failure)
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.log(`Session ${sessionId} was interrupted`);
        session.metadata.status = 'paused';
        session.metadata.lastActivityAt = new Date().toISOString();
        await this.persistSession(sessionId);

        this.emitEvent('session:paused', { sessionId });
        this.emitEvent('session:turn_complete', {
          sessionId,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Session ${sessionId} error: ${errorMsg}`);

      session.metadata.error = errorMsg;
      session.metadata.status = 'failed';

      this.emitEvent('session:error', {
        sessionId,
        error: errorMsg,
      });
    }
  }

  /**
   * Format SDK message for display
   */
  private formatMessage(message: AgentMessage): string | null {
    // Skip result messages as they're just summary info
    if (message.type === 'result') {
      return null;
    }
    return JSON.stringify(message);
  }

  /**
   * Emit event
   */
  private emitEvent(type: string, data: Record<string, unknown>): void {
    this.eventEmitter.emit(type, { type, ...data });
  }
}
