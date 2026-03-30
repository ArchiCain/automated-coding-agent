import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  BrainstormingService,
  BrainstormingSession,
} from '../services/brainstorming.service';

interface CreateSessionDto {
  name: string;
}

interface UpdateSessionDto {
  name?: string;
}

interface LinkSessionDto {
  agentSessionId: string;
}

@Controller('api/brainstorming')
export class BrainstormingController {
  constructor(private readonly brainstormingService: BrainstormingService) {}

  /**
   * Get all brainstorming sessions
   */
  @Get('sessions')
  async listSessions(): Promise<{ sessions: BrainstormingSession[] }> {
    const sessions = await this.brainstormingService.listSessions();
    return { sessions };
  }

  /**
   * Create a new brainstorming session
   */
  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
  ): Promise<{ session: BrainstormingSession }> {
    // Name is optional - will default to "Untitled Session" if not provided
    const name = dto.name?.trim() || '';
    const session = await this.brainstormingService.createSession(name);
    return { session };
  }

  /**
   * Get a specific brainstorming session
   */
  @Get('sessions/:planId')
  async getSession(
    @Param('planId') planId: string,
  ): Promise<{ session: BrainstormingSession }> {
    const session = await this.brainstormingService.getSession(planId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return { session };
  }

  /**
   * Update a brainstorming session
   */
  @Patch('sessions/:planId')
  async updateSession(
    @Param('planId') planId: string,
    @Body() dto: UpdateSessionDto,
  ): Promise<{ session: BrainstormingSession }> {
    let session: BrainstormingSession | null = null;

    if (dto.name) {
      session = await this.brainstormingService.updateSessionName(
        planId,
        dto.name.trim(),
      );
    } else {
      session = await this.brainstormingService.getSession(planId);
    }

    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }

    return { session };
  }

  /**
   * Link a Claude Code agent session to a brainstorming session
   */
  @Post('sessions/:planId/link')
  async linkAgentSession(
    @Param('planId') planId: string,
    @Body() dto: LinkSessionDto,
  ): Promise<{ success: boolean }> {
    if (!dto.agentSessionId) {
      throw new HttpException(
        'Agent session ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.brainstormingService.linkAgentSession(
      planId,
      dto.agentSessionId,
    );
    return { success: true };
  }

  /**
   * Delete a brainstorming session
   */
  @Delete('sessions/:planId')
  async deleteSession(
    @Param('planId') planId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.brainstormingService.deleteSession(planId);
    if (!success) {
      throw new HttpException(
        'Failed to delete session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return { success };
  }

  /**
   * Get the prompt and context file paths for brainstorming
   */
  @Get('config')
  getConfig(): {
    promptFile: string;
    contextFiles: string[];
  } {
    return {
      promptFile: this.brainstormingService.getPromptFilePath(),
      contextFiles: this.brainstormingService.getContextFilePaths(),
    };
  }
}
