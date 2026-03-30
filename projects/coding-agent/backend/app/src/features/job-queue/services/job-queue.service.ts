import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Job,
  JobIndex,
  JobProgress,
  JobStatus,
  JobType,
  AutoDecompPayload,
  JobLogsResponse,
} from '../models/job.model';

@Injectable()
export class JobQueueService implements OnModuleInit {
  private readonly logger = new Logger(JobQueueService.name);
  private jobs: Map<string, Job> = new Map();
  private jobsDir: string;
  private repoRoot: string;

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Navigate from dist/features/job-queue/services to repo root (8 levels up)
    // dist/features/job-queue/services -> dist/features/job-queue -> dist/features -> dist -> app -> backend -> coding-agent -> projects -> automated-repo
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
    this.jobsDir = path.join(this.repoRoot, '.coding-agent-data', 'backlog', '.jobs');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureJobsDir();
    await this.loadJobsFromDisk();
  }

  private async ensureJobsDir(): Promise<void> {
    try {
      await fs.mkdir(this.jobsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create jobs directory', error);
    }
  }

  async createJob(type: JobType, payload: AutoDecompPayload): Promise<Job> {
    const id = uuidv4().slice(0, 8);
    const now = new Date().toISOString();

    const job: Job = {
      id,
      type,
      status: 'pending',
      progress: {
        current: 0,
        total: 0,
        stage: 'initializing',
      },
      payload,
      logs: [],
      createdAt: now,
    };

    this.jobs.set(id, job);
    await this.persistJob(job);
    await this.updateJobIndex();

    this.eventEmitter.emit('job:created', { job });
    this.logger.log(`Created job ${id} for plan ${payload.planName}`);

    return job;
  }

  async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'running';
    job.startedAt = new Date().toISOString();

    await this.persistJob(job);
    await this.updateJobIndex();

    this.eventEmitter.emit('job:started', { job });
    this.logger.log(`Started job ${jobId}`);
  }

  async updateJobProgress(jobId: string, progress: JobProgress): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.progress = progress;
    await this.persistJob(job);

    this.eventEmitter.emit('job:progress', { jobId, progress });
  }

  async appendLog(jobId: string, line: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.logs.push(line);

    // Append to logs file for persistence
    const logsFile = path.join(this.jobsDir, jobId, 'logs.jsonl');
    await fs.appendFile(logsFile, JSON.stringify({ timestamp: new Date().toISOString(), line }) + '\n');

    this.eventEmitter.emit('job:log', { jobId, line });
  }

  async completeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.progress.stage = 'complete';

    await this.persistJob(job);
    await this.updateJobIndex();

    this.eventEmitter.emit('job:completed', { job });
    this.logger.log(`Completed job ${jobId}`);
  }

  async failJob(jobId: string, error: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    job.status = 'failed';
    job.error = error;
    job.completedAt = new Date().toISOString();

    await this.persistJob(job);
    await this.updateJobIndex();

    this.eventEmitter.emit('job:failed', { job, error });
    this.logger.error(`Failed job ${jobId}: ${error}`);
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'running' && job.status !== 'pending') {
      throw new Error(`Cannot cancel job ${jobId} with status ${job.status}`);
    }

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();

    await this.persistJob(job);
    await this.updateJobIndex();

    this.eventEmitter.emit('job:cancelled', { job });
    this.logger.log(`Cancelled job ${jobId}`);
  }

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getJobs(filter?: { status?: JobStatus }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }

    // Sort by createdAt descending (newest first)
    return jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getJobLogs(jobId: string, offset = 0, limit = 100): Promise<JobLogsResponse> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const total = job.logs.length;
    const logs = job.logs.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return { logs, total, hasMore };
  }

  private async persistJob(job: Job): Promise<void> {
    try {
      const jobDir = path.join(this.jobsDir, job.id);
      await fs.mkdir(jobDir, { recursive: true });

      const jobFile = path.join(jobDir, 'job.json');
      await fs.writeFile(jobFile, JSON.stringify(job, null, 2));
    } catch (error) {
      this.logger.error(`Failed to persist job ${job.id}`, error);
    }
  }

  private async updateJobIndex(): Promise<void> {
    try {
      const index: JobIndex[] = Array.from(this.jobs.values()).map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        createdAt: job.createdAt,
        planName: job.payload.planName,
      }));

      const indexFile = path.join(this.jobsDir, 'jobs.json');
      await fs.writeFile(indexFile, JSON.stringify(index, null, 2));
    } catch (error) {
      this.logger.error('Failed to update job index', error);
    }
  }

  private async loadJobsFromDisk(): Promise<void> {
    try {
      const entries = await fs.readdir(this.jobsDir, { withFileTypes: true });
      const jobDirs = entries.filter((e) => e.isDirectory());

      for (const dir of jobDirs) {
        const jobFile = path.join(this.jobsDir, dir.name, 'job.json');
        try {
          const content = await fs.readFile(jobFile, 'utf-8');
          const job: Job = JSON.parse(content);

          // Load logs from logs.jsonl if they exist
          const logsFile = path.join(this.jobsDir, dir.name, 'logs.jsonl');
          try {
            const logsContent = await fs.readFile(logsFile, 'utf-8');
            const logLines = logsContent
              .trim()
              .split('\n')
              .filter((l) => l)
              .map((l) => JSON.parse(l).line);
            job.logs = logLines;
          } catch {
            // No logs file or empty
          }

          this.jobs.set(job.id, job);
          this.logger.debug(`Loaded job ${job.id} from disk`);
        } catch (error) {
          this.logger.warn(`Failed to load job from ${dir.name}`, error);
        }
      }

      this.logger.log(`Loaded ${this.jobs.size} jobs from disk`);
    } catch (error) {
      // Jobs directory might not exist yet
      this.logger.debug('No existing jobs to load');
    }
  }
}
