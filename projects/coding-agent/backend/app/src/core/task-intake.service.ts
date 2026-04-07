import { Injectable, Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { Task, CreateTaskInput } from './interfaces/task.interface';
import { AgentPoolService } from './agent-pool.service';
import { DevTeamConfigService } from '../config/dev-team-config.service';

const execFile = promisify(execFileCb);

@Injectable()
export class TaskIntakeService {
  private readonly logger = new Logger(TaskIntakeService.name);
  private readonly tasks = new Map<string, Task>();
  private readonly processedIssues = new Set<number>();

  constructor(
    private readonly agentPool: AgentPoolService,
    private readonly configService: DevTeamConfigService,
  ) {}

  async submitTask(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: uuidv4(),
      title: input.title,
      description: input.description,
      source: input.source,
      sourceRef: input.sourceRef,
      status: 'queued',
      priority: input.priority ?? 5,
      branch: input.branch ?? `task/${uuidv4().slice(0, 8)}`,
      touchesFrontend: input.touchesFrontend ?? false,
      parentTaskId: input.parentTaskId,
      dependencies: input.dependencies ?? [],
      retryBudget: this.configService.retryBudget,
      createdAt: new Date(),
      cost: 0,
    };

    this.tasks.set(task.id, task);
    this.logger.log(`Task submitted: ${task.id} — ${task.title}`);

    // Try to assign to an available agent slot
    this.agentPool.tryAssign(task);

    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;

    Object.assign(task, updates);
    return task;
  }

  deleteTask(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Poll GitHub issues labeled "the-dev-team" for new tasks.
   *
   * Uses the `gh` CLI (authenticated via GH_TOKEN set by GitHubTokenService)
   * to list open issues and creates tasks for any not already tracked.
   */
  async pollGitHubIssues(): Promise<void> {
    this.logger.debug('Polling GitHub issues for the-dev-team label');

    // Build the set of already-tracked issue sourceRefs for dedup
    const trackedRefs = new Set<string>();
    for (const task of this.tasks.values()) {
      if (task.source === 'github_issue' && task.sourceRef) {
        trackedRefs.add(task.sourceRef);
      }
    }

    let issues: GitHubIssue[];
    try {
      const { stdout } = await execFile(
        'gh',
        [
          'issue',
          'list',
          '--label',
          'the-dev-team',
          '--state',
          'open',
          '--json',
          'number,title,body,labels',
          '--limit',
          '50',
        ],
        {
          timeout: 30_000,
          maxBuffer: 1024 * 1024 * 5,
          env: { ...process.env },
        },
      );

      issues = JSON.parse(stdout) as GitHubIssue[];
    } catch (err) {
      const error = err as Error & { stderr?: string };
      const msg = error.stderr || error.message;

      // Graceful handling for common failure modes
      if (msg.includes('not found') || msg.includes('command not found')) {
        this.logger.warn('gh CLI not available — skipping GitHub issue polling');
        return;
      }
      if (msg.includes('auth') || msg.includes('token') || msg.includes('401')) {
        this.logger.warn(
          'GitHub authentication not configured — skipping issue polling',
        );
        return;
      }
      if (msg.includes('rate limit') || msg.includes('403')) {
        this.logger.warn('GitHub rate limit hit — will retry next poll cycle');
        return;
      }

      this.logger.error(`GitHub issue polling failed: ${msg}`);
      return;
    }

    let newTaskCount = 0;

    for (const issue of issues) {
      const issueRef = String(issue.number);

      // Skip already-tracked issues
      if (
        trackedRefs.has(issueRef) ||
        this.processedIssues.has(issue.number)
      ) {
        continue;
      }

      // Detect if this issue touches frontend based on labels
      const labelNames = (issue.labels || []).map((l) =>
        typeof l === 'string' ? l.toLowerCase() : (l.name || '').toLowerCase(),
      );
      const touchesFrontend = labelNames.some(
        (name) =>
          name === 'frontend' ||
          name === 'front-end' ||
          name.includes('frontend'),
      );

      try {
        await this.submitTask({
          title: issue.title,
          description: issue.body || '',
          source: 'github_issue',
          sourceRef: issueRef,
          touchesFrontend,
        });

        this.processedIssues.add(issue.number);
        newTaskCount++;

        this.logger.log(
          `Created task from GitHub issue #${issue.number}: ${issue.title}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to create task from issue #${issue.number}: ${(err as Error).message}`,
        );
      }
    }

    if (newTaskCount > 0) {
      this.logger.log(
        `GitHub poll complete: ${newTaskCount} new task(s) created from ${issues.length} open issue(s)`,
      );
    } else {
      this.logger.debug(
        `GitHub poll complete: no new issues (${issues.length} open, all already tracked)`,
      );
    }
  }
}

/** Shape returned by `gh issue list --json number,title,body,labels` */
interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: Array<string | { name: string }>;
}
