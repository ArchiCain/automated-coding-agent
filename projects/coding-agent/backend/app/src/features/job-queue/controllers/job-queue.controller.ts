import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JobQueueService } from '../services/job-queue.service';
import { AutoDecompWorker } from '../workers/auto-decomp.worker';
import { CreateJobDto, Job, JobLogsResponse, JobStatus } from '../models/job.model';

@Controller('api/jobs')
export class JobQueueController {
  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly autoDecompWorker: AutoDecompWorker,
  ) {}

  @Get()
  getJobs(@Query('status') status?: JobStatus): { jobs: Job[] } {
    const filter = status ? { status } : undefined;
    return { jobs: this.jobQueueService.getJobs(filter) };
  }

  @Get(':id')
  getJob(@Param('id') id: string): Job {
    const job = this.jobQueueService.getJob(id);
    if (!job) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
    return job;
  }

  @Get(':id/logs')
  async getJobLogs(
    @Param('id') id: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ): Promise<JobLogsResponse> {
    try {
      return await this.jobQueueService.getJobLogs(
        id,
        offset ? parseInt(offset, 10) : 0,
        limit ? parseInt(limit, 10) : 100,
      );
    } catch (error) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }
  }

  @Post()
  async createJob(@Body() dto: CreateJobDto): Promise<{ job: Job }> {
    const job = await this.jobQueueService.createJob(dto.type, dto.payload);

    // Start the job asynchronously based on type
    if (dto.type === 'auto-decomp') {
      // Fire and forget - the worker handles its own lifecycle
      this.autoDecompWorker.execute(job.id).catch((error) => {
        // Error handling is done within the worker
        console.error('Auto-decomp worker error:', error);
      });
    }

    return { job };
  }

  @Delete(':id')
  async cancelJob(@Param('id') id: string): Promise<{ success: boolean }> {
    try {
      await this.jobQueueService.cancelJob(id);
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }
  }
}
