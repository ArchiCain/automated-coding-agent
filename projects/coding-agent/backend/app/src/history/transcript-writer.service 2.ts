import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SessionMetadata {
  provider?: string;
  model?: string;
  skills?: string[];
}

export interface SessionResult {
  durationMs: number;
  cost: number;
  messagesCount: number;
  outcome: string;
}

export interface AgentMessage {
  role: string;
  content: string;
  timestamp?: string;
  toolUse?: string;
}

@Injectable()
export class TranscriptWriterService {
  private readonly logger = new Logger(TranscriptWriterService.name);
  private readonly historyRoot: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    this.historyRoot = path.join(repoRoot, '.the-dev-team', 'history');
  }

  async startSession(
    taskId: string,
    role: string,
    metadata: SessionMetadata,
  ): Promise<string> {
    const now = new Date();
    const dateDir = path.join(
      this.historyRoot,
      'sessions',
      now.getFullYear().toString(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    );
    await fs.mkdir(dateDir, { recursive: true });

    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `task-${taskId}-${role}-${timestamp}.jsonl`;
    const filepath = path.join(dateDir, filename);

    const event = {
      type: 'session_start',
      taskId,
      role,
      timestamp: now.toISOString(),
      metadata,
    };

    await this.appendLine(filepath, event);
    this.logger.debug(`Started transcript session: ${filepath}`);
    return filepath;
  }

  async logMessage(
    transcriptPath: string,
    role: string,
    message: AgentMessage,
  ): Promise<void> {
    const entry = {
      type: 'message',
      role,
      content: message.content,
      toolUse: message.toolUse,
      timestamp: message.timestamp || new Date().toISOString(),
    };

    await this.appendLine(transcriptPath, entry);
  }

  async logEvent(taskId: string, event: Record<string, unknown>): Promise<void> {
    const now = new Date();
    const dateDir = path.join(
      this.historyRoot,
      'orchestrator',
      now.getFullYear().toString(),
      String(now.getMonth() + 1).padStart(2, '0'),
    );
    await fs.mkdir(dateDir, { recursive: true });

    const filename = `${String(now.getDate()).padStart(2, '0')}.jsonl`;
    const filepath = path.join(dateDir, filename);

    const entry = {
      ...event,
      taskId,
      timestamp: now.toISOString(),
    };

    await this.appendLine(filepath, entry);
  }

  async endSession(
    transcriptPath: string,
    result: SessionResult,
  ): Promise<void> {
    const event = {
      type: 'session_end',
      timestamp: new Date().toISOString(),
      result,
    };

    await this.appendLine(transcriptPath, event);
    this.logger.debug(`Ended transcript session: ${transcriptPath}`);
  }

  private async appendLine(filepath: string, data: Record<string, unknown>): Promise<void> {
    const line = JSON.stringify(data) + '\n';
    await fs.appendFile(filepath, line, 'utf-8');
  }
}
