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
  ReviewService,
  ReviewSession,
} from '../services/review.service';

interface CreateReviewSessionDto {
  planId: string;
  taskPath: string;
}

@Controller('api/review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * Create a new review session for a task
   */
  @Post('sessions')
  async createSession(
    @Body() dto: CreateReviewSessionDto,
  ): Promise<{ session: ReviewSession }> {
    if (!dto.planId) {
      throw new HttpException('Plan ID is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.taskPath) {
      throw new HttpException('Task path is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const session = await this.reviewService.createSession(
        dto.planId,
        dto.taskPath,
      );
      return { session };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create review session',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific review session (in-memory only)
   */
  @Get('sessions/:sessionId')
  getSession(
    @Param('sessionId') sessionId: string,
  ): { session: ReviewSession | null } {
    const session = this.reviewService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return { session };
  }
}
