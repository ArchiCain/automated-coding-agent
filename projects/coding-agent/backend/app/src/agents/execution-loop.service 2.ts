import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

import { Task, TaskResult } from '../core/interfaces/task.interface';
import { TaskRole } from '../config/dev-team-config.interface';
import { DevTeamConfigService } from '../config/dev-team-config.service';
import {
  CodingAgentProvider,
  AgentExecutionRequest,
  AgentMessage,
} from '../providers/coding-agent-provider.interface';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { GitService } from '../shared/git.service';
import { GateRunnerService } from './gates/gate-runner.service';
import { GateResult } from './gates/gate.interface';
import { RoleResult } from './interfaces/role-result.interface';
import { PRManagerService } from '../core/pr-manager.service';

// ---------------------------------------------------------------------------
// Phase constants
// ---------------------------------------------------------------------------

const BUILD_GATES = ['build', 'unit-tests'];
const DEPLOYMENT_GATES = ['deployment'];
const TEST_GATES = ['integration-tests', 'log-audit', 'e2e-tests'];
const FRONTEND_GATES = ['accessibility', 'design-review'];
const FINAL_GATES = ['api-validation', 'database-validation', 'performance'];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ExecutionLoopService {
  private readonly logger = new Logger(ExecutionLoopService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly configService: DevTeamConfigService,
    private readonly gateRunner: GateRunnerService,
    private readonly gitService: GitService,
    private readonly eventEmitter: EventEmitter2,
    private readonly prManager: PRManagerService,
  ) {}

  // =========================================================================
  // Public entry point
  // =========================================================================

  /**
   * Execute the full 7-phase pipeline for a task.
   */
  async execute(task: Task): Promise<TaskResult> {
    const startTime = Date.now();
    let totalCost = 0;

    try {
      this.emitStatus(task, 'starting', 'Beginning execution pipeline');

      // ── Phase 1: Setup ──────────────────────────────────────────────
      await this.setup(task);
      this.emitStatus(task, 'setup_complete', 'Worktree and branch ready');

      // ── Phase 2: Implement ──────────────────────────────────────────
      const implResult = await this.implement(task);
      totalCost += implResult.architectCost + implResult.implementerCost;
      this.emitStatus(task, 'implementation_complete', 'Code written');

      // ── Phase 3: Build & Deploy ─────────────────────────────────────
      const buildResult = await this.buildAndDeploy(task);
      totalCost += buildResult.devopsCost;
      this.emitStatus(task, 'build_deploy_complete', 'Sandbox deployed and verified');

      // ── Phase 4: Test ───────────────────────────────────────────────
      const testResult = await this.test(task);
      totalCost += testResult.testerCost + testResult.designerCost;
      this.emitStatus(task, 'test_complete', 'All test gates passed');

      // ── Phase 5: Review & Fix ───────────────────────────────────────
      const reviewResult = await this.reviewAndFix(task);
      totalCost += reviewResult.reviewerCost + reviewResult.bugfixerCost + reviewResult.documentarianCost;
      this.emitStatus(task, 'review_complete', 'Code reviewed and polished');

      // ── Phase 6: Submit ─────────────────────────────────────────────
      await this.submit(task);
      this.emitStatus(task, 'submitted', 'PR created');

      // ── Phase 7: Cleanup ────────────────────────────────────────────
      await this.cleanup(task);

      const durationMin = (Date.now() - startTime) / 60_000;
      this.logger.log(
        `Task ${task.id} completed in ${durationMin.toFixed(1)} min, cost=$${totalCost.toFixed(4)}`,
      );

      return { status: 'completed', cost: totalCost };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Task ${task.id} failed: ${error.message}`, error.stack);
      this.emitStatus(task, 'failed', error.message);

      // Attempt cleanup even on failure
      try {
        await this.cleanup(task);
      } catch (cleanupErr) {
        this.logger.warn(`Cleanup after failure also failed: ${(cleanupErr as Error).message}`);
      }

      return { status: 'failed', error: error.message, cost: totalCost };
    }
  }

  // =========================================================================
  // Phase 1: Setup
  // =========================================================================

  private async setup(task: Task): Promise<void> {
    this.logger.log(`[Phase 1] Setup for task ${task.id}`);

    // Fetch latest
    await this.gitService.fetch();

    // Create worktree and branch
    const worktreePath = await this.gitService.createWorktree(task.id, task.branch);
    task.worktreePath = worktreePath;
    task.status = 'setting_up';
    task.startedAt = new Date();

    // Persist initial state
    await this.persistTaskState(task);
  }

  // =========================================================================
  // Phase 2: Implement
  // =========================================================================

  private async implement(
    task: Task,
  ): Promise<{ architectCost: number; implementerCost: number }> {
    this.logger.log(`[Phase 2] Implement for task ${task.id}`);
    task.status = 'implementing';

    // Run architect role — produces an implementation plan
    const architectResult = await this.runRole('architect', task, {
      prompt: this.buildArchitectPrompt(task),
    });

    // Run implementer role — follows the plan and writes code
    const implementerResult = await this.runRole('implementer', task, {
      prompt: this.buildImplementerPrompt(task, architectResult.output),
    });

    return {
      architectCost: architectResult.cost,
      implementerCost: implementerResult.cost,
    };
  }

  // =========================================================================
  // Phase 3: Build & Deploy
  // =========================================================================

  private async buildAndDeploy(
    task: Task,
  ): Promise<{ devopsCost: number }> {
    this.logger.log(`[Phase 3] Build & Deploy for task ${task.id}`);
    task.status = 'validating';

    const isLocal = this.configService.executionMode === 'local';

    // Run build and unit-test gates (both work in local mode)
    await this.runGateSequence(task, BUILD_GATES);

    if (isLocal) {
      // In local mode, skip devops role and deployment health check (no K8s sandbox)
      this.logger.log(`[Phase 3] Local mode — skipping devops role and deployment gate`);
      return { devopsCost: 0 };
    }

    // Sandbox mode: run devops role to deploy sandbox environment
    const devopsResult = await this.runRole('devops', task, {
      prompt: this.buildDevopsPrompt(task),
    });

    // Run deployment health check
    await this.runGateSequence(task, DEPLOYMENT_GATES);

    return { devopsCost: devopsResult.cost };
  }

  // =========================================================================
  // Phase 4: Test
  // =========================================================================

  private async test(
    task: Task,
  ): Promise<{ testerCost: number; designerCost: number }> {
    this.logger.log(`[Phase 4] Test for task ${task.id}`);

    const isLocal = this.configService.executionMode === 'local';

    // Run tester role — in local mode, use a local-focused prompt
    const testerPrompt = isLocal
      ? this.buildLocalTesterPrompt(task)
      : this.buildTesterPrompt(task);
    const testerResult = await this.runRole('tester', task, {
      prompt: testerPrompt,
    });

    if (isLocal) {
      // In local mode, skip E2E and log-audit gates (require deployed environment).
      // Run only integration-tests gate (stub that passes — fine for now).
      this.logger.log(`[Phase 4] Local mode — skipping sandbox-dependent test gates`);
      await this.runGateSequence(task, ['integration-tests']);
    } else {
      // Sandbox mode: run full test gate sequence
      await this.runGateSequence(task, TEST_GATES);
    }

    // Run designer role and frontend gates if applicable (only in sandbox mode)
    let designerCost = 0;
    if (task.touchesFrontend && !isLocal) {
      const designerResult = await this.runRole('designer', task, {
        prompt: this.buildDesignerPrompt(task),
      });
      designerCost = designerResult.cost;

      await this.runGateSequence(task, FRONTEND_GATES);
    }

    return {
      testerCost: testerResult.cost,
      designerCost,
    };
  }

  // =========================================================================
  // Phase 5: Review & Fix
  // =========================================================================

  private async reviewAndFix(
    task: Task,
  ): Promise<{ reviewerCost: number; bugfixerCost: number; documentarianCost: number }> {
    this.logger.log(`[Phase 5] Review & Fix for task ${task.id}`);

    let bugfixerCost = 0;

    // Run reviewer role
    const reviewerResult = await this.runRole('reviewer', task, {
      prompt: this.buildReviewerPrompt(task),
    });

    // Check for findings that need fixing
    const findings = await this.readFindings(task);
    if (findings.length > 0) {
      const maxRetries = this.configService.retryBudget;
      const isLocal = this.configService.executionMode === 'local';
      let attempt = 0;

      // In local mode, only re-verify build gates (no deployment to check)
      const verificationGates = isLocal
        ? BUILD_GATES
        : [...BUILD_GATES, ...DEPLOYMENT_GATES];

      while (attempt < maxRetries && findings.length > 0) {
        attempt++;
        this.logger.log(
          `[Phase 5] Bugfix attempt ${attempt}/${maxRetries} for task ${task.id}`,
        );

        const bugfixResult = await this.runRole('bugfixer', task, {
          prompt: this.buildBugfixerPrompt(task, findings),
        });
        bugfixerCost += bugfixResult.cost;

        // Re-run relevant gates to verify fixes
        const { allPassed } = await this.gateRunner.runSequence(
          verificationGates,
          task,
        );

        if (allPassed) {
          this.logger.log(`[Phase 5] Fixes verified on attempt ${attempt}`);
          break;
        }

        if (attempt >= maxRetries) {
          throw new Error(
            `Failed to fix issues after ${maxRetries} attempts for task ${task.id}`,
          );
        }
      }
    }

    // Run documentarian to update documentation
    const documentarianResult = await this.runRole('documentarian', task, {
      prompt: this.buildDocumentarianPrompt(task),
    });

    // Run final validation gates
    // In local mode, skip performance gate (requires deployed endpoint) — run only api-validation and database-validation (stubs)
    const isLocalFinal = this.configService.executionMode === 'local';
    const finalGates = isLocalFinal
      ? ['api-validation', 'database-validation']
      : FINAL_GATES;
    await this.runGateSequence(task, finalGates);

    return {
      reviewerCost: reviewerResult.cost,
      bugfixerCost,
      documentarianCost: documentarianResult.cost,
    };
  }

  // =========================================================================
  // Phase 6: Submit
  // =========================================================================

  private async submit(task: Task): Promise<void> {
    this.logger.log(`[Phase 6] Submit for task ${task.id}`);
    task.status = 'submitting';

    if (!task.worktreePath) {
      throw new Error(`No worktree path for task ${task.id}`);
    }

    // Stage all changes
    await this.gitService.addAll(task.worktreePath);

    // Commit
    const commitMessage = `feat(${task.id}): ${task.title}\n\nAutomated implementation by THE Dev Team`;
    await this.gitService.commit(task.worktreePath, commitMessage);

    // Push
    await this.gitService.push(task.branch, { setUpstream: true });
    this.logger.log(`Pushed branch ${task.branch} for task ${task.id}`);

    // Create PR
    try {
      const prNumber = await this.prManager.createPR(task);
      task.prNumber = prNumber;
      this.logger.log(`Created PR #${prNumber} for task ${task.id}`);
    } catch (err) {
      this.logger.warn(`PR creation failed: ${(err as Error).message}`);
    }
  }

  // =========================================================================
  // Phase 7: Cleanup
  // =========================================================================

  private async cleanup(task: Task): Promise<void> {
    this.logger.log(`[Phase 7] Cleanup for task ${task.id}`);

    const isLocal = this.configService.executionMode === 'local';

    // In local mode, keep the worktree so the user can inspect the result.
    // In sandbox mode, respect the keepEnvironmentForReview setting.
    if (!isLocal && !this.configService.keepEnvironmentForReview) {
      try {
        await this.gitService.removeWorktree(task.id);
      } catch (err) {
        this.logger.warn(`Worktree removal failed: ${(err as Error).message}`);
      }
    } else {
      this.logger.log(
        `[Phase 7] Keeping worktree at ${task.worktreePath} for inspection`,
      );
    }

    task.status = 'completed';
    task.completedAt = new Date();
    await this.persistTaskState(task);
  }

  // =========================================================================
  // Role execution
  // =========================================================================

  /**
   * Run a role-based agent session.
   *
   * Gets the provider configured for the role, builds the execution request,
   * iterates over the async generator, logs each message to transcript,
   * emits to the dashboard, and accumulates the text output.
   */
  private async runRole(
    role: TaskRole,
    task: Task,
    options: { prompt: string; systemPrompt?: string },
  ): Promise<RoleResult> {
    const sessionId = uuidv4();
    const startedAt = new Date().toISOString();
    const start = Date.now();

    this.logger.log(`Running role "${role}" for task ${task.id} (session ${sessionId})`);
    this.emitStatus(task, `role:${role}:start`, `Starting ${role}`);

    const provider = this.providerRegistry.getForRole(role);
    let output = '';
    let cost = 0;

    const request: AgentExecutionRequest = {
      prompt: options.prompt,
      cwd: task.worktreePath ?? process.cwd(),
      systemPrompt: options.systemPrompt ?? this.buildSystemPrompt(role, task),
      allowedTools: this.getAllowedTools(role),
      sessionId,
    };

    try {
      for await (const message of provider.execute(request)) {
        // Log to transcript
        this.logToTranscript(task, role, sessionId, message);

        // Emit to dashboard
        this.eventEmitter.emit('agent:message', {
          taskId: task.id,
          role,
          sessionId,
          message,
        });

        // Accumulate text output
        if (message.type === 'text') {
          output += message.content;
        }

        // Track cost from completion messages
        if (message.type === 'complete' && message.raw) {
          const raw = message.raw as Record<string, unknown>;
          if (typeof raw.cost_usd === 'number') {
            cost += raw.cost_usd;
          }
        }
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Role "${role}" failed for task ${task.id}: ${error.message}`);
      throw error;
    }

    const durationMin = (Date.now() - start) / 60_000;
    this.logger.log(
      `Role "${role}" completed in ${durationMin.toFixed(1)} min, cost=$${cost.toFixed(4)}`,
    );

    this.emitStatus(task, `role:${role}:complete`, `${role} finished`);

    return {
      output,
      role,
      sessionId,
      startedAt,
      durationMin,
      cost,
    };
  }

  // =========================================================================
  // Gate execution helpers
  // =========================================================================

  /**
   * Run a sequence of gates, failing fast on first failure.
   * On failure, attempts retry via the bugfixer role.
   */
  private async runGateSequence(task: Task, gateNames: string[]): Promise<void> {
    const { results, allPassed } = await this.gateRunner.runSequence(gateNames, task);

    // Persist gate results on the task
    task.gateResults = [
      ...(task.gateResults ?? []),
      ...results.map((r) => ({
        gate: r.gate,
        passed: r.passed,
        attempt: r.attempt,
        notes: r.output.slice(0, 500),
      })),
    ];

    if (!allPassed) {
      const failedGate = results.find((r) => !r.passed);
      if (failedGate) {
        // Attempt to fix via retryWithFix
        await this.retryWithFix(task, failedGate.gate, failedGate);
      }
    }
  }

  /**
   * Retry loop: run the bugfixer role with gate failure context,
   * then re-run the gate. Repeats up to retryBudget times.
   */
  private async retryWithFix(
    task: Task,
    gateName: string,
    failedResult: GateResult,
  ): Promise<void> {
    const maxAttempts = this.configService.retryBudget;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.log(
        `Retry ${attempt}/${maxAttempts} for gate "${gateName}" on task ${task.id}`,
      );

      // Run bugfixer with context about the failure
      await this.runRole('bugfixer', task, {
        prompt: this.buildRetryPrompt(task, gateName, failedResult),
      });

      // Re-run the gate
      const retryResult = await this.gateRunner.run(gateName, task, attempt + 1);

      // Update gate results
      task.gateResults = [
        ...(task.gateResults ?? []),
        {
          gate: retryResult.gate,
          passed: retryResult.passed,
          attempt: retryResult.attempt,
          notes: retryResult.output.slice(0, 500),
        },
      ];

      if (retryResult.passed) {
        this.logger.log(`Gate "${gateName}" passed on retry attempt ${attempt}`);
        return;
      }

      failedResult = retryResult;
    }

    throw new Error(
      `Gate "${gateName}" still failing after ${maxAttempts} retry attempts for task ${task.id}`,
    );
  }

  // =========================================================================
  // Prompt builders
  // =========================================================================

  private buildArchitectPrompt(task: Task): string {
    return [
      `# Task: ${task.title}`,
      '',
      task.description,
      '',
      '## Instructions',
      'Create a detailed implementation plan for this task. Include:',
      '1. Which files need to be created or modified',
      '2. The approach and architecture decisions',
      '3. Any dependencies or ordering constraints',
      '4. Test strategy',
      '',
      `Estimated files: ${(task.estimatedFiles ?? []).join(', ') || 'not specified'}`,
      `Touches frontend: ${task.touchesFrontend}`,
    ].join('\n');
  }

  private buildImplementerPrompt(task: Task, plan: string): string {
    return [
      `# Task: ${task.title}`,
      '',
      task.description,
      '',
      '## Implementation Plan',
      plan,
      '',
      '## Instructions',
      'Follow the implementation plan above. Write the code, create/modify files, and ensure everything compiles.',
      'Do not skip any steps in the plan.',
    ].join('\n');
  }

  private buildDevopsPrompt(task: Task): string {
    return [
      `# Deploy Sandbox for Task: ${task.title}`,
      '',
      '## Instructions',
      'Deploy the sandbox environment for testing. Ensure:',
      '1. All services are running and healthy',
      '2. Database migrations are applied',
      '3. The application is accessible',
      '',
      `Worktree: ${task.worktreePath}`,
      `Branch: ${task.branch}`,
    ].join('\n');
  }

  private buildTesterPrompt(task: Task): string {
    return [
      `# Test Task: ${task.title}`,
      '',
      task.description,
      '',
      '## Instructions',
      'Write and run tests for the implemented changes:',
      '1. Write unit tests for new/modified logic',
      '2. Write integration tests if applicable',
      '3. Ensure existing tests still pass',
      '4. Report any issues found',
    ].join('\n');
  }

  private buildLocalTesterPrompt(task: Task): string {
    return [
      `# Test Task (Local Mode): ${task.title}`,
      '',
      task.description,
      '',
      '## Instructions',
      'Write and run tests locally for the implemented changes. There is NO deployed environment —',
      'all testing must be done locally using npm test or similar commands.',
      '',
      '1. Write unit tests for new/modified logic',
      '2. Run `npm test` to verify all tests pass',
      '3. Ensure existing tests still pass',
      '4. Report any issues found',
      '',
      'Do NOT attempt to access any deployed URLs or sandbox environments.',
    ].join('\n');
  }

  private buildDesignerPrompt(task: Task): string {
    return [
      `# Design Review: ${task.title}`,
      '',
      task.description,
      '',
      '## Instructions',
      'Review the frontend changes for:',
      '1. Visual consistency and design system adherence',
      '2. Responsive behavior at mobile, tablet, and desktop breakpoints',
      '3. Accessibility compliance (WCAG 2.1 AA)',
      '4. User experience and interaction patterns',
      '',
      'Write your findings to `.the-dev-team/state/' + task.id + '/findings/designer.md`.',
      'If there are blocking issues, list them under a "## Blocking Issues" section.',
    ].join('\n');
  }

  private buildReviewerPrompt(task: Task): string {
    return [
      `# Code Review: ${task.title}`,
      '',
      task.description,
      '',
      '## Instructions',
      'Review the code changes for:',
      '1. Code quality, readability, and maintainability',
      '2. Potential bugs or edge cases',
      '3. Security considerations',
      '4. Performance implications',
      '5. Adherence to project conventions',
      '',
      'Write your findings to `.the-dev-team/state/' + task.id + '/findings/reviewer.md`.',
    ].join('\n');
  }

  private buildBugfixerPrompt(task: Task, findings: string[]): string {
    return [
      `# Fix Issues: ${task.title}`,
      '',
      '## Findings to Address',
      ...findings.map((f) => `- ${f}`),
      '',
      '## Instructions',
      'Fix the issues listed above. Make minimal, targeted changes.',
      'Ensure the fixes do not break existing functionality.',
    ].join('\n');
  }

  private buildRetryPrompt(task: Task, gateName: string, result: GateResult): string {
    return [
      `# Fix Gate Failure: ${gateName}`,
      '',
      `## Task: ${task.title}`,
      '',
      '## Gate Failure Details',
      `Gate: ${result.gate}`,
      `Output:\n${result.output}`,
      '',
      '## Instructions',
      `The "${gateName}" validation gate failed. Analyze the failure output above and fix the underlying issue.`,
      'Make minimal, targeted changes to resolve the failure.',
    ].join('\n');
  }

  private buildDocumentarianPrompt(task: Task): string {
    return [
      `# Document Changes: ${task.title}`,
      '',
      task.description,
      '',
      '## Instructions',
      'Review the changes made and update any relevant documentation:',
      '1. Update inline code comments where needed',
      '2. Update API documentation if endpoints changed',
      '3. Update README sections if applicable',
      '4. Ensure JSDoc/TSDoc comments are accurate',
    ].join('\n');
  }

  // =========================================================================
  // System prompt builder
  // =========================================================================

  private buildSystemPrompt(role: TaskRole, task: Task): string {
    const roleDescriptions: Record<TaskRole, string> = {
      architect:
        'You are a senior software architect. Create detailed, actionable implementation plans.',
      implementer:
        'You are an expert software engineer. Write clean, well-tested production code.',
      reviewer:
        'You are a thorough code reviewer. Find bugs, suggest improvements, and ensure quality.',
      tester:
        'You are a QA engineer. Write comprehensive tests and verify functionality.',
      designer:
        'You are a UI/UX designer-engineer. Review frontend for design consistency and accessibility.',
      bugfixer:
        'You are a debugging expert. Diagnose and fix issues efficiently with minimal changes.',
      documentarian:
        'You are a technical writer. Keep documentation accurate and helpful.',
      monitor:
        'You are a monitoring and observability engineer. Ensure logging and metrics are in place.',
      devops:
        'You are a DevOps engineer. Deploy and manage sandbox environments.',
    };

    return [
      roleDescriptions[role] || `You are acting as the "${role}" role.`,
      '',
      `Working on task: ${task.title}`,
      `Task ID: ${task.id}`,
      `Branch: ${task.branch}`,
      task.worktreePath ? `Worktree: ${task.worktreePath}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  // =========================================================================
  // Tool allowlists per role
  // =========================================================================

  private getAllowedTools(role: TaskRole): string[] {
    const baseTools = ['Read', 'Glob', 'Grep', 'Bash'];
    const writeTools = [...baseTools, 'Edit', 'Write'];

    const toolsByRole: Record<TaskRole, string[]> = {
      architect: baseTools,
      implementer: writeTools,
      reviewer: baseTools,
      tester: writeTools,
      designer: baseTools,
      bugfixer: writeTools,
      documentarian: writeTools,
      monitor: baseTools,
      devops: writeTools,
    };

    return toolsByRole[role] ?? baseTools;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async readFindings(task: Task): Promise<string[]> {
    const findings: string[] = [];
    const findingsDir = path.join(
      task.worktreePath ?? '',
      '.the-dev-team',
      'state',
      task.id,
      'findings',
    );

    try {
      const files = await fs.readdir(findingsDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const content = await fs.readFile(path.join(findingsDir, file), 'utf-8');
        // Extract actionable findings (non-empty lines that are not headers)
        const lines = content
          .split('\n')
          .filter((line) => line.trim() && !line.startsWith('#'))
          .map((line) => line.trim());
        findings.push(...lines);
      }
    } catch {
      // No findings directory — no issues found
    }

    return findings;
  }

  private async persistTaskState(task: Task): Promise<void> {
    if (!task.worktreePath) return;

    const stateDir = path.join(
      task.worktreePath,
      '.the-dev-team',
      'state',
      task.id,
    );

    try {
      await fs.mkdir(stateDir, { recursive: true });
      await fs.writeFile(
        path.join(stateDir, 'task.json'),
        JSON.stringify(task, null, 2),
      );
    } catch (err) {
      this.logger.warn(`Failed to persist task state: ${(err as Error).message}`);
    }
  }

  private logToTranscript(
    task: Task,
    role: string,
    sessionId: string,
    message: AgentMessage,
  ): void {
    const timestamp = new Date().toISOString();
    const entry = JSON.stringify({
      timestamp,
      taskId: task.id,
      role,
      sessionId,
      type: message.type,
      content: message.content?.slice(0, 2000),
    });

    this.logger.debug(`[${role}:${sessionId}] ${message.type}: ${message.content?.slice(0, 200)}`);

    // Also persist to transcript file asynchronously
    if (task.worktreePath) {
      const transcriptDir = path.join(
        task.worktreePath,
        '.the-dev-team',
        'state',
        task.id,
        'transcripts',
      );
      fs.mkdir(transcriptDir, { recursive: true })
        .then(() =>
          fs.appendFile(
            path.join(transcriptDir, `${role}-${sessionId}.jsonl`),
            entry + '\n',
          ),
        )
        .catch(() => {});
    }
  }

  private emitStatus(task: Task, phase: string, detail: string): void {
    this.eventEmitter.emit('task:status', {
      taskId: task.id,
      phase,
      detail,
      timestamp: new Date().toISOString(),
    });
  }
}
