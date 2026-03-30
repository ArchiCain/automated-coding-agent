import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  NotFoundException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { SessionService, SessionMetadata, PersistedSession } from '../services/session.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Controller('api/claude-code-agent')
export class ClaudeCodeAgentController {
  constructor(
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Get configuration
   */
  @Get('config')
  getConfig(): { repoRoot: string } {
    return { repoRoot: this.sessionService.getRepoRoot() };
  }

  /**
   * Read a file's content
   */
  @Get('files')
  async readFile(@Query('path') filePath: string): Promise<{ content: string; isImage?: boolean; mimeType?: string }> {
    try {
      // Resolve relative paths from repo root
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.sessionService.getRepoRoot(), filePath);

      const content = await fs.readFile(resolvedPath, 'utf-8');
      return { content };
    } catch (err) {
      throw new NotFoundException(`File not found: ${filePath}`);
    }
  }

  /**
   * List all active sessions
   */
  @Get('sessions')
  listSessions(): { sessions: SessionMetadata[] } {
    return { sessions: this.sessionService.listSessions() };
  }

  /**
   * Start a new session
   */
  @Post('sessions')
  async startSession(
    @Body() body: {
      prompt: string;
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
    },
  ): Promise<{ session: SessionMetadata }> {
    const session = await this.sessionService.startSession(body.prompt, {
      cwd: body.cwd,
      model: body.model,
      title: body.title,
      agentName: body.agentName,
      agentSlug: body.agentSlug,
      startedFromRoute: body.startedFromRoute,
      planDir: body.planDir,
      conversational: body.conversational,
      instructionsFile: body.instructionsFile,
      knowledgeFiles: body.knowledgeFiles,
      provider: body.provider,
      readOnly: body.readOnly,
    });
    return { session };
  }

  /**
   * List available providers
   */
  @Get('providers')
  async listProviders(): Promise<{ providers: { name: string; available: boolean }[] }> {
    const providers = await this.sessionService.listProviders();
    return { providers };
  }

  /**
   * Interrupt a running session
   */
  @Post('sessions/:sessionId/interrupt')
  interruptSession(@Param('sessionId') sessionId: string): { success: boolean } {
    const success = this.sessionService.interruptSession(sessionId);
    return { success };
  }

  /**
   * Get session metadata (in-memory only)
   */
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string): { session: SessionMetadata | null; transcript: string[] } {
    const session = this.sessionService.getSession(sessionId);
    const transcript = this.sessionService.getSessionTranscript(sessionId);
    return { session, transcript };
  }

  /**
   * Load a persisted session from disk
   */
  @Get('sessions/:sessionId/persisted')
  async getPersistedSession(
    @Param('sessionId') sessionId: string,
    @Query('planDir') planDir: string,
  ): Promise<{ session: PersistedSession | null }> {
    if (!planDir) {
      throw new NotFoundException('planDir query parameter is required');
    }
    const session = await this.sessionService.loadPersistedSession(sessionId, planDir);
    return { session };
  }

  /**
   * Send a message to a session
   */
  @Post('sessions/:sessionId/message')
  async sendMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { message: string },
  ): Promise<{ success: boolean }> {
    await this.sessionService.sendMessage(sessionId, body.message);
    return { success: true };
  }

  /**
   * Upload files as attachments
   */
  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadFiles(
    @UploadedFiles() files: Array<{ originalname: string; mimetype: string; buffer: Buffer }>,
  ): Promise<{ attachments: Array<{ id: string; type: 'file' | 'image'; name: string; path: string }> }> {
    const uploadDir = path.join(this.sessionService.getRepoRoot(), '.uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const attachments = await Promise.all(
      files.map(async (file) => {
        const id = uuidv4();
        const ext = path.extname(file.originalname);
        const filename = `${id}${ext}`;
        const filePath = path.join(uploadDir, filename);

        await fs.writeFile(filePath, file.buffer);

        const isImage = file.mimetype.startsWith('image/');
        return {
          id,
          type: isImage ? 'image' as const : 'file' as const,
          name: file.originalname,
          path: filePath,
        };
      }),
    );

    return { attachments };
  }
}
