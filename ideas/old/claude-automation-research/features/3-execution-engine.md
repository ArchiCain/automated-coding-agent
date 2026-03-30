# Execution Engine Specification

The execution engine takes a decomposed task DAG and orchestrates parallel execution using Claude Code SDK sessions, managing dependencies, failures, and git commits.

## Core Responsibility

> Execute all tasks in a plan with maximum parallelism, respecting dependencies, and producing one atomic commit per completed task.

---

## Execution Model

### Principles

1. **Maximum Parallelism**: Run as many tasks concurrently as dependency graph allows
2. **Atomic Commits**: Each task completion = one git commit
3. **Fail Fast, Recover Smart**: Detect failures early, retry with context
4. **No Human Intervention**: Run until completion or unrecoverable failure
5. **Isolated Execution**: Each plan runs in its own git worktree

### Worker Pool

```
┌─────────────────────────────────────────────────────────────────┐
│                      EXECUTION ENGINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────────────────────────────┐   │
│  │   SCHEDULER  │───▶│           WORKER POOL                │   │
│  │              │    │  ┌────────┐ ┌────────┐ ┌────────┐    │   │
│  │  • DAG aware │    │  │Worker 1│ │Worker 2│ │Worker 3│    │   │
│  │  • Priority  │    │  │        │ │        │ │        │    │   │
│  │  • Load bal  │    │  │ Claude │ │ Claude │ │ Claude │    │   │
│  └──────────────┘    │  │  SDK   │ │  SDK   │ │  SDK   │    │   │
│         │            │  │Session │ │Session │ │Session │    │   │
│         │            │  └────────┘ └────────┘ └────────┘    │   │
│         ▼            └──────────────────────────────────────┘   │
│  ┌──────────────┐                      │                        │
│  │  TASK QUEUE  │                      │                        │
│  │              │                      ▼                        │
│  │ [t-abc][t-de]│    ┌──────────────────────────────────────┐   │
│  │ [t-fg][t-hi] │    │         GIT COORDINATOR              │   │
│  └──────────────┘    │  • Commit per task                   │   │
│                      │  • Conflict detection                │   │
│                      │  • Worktree management               │   │
│                      └──────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLAN READY FOR EXECUTION                     │
│  (All tasks decomposed, dependencies validated, human approved)  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    INITIALIZE EXECUTION                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Create git worktree for plan                                 │
│  • Create feature branch                                        │
│  • Load task DAG from tasks.jsonl                               │
│  • Initialize worker pool                                       │
│  • Set plan status: executing                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    IDENTIFY READY TASKS                          │
│  ─────────────────────────────────────────────────────────────  │
│  Ready = pending tasks where all dependencies are completed     │
│  • Filter: status == 'pending'                                  │
│  • Filter: all depends_on tasks have status == 'completed'      │
│  • Sort by: priority, then creation order                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │         Ready tasks?          │
              └───────────────┬───────────────┘
                    │                   │
                   Yes                  No
                    │                   │
                    ▼                   ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│   DISPATCH TO WORKERS   │   │    CHECK COMPLETION     │
│  ─────────────────────  │   │  ─────────────────────  │
│  • Assign tasks to      │   │  • All completed? Done  │
│    available workers    │   │  • Any failed? Handle   │
│  • Up to pool size      │   │  • Any blocked? Error   │
│  • Mark: in_progress    │   └───────────┬─────────────┘
└───────────┬─────────────┘               │
            │                             │
            ▼                             │
┌─────────────────────────────────────────┴────────────────────────┐
│                      WORKER EXECUTION                            │
│  ─────────────────────────────────────────────────────────────   │
│  Each worker independently:                                      │
│                                                                  │
│  1. CONTEXT BUILDING                                             │
│     • Load task details                                          │
│     • Gather file context (files_affected + dependencies)        │
│     • Load relevant patterns from memory                         │
│     • Build execution prompt                                     │
│                                                                  │
│  2. CLAUDE CODE SDK SESSION                                      │
│     • Start session with task prompt                             │
│     • Stream execution events                                    │
│     • Capture all file changes                                   │
│     • Capture test results                                       │
│                                                                  │
│  3. SELF-VERIFICATION                                            │
│     • Run task's test_approach                                   │
│     • Check acceptance_criteria                                  │
│     • If failed: retry with error context (up to max_retries)    │
│                                                                  │
│  4. COMPLETION                                                   │
│     • Stage changed files                                        │
│     • Create atomic commit                                       │
│     • Update task status                                         │
│     • Notify scheduler                                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Loop back to   │
                    │  IDENTIFY READY │
                    └─────────────────┘
```

---

## Core Components

### 1. Scheduler

Manages task dispatch based on DAG dependencies and worker availability.

```typescript
interface Scheduler {
  // State
  taskGraph: TaskDAG;
  readyQueue: PriorityQueue<Task>;
  inProgress: Map<string, WorkerAssignment>;
  completed: Set<string>;
  failed: Map<string, FailureRecord>;

  // Operations
  getReadyTasks(): Task[];
  assignTask(task: Task, worker: Worker): void;
  onTaskComplete(taskId: string, result: TaskResult): void;
  onTaskFailed(taskId: string, error: FailureRecord): void;
  canContinue(): boolean;
  getBlockedTasks(): Task[];
}

interface TaskDAG {
  tasks: Map<string, Task>;
  dependencies: Map<string, string[]>;  // taskId -> dependency taskIds
  dependents: Map<string, string[]>;    // taskId -> tasks that depend on it

  getExecutionLevels(): string[][];     // Parallel groups
  getCriticalPath(): string[];          // Longest chain
  getReadyTasks(completed: Set<string>): Task[];
}

interface WorkerAssignment {
  workerId: string;
  taskId: string;
  startedAt: Date;
  lastHeartbeat: Date;
}
```

**Scheduling Algorithm:**
```
function scheduleNext():
  ready = dag.getReadyTasks(completed)
  available = workers.filter(w => w.status == 'idle')

  for worker in available:
    if ready.isEmpty(): break

    task = ready.dequeue()  // Highest priority first
    worker.assign(task)
    inProgress.set(task.id, { worker, startedAt: now() })
    task.status = 'in_progress'
    emit('task:started', task)
```

---

### 2. Worker Pool

Manages a pool of Claude Code SDK sessions.

```typescript
interface WorkerPool {
  workers: Worker[];
  maxWorkers: number;

  initialize(): Promise<void>;
  getAvailableWorker(): Worker | null;
  releaseWorker(workerId: string): void;
  shutdown(): Promise<void>;
}

interface Worker {
  id: string;
  status: 'idle' | 'busy' | 'error';
  currentTask: string | null;
  session: ClaudeCodeSession | null;

  execute(task: Task, context: ExecutionContext): Promise<TaskResult>;
  abort(): Promise<void>;
}

interface ClaudeCodeSession {
  // Claude Code SDK session wrapper
  sessionId: string;
  workingDirectory: string;

  start(prompt: string): Promise<void>;
  streamEvents(): AsyncIterator<SessionEvent>;
  sendMessage(message: string): Promise<void>;
  stop(): Promise<void>;
}
```

**Worker Lifecycle:**
```
┌──────────┐     assign()     ┌──────────┐
│   IDLE   │─────────────────▶│   BUSY   │
└──────────┘                  └────┬─────┘
     ▲                             │
     │        complete/fail        │
     └─────────────────────────────┘
```

---

### 3. Task Executor

Handles individual task execution within a worker.

```typescript
interface TaskExecutor {
  execute(task: Task, context: ExecutionContext): Promise<TaskResult>;
}

interface ExecutionContext {
  plan: Plan;
  worktree: string;           // Path to git worktree
  branch: string;             // Feature branch name
  completedTasks: Task[];     // For context about what's done
  relevantFiles: FileContext[];
  patterns: Pattern[];
  maxRetries: number;
}

interface TaskResult {
  status: 'completed' | 'failed' | 'blocked';
  taskId: string;

  // On success
  filesChanged?: string[];
  commitHash?: string;
  testsPassed?: boolean;

  // On failure
  error?: {
    type: 'execution' | 'verification' | 'conflict' | 'timeout';
    message: string;
    attempts: number;
    lastOutput: string;
  };

  // Metrics
  duration: number;
  tokensUsed: number;
  retriesUsed: number;
}
```

**Execution Steps:**

```typescript
async function executeTask(task: Task, ctx: ExecutionContext): Promise<TaskResult> {
  const startTime = Date.now();
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < ctx.maxRetries) {
    attempts++;

    try {
      // 1. Build execution prompt
      const prompt = buildTaskPrompt(task, ctx, lastError);

      // 2. Start Claude Code session
      const session = await startClaudeSession(ctx.worktree);

      // 3. Execute with streaming
      const execution = await session.execute(prompt);

      // 4. Self-verification
      const verification = await verifySelf(task, execution, ctx);

      if (!verification.passed) {
        lastError = new Error(verification.reason);
        continue;  // Retry
      }

      // 5. Commit changes
      const commit = await commitTaskChanges(task, execution, ctx);

      return {
        status: 'completed',
        taskId: task.id,
        filesChanged: execution.filesChanged,
        commitHash: commit.hash,
        testsPassed: verification.testsPassed,
        duration: Date.now() - startTime,
        tokensUsed: execution.tokensUsed,
        retriesUsed: attempts - 1
      };

    } catch (error) {
      lastError = error;
      await logRetry(task, attempts, error);
    }
  }

  // Max retries exceeded
  return {
    status: 'failed',
    taskId: task.id,
    error: {
      type: classifyError(lastError),
      message: lastError.message,
      attempts,
      lastOutput: lastError.output || ''
    },
    duration: Date.now() - startTime
  };
}
```

---

### 4. Git Coordinator

Manages git operations for the execution.

```typescript
interface GitCoordinator {
  worktreePath: string;
  branchName: string;
  mainBranch: string;

  // Setup
  createWorktree(planId: string): Promise<string>;
  createBranch(planId: string): Promise<string>;

  // Per-task operations
  stageChanges(files: string[]): Promise<void>;
  commit(task: Task, message: string): Promise<CommitResult>;

  // Conflict handling
  detectConflicts(): Promise<ConflictInfo[]>;
  hasUncommittedChanges(): Promise<boolean>;

  // Cleanup (manual trigger)
  removeWorktree(): Promise<void>;
}

interface CommitResult {
  hash: string;
  branch: string;
  filesChanged: string[];
  insertions: number;
  deletions: number;
}

interface ConflictInfo {
  file: string;
  type: 'modify-modify' | 'delete-modify' | 'add-add';
  ourChange: string;
  theirChange: string;
}
```

**Commit Message Format:**
```
[task-id] Task title

Acceptance criteria:
- [x] Criterion 1
- [x] Criterion 2

Files changed:
- src/module/file.ts
- src/module/file.spec.ts

Plan: p-abc123
Task: t-def456
```

---

### 5. Event Emitter

Streams execution events for monitoring and logging.

```typescript
interface ExecutionEvents {
  // Plan level
  'plan:started': { planId: string; taskCount: number };
  'plan:completed': { planId: string; duration: number };
  'plan:failed': { planId: string; reason: string };

  // Task level
  'task:queued': { taskId: string; position: number };
  'task:started': { taskId: string; workerId: string };
  'task:progress': { taskId: string; message: string };
  'task:retrying': { taskId: string; attempt: number; reason: string };
  'task:completed': { taskId: string; commitHash: string };
  'task:failed': { taskId: string; error: string };

  // Worker level
  'worker:started': { workerId: string };
  'worker:idle': { workerId: string };
  'worker:error': { workerId: string; error: string };

  // Claude session level
  'session:started': { sessionId: string; taskId: string };
  'session:message': { sessionId: string; content: string };
  'session:tool_use': { sessionId: string; tool: string; input: any };
  'session:ended': { sessionId: string; tokensUsed: number };
}
```

---

## Task Prompt Template

```markdown
You are executing a specific implementation task as part of a larger plan.

## Task
**Title:** {{task.title}}
**ID:** {{task.id}}

## Description
{{task.description}}

## Acceptance Criteria
{{task.acceptance_criteria}}

## Test Approach
{{task.test_approach}}

## Files Likely Affected
{{#each task.files_affected}}
- {{this}}
{{/each}}

## Context

### Project Stack
{{project.stack | join(", ")}}

### Relevant Patterns
{{#each patterns}}
**{{this.name}}:** {{this.description}}
```{{this.language}}
{{this.example}}
```
{{/each}}

### Completed Tasks in This Plan
{{#each completedTasks}}
- [x] {{this.title}} ({{this.id}})
{{/each}}

### Relevant File Context
{{#each relevantFiles}}
**{{this.path}}**
```{{this.language}}
{{this.content}}
```
{{/each}}

{{#if previousAttempt}}
## Previous Attempt Failed
**Reason:** {{previousAttempt.reason}}
**Output:**
```
{{previousAttempt.output}}
```
Please address this issue in your implementation.
{{/if}}

## Instructions
1. Implement ONLY what is described in this task
2. Follow existing code patterns and conventions
3. Write tests as specified in the test approach
4. Do not modify files outside the scope of this task
5. Ensure all acceptance criteria are met before finishing

When complete, summarize what you implemented and confirm each acceptance criterion is met.
```

---

## Failure Handling

### Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: number;           // Default: 3
  backoffMs: number;            // Default: 1000
  backoffMultiplier: number;    // Default: 2
  maxBackoffMs: number;         // Default: 30000
}

function shouldRetry(error: TaskError, attempt: number, config: RetryConfig): boolean {
  if (attempt >= config.maxRetries) return false;

  // Always retry these
  if (error.type === 'timeout') return true;
  if (error.type === 'rate_limit') return true;

  // Retry execution errors (Claude might succeed on retry)
  if (error.type === 'execution') return true;

  // Retry verification failures (might be flaky test)
  if (error.type === 'verification' && attempt < 2) return true;

  // Don't retry conflicts (needs human intervention)
  if (error.type === 'conflict') return false;

  return false;
}
```

### Failure Modes

| Failure Type | Cause | Recovery |
|--------------|-------|----------|
| `execution` | Claude couldn't complete task | Retry with error context |
| `verification` | Tests failed | Retry with test output |
| `timeout` | Task took too long | Retry with smaller scope hint |
| `conflict` | Git merge conflict | Pause, flag for review |
| `blocked` | Dependency failed | Skip, mark blocked |
| `resource` | Out of tokens/rate limited | Wait and retry |

### Blocked Task Handling

When a task's dependency fails:

```typescript
function handleDependencyFailure(failedTask: Task, dag: TaskDAG): void {
  const dependents = dag.getDependents(failedTask.id);

  for (const taskId of dependents) {
    const task = dag.tasks.get(taskId);
    task.status = 'blocked';
    task.blocked_by = failedTask.id;

    emit('task:blocked', {
      taskId,
      blockedBy: failedTask.id,
      reason: `Dependency "${failedTask.title}" failed`
    });

    // Recursively block dependents of dependents
    handleDependencyFailure(task, dag);
  }
}
```

---

## Parallel Execution Strategy

### Execution Levels

Tasks are organized into levels based on dependencies:

```
Level 0: [t-1, t-2, t-3]     ← No dependencies, run in parallel
Level 1: [t-4, t-5]          ← Depend on Level 0 tasks
Level 2: [t-6]               ← Depends on Level 1 tasks
Level 3: [t-7, t-8]          ← Depends on Level 2 tasks
```

### Worker Allocation

```typescript
interface WorkerAllocationStrategy {
  // Simple: Fixed pool size
  fixed: {
    poolSize: number;  // e.g., 3 workers
  };

  // Dynamic: Scale based on ready tasks
  dynamic: {
    minWorkers: number;
    maxWorkers: number;
    scaleUpThreshold: number;   // Ready tasks per worker
    scaleDownDelay: number;     // Ms idle before scaling down
  };
}
```

### Conflict Prevention

When multiple tasks might modify the same file:

```typescript
interface ConflictPrevention {
  // Option 1: File locking (conservative)
  fileLocks: Map<string, string>;  // file -> taskId

  // Option 2: Dependency inference (proactive)
  inferFileDependencies(tasks: Task[]): void;

  // Option 3: Merge resolution (reactive)
  autoMergeStrategy: 'ours' | 'theirs' | 'manual';
}

// Prefer Option 2: Add implicit dependencies during planning
function addFileDependencies(tasks: Task[]): void {
  const fileToTask = new Map<string, string>();

  for (const task of topologicalSort(tasks)) {
    for (const file of task.files_affected) {
      const existing = fileToTask.get(file);
      if (existing && !task.depends_on.includes(existing)) {
        // Add implicit dependency
        task.depends_on.push(existing);
        log(`Added implicit dependency: ${task.id} -> ${existing} (both modify ${file})`);
      }
      fileToTask.set(file, task.id);
    }
  }
}
```

---

## State Management

### Plan State Machine

```
┌─────────┐   start()   ┌───────────┐   all done   ┌───────────┐
│ READY   │────────────▶│ EXECUTING │─────────────▶│ COMPLETED │
└─────────┘             └─────┬─────┘              └───────────┘
                              │
                              │ failure
                              ▼
                        ┌───────────┐   retry()   ┌───────────┐
                        │  FAILED   │────────────▶│ EXECUTING │
                        └───────────┘             └───────────┘
                              │
                              │ abort()
                              ▼
                        ┌───────────┐
                        │  ABORTED  │
                        └───────────┘
```

### Persistence

State is persisted to `.rtslabs/plans/{plan-id}/state.json`:

```json
{
  "plan_id": "p-abc123",
  "status": "executing",
  "started_at": "2024-01-15T10:30:00Z",
  "current_level": 1,
  "workers": [
    {
      "id": "w-1",
      "status": "busy",
      "current_task": "t-def456",
      "started_at": "2024-01-15T10:31:00Z"
    }
  ],
  "task_states": {
    "t-abc123": { "status": "completed", "commit": "a1b2c3d" },
    "t-def456": { "status": "in_progress", "attempt": 1 },
    "t-ghi789": { "status": "pending" }
  },
  "metrics": {
    "tasks_completed": 3,
    "tasks_failed": 0,
    "tasks_remaining": 5,
    "total_duration_ms": 45000
  }
}
```

### Resume After Crash

```typescript
async function resumeExecution(planId: string): Promise<void> {
  const state = await loadState(planId);

  if (state.status !== 'executing') {
    throw new Error(`Plan ${planId} is not in executing state`);
  }

  // Reset in_progress tasks to pending (they didn't complete)
  for (const [taskId, taskState] of Object.entries(state.task_states)) {
    if (taskState.status === 'in_progress') {
      taskState.status = 'pending';
      taskState.attempt = (taskState.attempt || 0) + 1;
    }
  }

  // Reinitialize workers
  await initializeWorkerPool();

  // Continue execution
  await executeFromState(state);
}
```

---

## Configuration

```json
// .rtslabs/config.json
{
  "execution": {
    "worker_pool_size": 3,
    "max_retries": 3,
    "task_timeout_ms": 300000,
    "retry_backoff_ms": 1000,
    "retry_backoff_multiplier": 2,
    "commit_per_task": true,
    "auto_verify": true,
    "pause_on_failure": false,
    "conflict_strategy": "add_dependency"
  }
}
```

---

## Integration Points

### With Decomposition Engine
- Receives: Validated task DAG in `tasks.jsonl`
- Expects: All tasks have `files_affected`, `acceptance_criteria`, `test_approach`

### With Verification System
- Calls: Self-verification after each task
- Calls: Quick verification periodically
- Calls: Phase gate verification between execution levels

### With Git Manager
- Uses: Worktree creation and management
- Uses: Branch creation and commit operations
- Uses: Conflict detection

### With Memory System
- Reads: Patterns and gotchas for execution context
- Writes: Execution outcomes for learning

### With Web UI
- Streams: All execution events
- Accepts: Pause/resume/abort commands
- Shows: Real-time progress visualization

---

## Metrics

```typescript
interface ExecutionMetrics {
  plan_id: string;

  // Timing
  total_duration_ms: number;
  avg_task_duration_ms: number;
  parallelism_efficiency: number;  // actual_time / sequential_time

  // Success rates
  tasks_total: number;
  tasks_completed: number;
  tasks_failed: number;
  tasks_blocked: number;
  first_try_success_rate: number;

  // Retries
  total_retries: number;
  retries_by_error_type: Record<string, number>;

  // Resources
  total_tokens_used: number;
  avg_tokens_per_task: number;

  // Git
  commits_created: number;
  files_changed: number;
  lines_added: number;
  lines_removed: number;
}
```

Use metrics to:
- Identify tasks that frequently fail (improve decomposition)
- Tune worker pool size for optimal parallelism
- Track token usage for cost optimization
- Measure overall execution efficiency
