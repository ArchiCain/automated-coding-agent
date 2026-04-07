# 07 — Agent Execution Loop

## Goal

Implement the 8-step execution loop that every task runs through: Setup → Implement → Build+Deploy → Test → Review+Fix → Submit → Cleanup → Wait. This is the core runtime of THE Dev Team.

## Current State

The existing coding-agent backend has pieces of this loop scattered across services:

- `execution.service.ts` — Runs agent sessions via Claude Code SDK
- `decomposition.service.ts` (37KB) — Handles the architect/decomposition phase
- `environment.service.ts` (26KB) — Manages environments
- `review.service.ts` — Code review sessions
- `session.service.ts` (17KB) — Session state management
- `brainstorming.service.ts` — Ideation sessions

These need to be unified into a single, coherent execution loop with clear phase transitions.

## Target State

A single `ExecutionLoopService` orchestrates the full lifecycle of a task, dispatching work to role-specific providers and running validation gates between phases.

## Implementation Steps

### Step 1: Create the Execution Loop Service

Create `src/agents/execution-loop.service.ts`:

```typescript
@Injectable()
export class ExecutionLoopService {
  constructor(
    private registry: ProviderRegistryService,
    private skillLoader: SkillLoaderService,
    private envManager: EnvironmentManagerService,
    private sessionManager: SessionManagerService,
    private gateRunner: GateRunnerService,
    private stateService: TaskStateService,
    private findingsService: FindingsService,
    private prManager: PrManagerService,
    private gitService: GitService,
    private transcriptWriter: TranscriptWriterService,
    private config: DevTeamConfigService,
  ) {}

  async execute(task: Task): Promise<TaskResult> {
    try {
      // Phase 1: SETUP
      await this.setup(task);

      // Phase 2: IMPLEMENT (architect + implementer)
      await this.implement(task);

      // Phase 3: BUILD + DEPLOY
      await this.buildAndDeploy(task);

      // Phase 4: TEST (tester + designer)
      await this.test(task);

      // Phase 5: REVIEW + FIX
      await this.reviewAndFix(task);

      // Phase 6: SUBMIT
      await this.submit(task);

      // Phase 7: CLEANUP
      await this.cleanup(task);

      return { status: 'completed', cost: task.cost };
    } catch (error) {
      await this.handleFailure(task, error);
      return { status: 'failed', error: String(error), cost: task.cost };
    }
  }
}
```

### Step 2: Implement Phase 1 — Setup

```typescript
private async setup(task: Task): Promise<void> {
  await this.stateService.updateStatus(task.id, 'setting_up');

  // Fetch latest from remote
  await this.gitService.fetch();

  // Create worktree + branch
  const branchName = `the-dev-team/${task.source === 'ci_failure' ? 'fix' : 'feature'}/${task.id}`;
  const worktreePath = await this.gitService.createWorktree(task.id, branchName);
  task.branch = branchName;
  task.worktreePath = worktreePath;

  // Persist task state
  await this.stateService.save(task);

  this.transcriptWriter.logEvent(task.id, {
    type: 'setup_complete',
    branch: branchName,
    worktree: worktreePath,
  });
}
```

### Step 3: Implement Phase 2 — Implement

This phase runs two roles sequentially: architect (creates plan) then implementer (writes code).

```typescript
private async implement(task: Task): Promise<void> {
  await this.stateService.updateStatus(task.id, 'implementing');

  // Step 1: Architect creates the plan
  const architectResult = await this.runRole('architect', task, {
    prompt: `Analyze the codebase and create a detailed implementation plan for: ${task.description}`,
    skills: ['decompose'],
  });

  // Save the plan to state
  await this.stateService.savePlan(task.id, architectResult.output);

  // Step 2: Implementer follows the plan
  await this.runRole('implementer', task, {
    prompt: `Implement the following plan:\n\n${architectResult.output}\n\nOriginal task: ${task.description}`,
    skills: ['execute', 'database'],
  });
}
```

### Step 4: Implement Phase 3 — Build + Deploy

```typescript
private async buildAndDeploy(task: Task): Promise<void> {
  // Run build gate
  const buildResult = await this.gateRunner.run('build', task);
  if (!buildResult.passed) {
    // Retry: fix build issues and try again
    await this.retryWithFix(task, 'build', buildResult);
  }

  // Run unit test gate (pre-deploy, fast feedback)
  const unitResult = await this.gateRunner.run('unit-tests', task);
  if (!unitResult.passed) {
    await this.retryWithFix(task, 'unit-tests', unitResult);
  }

  // DevOps role: deploy sandbox environment
  await this.runRole('devops', task, {
    prompt: `Build Docker images from the worktree and deploy a sandbox environment for task ${task.id}. Use task env:build and task env:create commands.`,
    skills: ['infrastructure'],
  });

  // Run deployment gate
  const deployResult = await this.gateRunner.run('deployment', task);
  if (!deployResult.passed) {
    await this.retryWithFix(task, 'deployment', deployResult);
  }
}
```

### Step 5: Implement Phase 4 — Test

```typescript
private async test(task: Task): Promise<void> {
  await this.stateService.updateStatus(task.id, 'validating');

  // Tester: write and run tests against live environment
  await this.runRole('tester', task, {
    prompt: `Write unit and integration tests for: ${task.description}. Run integration tests against the live environment at env-${task.id}.`,
    skills: ['api-test'],
  });

  // Run test gates
  await this.runGateSequence(task, [
    'integration-tests',
    'log-audit',
    'api-validation',
    'database-validation',
  ]);

  // Designer: E2E tests + design review (if frontend changes)
  if (task.touchesFrontend) {
    await this.runRole('designer', task, {
      prompt: `Review the frontend implementation for: ${task.description}. Write Playwright E2E tests. Validate against the design system. Capture screenshots at all breakpoints.`,
      skills: ['design-review', 'e2e-test'],
    });

    await this.runGateSequence(task, [
      'e2e-tests',
      'accessibility',
      'design-review',
    ]);
  }

  // Performance check
  await this.gateRunner.run('performance', task);
}
```

### Step 6: Implement Phase 5 — Review + Fix

```typescript
private async reviewAndFix(task: Task): Promise<void> {
  // Reviewer checks the full changeset
  await this.runRole('reviewer', task, {
    prompt: `Review all changes for: ${task.description}. Check for bugs, security issues, adherence to project conventions. Write findings to .the-dev-team/state/${task.id}/findings/reviewer.md`,
    skills: ['execute'],
  });

  // If findings exist, run bugfixer loop
  let iterations = 0;
  const maxIterations = this.config.retryBudget;

  while (await this.findingsService.hasFindings(task.id) && iterations < maxIterations) {
    iterations++;

    await this.runRole('bugfixer', task, {
      prompt: `Read review findings at .the-dev-team/state/${task.id}/findings/ and fix all issues. Rebuild, redeploy, and verify the fixes.`,
      skills: ['execute', 'infrastructure'],
    });

    // Re-run reviewer to check fixes
    await this.runRole('reviewer', task, {
      prompt: `Re-review changes for: ${task.description}. Previous findings were addressed. Check if all issues are resolved.`,
      skills: ['execute'],
    });
  }

  if (await this.findingsService.hasFindings(task.id)) {
    throw new Error(`Review findings not resolved after ${maxIterations} iterations — escalating to human`);
  }

  // Documentation update
  await this.runRole('documentarian', task, {
    prompt: `Update documentation for the changes made in: ${task.description}`,
    skills: ['execute'],
  });
}
```

### Step 7: Implement Phase 6 — Submit

```typescript
private async submit(task: Task): Promise<void> {
  await this.stateService.updateStatus(task.id, 'submitting');

  // Commit and push
  await this.gitService.addAll(task.worktreePath!);
  await this.gitService.commit(task.worktreePath!, this.buildCommitMessage(task));
  await this.gitService.push(task.branch);

  // Create PR
  const prNumber = await this.prManager.createPR(task);
  task.prNumber = prNumber;

  await this.stateService.save(task);
  this.transcriptWriter.logEvent(task.id, {
    type: 'pr_created',
    prNumber,
  });
}
```

### Step 8: Implement Phase 7 — Cleanup

```typescript
private async cleanup(task: Task): Promise<void> {
  // Optionally keep environment alive for PR review
  if (!this.config.keepEnvironmentForReview) {
    await this.envManager.destroyEnvironment(task.id);
  }

  // Remove worktree
  await this.gitService.removeWorktree(task.id);

  // Mark complete
  await this.stateService.updateStatus(task.id, 'completed');

  // Generate task summary
  await this.taskSummaryService.generate(task);

  this.transcriptWriter.logEvent(task.id, {
    type: 'task_completed',
    duration: Date.now() - task.startedAt!.getTime(),
    cost: task.cost,
  });
}
```

### Step 9: Implement the `runRole` Helper

This is the core method that dispatches work to a specific role's provider:

```typescript
private async runRole(
  role: TaskRole,
  task: Task,
  options: { prompt: string; skills: string[] },
): Promise<RoleResult> {
  const provider = this.registry.getForRole(role);
  const systemPrompt = await this.skillLoader.buildSystemPrompt(role, {
    description: task.description,
    taskId: task.id,
    branch: task.branch,
    namespace: `env-${task.id}`,
  });

  const allowedTools = this.skillLoader.getToolsForRole(role);

  const sessionId = await this.sessionManager.createSession(task.id, role);
  let output = '';

  for await (const message of provider.execute({
    prompt: options.prompt,
    cwd: task.worktreePath!,
    systemPrompt,
    allowedTools,
  })) {
    // Log every message to transcript
    this.transcriptWriter.logMessage(task.id, role, message);

    // Accumulate text output
    if (message.type === 'text') {
      output += message.content;
    }

    // Emit to dashboard via WebSocket
    this.dashboardGateway.emitAgentProgress(task.id, role, message);

    // Track cost
    if (message.type === 'complete' && message.raw) {
      task.cost += this.calculateCost(message.raw);
    }
  }

  await this.sessionManager.completeSession(sessionId);
  return { output, role, sessionId };
}
```

### Step 10: Implement Gate Retry Logic

```typescript
private async retryWithFix(task: Task, gateName: string, result: GateResult): Promise<void> {
  let attempts = 1;
  const maxAttempts = this.config.retryBudget;

  while (!result.passed && attempts < maxAttempts) {
    attempts++;

    // Bugfixer reads the gate failure and fixes
    await this.runRole('bugfixer', task, {
      prompt: `The ${gateName} gate failed:\n\n${result.output}\n\nFix the issue, then rebuild and redeploy.`,
      skills: ['execute', 'infrastructure'],
    });

    // Re-run the gate
    result = await this.gateRunner.run(gateName, task);
    this.transcriptWriter.logEvent(task.id, {
      type: 'gate_result',
      gate: gateName,
      passed: result.passed,
      attempt: attempts,
    });
  }

  if (!result.passed) {
    throw new Error(`Gate '${gateName}' failed after ${maxAttempts} attempts — escalating`);
  }
}
```

### Step 11: Create Git Service

Create `src/shared/git.service.ts` that wraps git operations:

```typescript
@Injectable()
export class GitService {
  private repoPath = '/workspace/repo';
  private worktreesPath = '/workspace/worktrees';

  async fetch(): Promise<void> {
    await this.exec(`git -C ${this.repoPath} fetch origin`);
  }

  async createWorktree(taskId: string, branch: string): Promise<string> {
    const worktreePath = path.join(this.worktreesPath, taskId);
    await this.exec(`git -C ${this.repoPath} worktree add ${worktreePath} -b ${branch}`);
    return worktreePath;
  }

  async removeWorktree(taskId: string): Promise<void> {
    const worktreePath = path.join(this.worktreesPath, taskId);
    await this.exec(`git -C ${this.repoPath} worktree remove ${worktreePath}`);
  }

  async addAll(cwd: string): Promise<void> {
    await this.exec(`git -C ${cwd} add -A`);
  }

  async commit(cwd: string, message: string): Promise<void> {
    await this.exec(`git -C ${cwd} commit -m "${message}"`);
  }

  async push(branch: string): Promise<void> {
    await this.exec(`git push origin ${branch}`);
  }
}
```

## Verification

- [ ] Execution loop runs end-to-end for a simple task
- [ ] Each phase transitions correctly (setup → implement → build → test → review → submit → cleanup)
- [ ] Architect's plan is saved and passed to implementer
- [ ] Worktree is created and used correctly
- [ ] Environment is deployed and health-checked
- [ ] Validation gates run in correct order
- [ ] Failed gates trigger bugfixer with retry budget
- [ ] PR is created with structured description
- [ ] Cleanup removes worktree and (optionally) namespace
- [ ] Transcripts log every event
- [ ] Cost tracking accumulates across roles

## Open Questions

- **Sequential vs parallel phases:** The current loop is fully sequential. Some phases could run in parallel (e.g., tester and designer). But parallel execution adds complexity. Start sequential, optimize later.
- **Resume after crash:** If the orchestrator crashes mid-task, how does it resume? The session manager tracks state, but the execution loop needs checkpointing logic. Phase 1 can restart from the beginning; Phase 3+ should support resume.
- **Timeout per role:** Should each role invocation have a timeout? Claude Code sessions can run indefinitely. A 30-minute timeout per role seems reasonable.
