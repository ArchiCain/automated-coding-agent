import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ExecutionService,
  ExecutionSession,
} from '../services/execution.service';

interface CreateSessionDto {
  planId: string;
  taskPath: string;
}

@Controller('api/execution')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  /**
   * Create a new execution session for a task
   */
  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
  ): Promise<{ session: ExecutionSession }> {
    if (!dto.planId) {
      throw new HttpException('Plan ID is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.taskPath) {
      throw new HttpException('Task path is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const session = await this.executionService.createSession(
        dto.planId,
        dto.taskPath,
      );
      return { session };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create execution session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific execution session (in-memory only)
   */
  @Get('sessions/:sessionId')
  getSession(
    @Param('sessionId') sessionId: string,
  ): { session: ExecutionSession | null } {
    const session = this.executionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return { session };
  }
}
