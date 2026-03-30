import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { JobQueueService } from '../services/job-queue.service';
import { Job, JobProgress } from '../models/job.model';
import { DecompositionService } from '../../claude-code-agent/services/decomposition.service';

interface DecompResult {
  success: boolean;
  createdTasks: string[]; // slugs of created tasks
  error?: string;
}

@Injectable()
export class AutoDecompWorker {
  private readonly logger = new Logger(AutoDecompWorker.name);
  private readonly repoRoot: string;
  private cancelledJobs: Set<string> = new Set();

  constructor(
    private readonly jobQueue: JobQueueService,
    private readonly decomposition: DecompositionService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');

    // Listen for job cancellation
    this.eventEmitter.on('job:cancelled', (payload: { job: Job }) => {
      this.cancelledJobs.add(payload.job.id);
    });
  }

  /**
   * Execute the auto-decomposition job
   */
  async execute(jobId: string): Promise<void> {
    const job = this.jobQueue.getJob(jobId);
    if (!job) {
      this.logger.error(`Job ${jobId} not found`);
      return;
    }

    try {
      await this.jobQueue.startJob(jobId);
      await this.jobQueue.appendLog(jobId, `Starting auto-decomposition for plan: ${job.payload.planName}`);

      const { planId } = job.payload;

      // Stage 1: Plan → Projects
      await this.updateProgress(jobId, { stage: 'projects', current: 0, total: 1, currentItem: 'Plan' });
      await this.jobQueue.appendLog(jobId, '\n=== Stage 1: Decomposing plan into projects ===\n');

      const projectResult = await this.runDecomposition(jobId, planId, 'plan-to-projects');

      if (!projectResult.success) {
        await this.jobQueue.failJob(jobId, `Plan decomposition failed: ${projectResult.error}`);
        return;
      }

      const projects = projectResult.createdTasks;
      await this.jobQueue.appendLog(jobId, `\nCreated ${projects.length} projects: ${projects.join(', ')}\n`);

      if (projects.length === 0) {
        await this.jobQueue.appendLog(jobId, 'No projects created. Completing job.');
        await this.jobQueue.completeJob(jobId);
        return;
      }

      // Stage 2: Projects → Features (in parallel, with per-project failure isolation)
      await this.updateProgress(jobId, { stage: 'features', current: 0, total: projects.length });
      await this.jobQueue.appendLog(jobId, '\n=== Stage 2: Decomposing projects into features ===\n');

      const featureResults = await Promise.allSettled(
        projects.map((projectSlug, index) =>
          this.decomposeProjectToFeatures(jobId, planId, projectSlug, index, projects.length),
        ),
      );

      // Collect all features from successful project decompositions
      const allFeatures: { planId: string; projectSlug: string; featureSlug: string }[] = [];
      for (let i = 0; i < featureResults.length; i++) {
        const result = featureResults[i];
        if (result.status === 'fulfilled' && result.value.success) {
          for (const featureSlug of result.value.createdTasks) {
            allFeatures.push({ planId, projectSlug: projects[i], featureSlug });
          }
        }
      }

      if (allFeatures.length === 0) {
        await this.jobQueue.appendLog(jobId, 'No features created. Completing job.');
        await this.jobQueue.completeJob(jobId);
        return;
      }

      // Stage 3: Features → Concerns (in parallel, with per-feature failure isolation)
      await this.updateProgress(jobId, { stage: 'concerns', current: 0, total: allFeatures.length });
      await this.jobQueue.appendLog(jobId, '\n=== Stage 3: Decomposing features into concerns ===\n');

      await Promise.allSettled(
        allFeatures.map((feature, index) =>
          this.decomposeFeatureToConcerns(
            jobId,
            feature.planId,
            feature.projectSlug,
            feature.featureSlug,
            index,
            allFeatures.length,
          ),
        ),
      );

      // Complete the job
      await this.jobQueue.appendLog(jobId, '\n=== Auto-decomposition complete ===\n');
      await this.jobQueue.completeJob(jobId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Auto-decomp job ${jobId} failed: ${errorMsg}`);
      await this.jobQueue.failJob(jobId, errorMsg);
    }
  }

  /**
   * Decompose a project into features
   */
  private async decomposeProjectToFeatures(
    jobId: string,
    planId: string,
    projectSlug: string,
    index: number,
    total: number,
  ): Promise<DecompResult> {
    if (this.isCancelled(jobId)) {
      return { success: false, createdTasks: [], error: 'Job cancelled' };
    }

    await this.jobQueue.appendLog(jobId, `\n--- Decomposing project: ${projectSlug} (${index + 1}/${total}) ---\n`);
    await this.updateProgress(jobId, {
      stage: 'features',
      current: index,
      total,
      currentItem: projectSlug,
    });

    const taskId = `${planId}/${projectSlug}`;
    const result = await this.runDecomposition(jobId, taskId, 'project-to-features');

    if (result.success) {
      await this.jobQueue.appendLog(
        jobId,
        `Created ${result.createdTasks.length} features for ${projectSlug}: ${result.createdTasks.join(', ')}\n`,
      );
    } else {
      await this.jobQueue.appendLog(jobId, `Failed to decompose ${projectSlug}: ${result.error}\n`);
    }

    return result;
  }

  /**
   * Decompose a feature into concerns
   */
  private async decomposeFeatureToConcerns(
    jobId: string,
    planId: string,
    projectSlug: string,
    featureSlug: string,
    index: number,
    total: number,
  ): Promise<DecompResult> {
    if (this.isCancelled(jobId)) {
      return { success: false, createdTasks: [], error: 'Job cancelled' };
    }

    const featurePath = `${projectSlug}/${featureSlug}`;
    await this.jobQueue.appendLog(jobId, `\n--- Decomposing feature: ${featurePath} (${index + 1}/${total}) ---\n`);
    await this.updateProgress(jobId, {
      stage: 'concerns',
      current: index,
      total,
      currentItem: featurePath,
    });

    const taskId = `${planId}/${projectSlug}/features/${featureSlug}`;
    const result = await this.runDecomposition(jobId, taskId, 'feature-to-concerns');

    if (result.success) {
      await this.jobQueue.appendLog(
        jobId,
        `Created ${result.createdTasks.length} concerns for ${featurePath}: ${result.createdTasks.join(', ')}\n`,
      );
    } else {
      await this.jobQueue.appendLog(jobId, `Failed to decompose ${featurePath}: ${result.error}\n`);
    }

    return result;
  }

  /**
   * Run a decomposition and return the created tasks
   */
  private async runDecomposition(
    jobId: string,
    taskId: string,
    decompType: string,
  ): Promise<DecompResult> {
    try {
      // Create the decomposition session
      let session;
      if (decompType === 'plan-to-projects') {
        session = await this.decomposition.createSession(taskId, decompType);
      } else {
        session = await this.decomposition.createSessionForTask(taskId, decompType);
      }

      const { agent, meta } = session;

      // Build the prompt with proper structure
      const prompt = await this.buildDecompPrompt(agent.documents, meta);

      // Execute the decomposition from repo root so agent can explore codebase
      const result = await this.executeDecomposition(jobId, this.repoRoot, prompt);

      // Parse created tasks from the output directory
      const createdTasks = await this.getCreatedTasks(meta.outputBase);

      return { success: result.success, createdTasks, error: result.error };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, createdTasks: [], error: errorMsg };
    }
  }

  /**
   * Build the decomposition prompt with proper structure
   */
  private async buildDecompPrompt(
    documents: Array<{ id: string; path: string; type: string }>,
    meta: { inputFile: string; outputBase: string; parentId: string; decompType: string },
  ): Promise<string> {
    const parts: string[] = [];

    // Read all document files
    for (const doc of documents) {
      try {
        const content = await fs.readFile(doc.path, 'utf-8');
        if (doc.type === 'prompt') {
          parts.unshift(content); // Main decomposition prompt goes first
        } else {
          parts.push(`\n---\n\n${content}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to read document ${doc.path}: ${error}`);
      }
    }

    // Add structured instructions at the end (this is what buildInitialPrompt does)
    const decompTypeName = this.getDecompTypeName(meta.decompType);
    const instructions = `
---

# Decomposition Session

Read the decomposition prompt and extra instructions above carefully.

## Session Context

- **Input file**: ${meta.inputFile}
- **Output base**: ${meta.outputBase}
- **Parent ID**: ${meta.parentId}
- **Decomposition type**: ${decompTypeName}

## Instructions

1. Read the input file to understand what needs to be decomposed
2. Follow the research phase from the decomposition prompt
3. Apply the split logic from the extra instructions
4. Create child task directories under the output base
5. Each child needs: plan.md (for projects/features) or task.md (for concerns) and status.json

## User's Input

Start the decomposition now. Create the task directories and files.
`;

    parts.push(instructions);

    return parts.join('\n');
  }

  /**
   * Get human-readable name for decomposition type
   */
  private getDecompTypeName(decompType: string): string {
    switch (decompType) {
      case 'plan-to-projects':
        return 'Plan to Projects';
      case 'project-to-features':
        return 'Project to Features';
      case 'feature-to-concerns':
        return 'Feature to Concerns';
      default:
        return decompType;
    }
  }

  /**
   * Execute the decomposition using Claude SDK
   */
  private async executeDecomposition(
    jobId: string,
    cwd: string,
    prompt: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const queryResult = query({
        prompt,
        options: {
          cwd,
          model: 'claude-opus-4-5-20251101',
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      for await (const message of queryResult) {
        if (this.isCancelled(jobId)) {
          return { success: false, error: 'Job cancelled' };
        }

        // Log the message
        const logLine = this.formatMessage(message);
        if (logLine) {
          await this.jobQueue.appendLog(jobId, logLine);
        }

        // Check for completion
        if (message.type === 'result') {
          if (message.subtype === 'success') {
            return { success: true };
          } else {
            return { success: false, error: `Result: ${message.subtype}` };
          }
        }
      }

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Format a message for logging
   */
  private formatMessage(message: any): string {
    if (message.type === 'assistant') {
      if (message.message?.content) {
        const content = message.message.content;
        if (Array.isArray(content)) {
          return content
            .map((block: any) => {
              if (block.type === 'text') return block.text;
              if (block.type === 'tool_use') return `[Tool: ${block.name}]`;
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }
        return String(content);
      }
    } else if (message.type === 'result') {
      return `[${message.subtype}]`;
    }
    return '';
  }

  /**
   * Get created tasks from the output directory
   */
  private async getCreatedTasks(outputDir: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      const tasks: string[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          // Check if it has a plan.md or task.md file
          const planMdPath = path.join(outputDir, entry.name, 'plan.md');
          const taskMdPath = path.join(outputDir, entry.name, 'task.md');
          try {
            await fs.access(planMdPath);
            tasks.push(entry.name);
          } catch {
            try {
              await fs.access(taskMdPath);
              tasks.push(entry.name);
            } catch {
              // No plan.md or task.md, not a valid task
            }
          }
        }
      }

      return tasks;
    } catch {
      return [];
    }
  }

  /**
   * Update job progress
   */
  private async updateProgress(jobId: string, progress: JobProgress): Promise<void> {
    await this.jobQueue.updateJobProgress(jobId, progress);
  }

  /**
   * Check if a job has been cancelled
   */
  private isCancelled(jobId: string): boolean {
    return this.cancelledJobs.has(jobId);
  }
}
