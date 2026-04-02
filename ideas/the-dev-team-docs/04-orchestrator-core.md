# 04 — Orchestrator Core

## Goal

Evolve `projects/coding-agent/backend/` into THE Dev Team orchestrator — the NestJS service that manages task intake, agent lifecycle, environment management, session tracking, and the overall execution pipeline.

## Current State

The coding-agent backend (`projects/coding-agent/backend/`) already has significant infrastructure:

**Existing NestJS modules** (in `src/features/`):
- `claude-code-agent/` — 28 TypeScript files, 3700+ LOC. Contains:
  - Controllers: agents, brainstorming, decomposition, environment, execution, filesystem, prompts, review
  - Services: agents, brainstorming, decomposition (37KB), environment (26KB), execution, prompts, review, session (17KB)
  - `base-agent.ts` — agent state abstractions (`AgentState`, `AgentActivity`, `AgentDocument`, `AgentSession`)
  - WebSocket gateways: session, environment
  - Providers: `claude-code.provider`, `opencode.provider`, `agent-provider-registry`
- `backlog/` — Plan CRUD from filesystem (`.coding-agent-data/backlog/`)
- `command-center/` — Git + Docker orchestration
- `job-queue/` — Background job processing with `AutoDecompWorker`
- `task-runner/` — Task CLI execution + WebSocket streaming
- `shared/claude-cli/` — Claude CLI wrapper service

**Entry point**: `src/main.ts` → `AppModule` imports ConfigModule, EventEmitterModule, CORS, Health, ClaudeCli, ClaudeCodeAgent, JobQueue, TaskRunner, CommandCenter, Projects.

**Key dependencies**: `@anthropic-ai/claude-agent-sdk`, `@anthropic-ai/claude-code`, `@nestjs/websockets`, `zod`.

## Target State

The orchestrator becomes THE Dev Team's brain with these core services:

```
src/
├── app.module.ts                    ← Root module
├── main.ts                          ← Bootstrap
├── core/
│   ├── orchestrator.module.ts       ← Core orchestration module
│   ├── task-intake.service.ts       ← Receives tasks from GitHub, manual, decomposition
│   ├── agent-pool.service.ts        ← Manages concurrent agent instances
│   ├── environment-manager.service.ts ← K8s namespace lifecycle
│   ├── session-manager.service.ts   ← Agent state, history, resume
│   ├── pr-manager.service.ts        ← PR creation, review feedback
│   └── scheduler.service.ts         ← Cron jobs (cleanup, CI monitoring)
├── agents/
│   ├── agent.module.ts
│   ├── execution-loop.service.ts    ← The 8-step agent loop
│   ├── role-dispatcher.service.ts   ← Dispatches work to roles
│   └── gate-runner.service.ts       ← Runs validation gates
├── providers/
│   ├── provider.module.ts
│   ├── coding-agent-provider.interface.ts
│   ├── claude-code.provider.ts
│   ├── opencode.provider.ts
│   └── provider-registry.service.ts
├── skills/
│   ├── skill-loader.service.ts      ← Loads skill markdown files
│   └── skills/                      ← Skill definitions (markdown)
├── history/
│   ├── history.module.ts
│   ├── transcript-writer.service.ts
│   ├── task-summary.service.ts
│   └── history-sync.service.ts
├── state/
│   ├── state.module.ts
│   ├── task-state.service.ts        ← .the-dev-team/state/{task-id}/
│   └── findings.service.ts          ← Inter-role findings
├── config/
│   ├── dev-team-config.service.ts   ← Loads the-dev-team.config.yml
│   └── dev-team-config.interface.ts ← TaskRoleConfig, ProviderConfig types
├── gateway/
│   ├── dashboard.gateway.ts         ← WebSocket for real-time dashboard
│   └── agent-stream.gateway.ts      ← Stream agent progress to UI
└── shared/
    ├── git.service.ts               ← Git operations (worktree, branch, push)
    ├── helm.service.ts              ← Helm operations via Taskfile
    ├── docker.service.ts            ← Docker build operations via Taskfile
    └── taskfile.service.ts          ← Generic task runner
```

## Implementation Steps

### Step 1: Define Core Interfaces

Create the TypeScript interfaces that define the orchestrator's domain model. These build on the existing `base-agent.ts` types.

Create `src/core/interfaces/`:

```typescript
// task.interface.ts
export interface Task {
  id: string;
  title: string;
  description: string;
  source: 'github_issue' | 'manual' | 'decomposition' | 'pr_feedback' | 'ci_failure';
  sourceRef?: string;           // Issue number, PR number, etc.
  status: TaskStatus;
  priority: number;
  branch: string;
  worktreePath?: string;
  namespace?: string;
  touchesFrontend: boolean;
  parentTaskId?: string;        // For decomposed subtasks
  dependencies: string[];       // Task IDs that must complete first
  retryBudget: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cost: number;
}

export type TaskStatus =
  | 'queued'
  | 'assigned'
  | 'setting_up'
  | 'implementing'
  | 'validating'
  | 'submitting'
  | 'completed'
  | 'failed'
  | 'escalated';
```

```typescript
// agent-slot.interface.ts
export interface AgentSlot {
  id: number;
  taskId?: string;
  status: 'idle' | 'active';
  worktreePath?: string;
  namespace?: string;
  currentRole?: string;
  startedAt?: Date;
}
```

### Step 2: Create Task Intake Service

Refactor the existing `backlog/` module into a proper task intake service.

The current `backlog.service.ts` reads plans from `.coding-agent-data/backlog/`. Evolve this to:
1. Read from `.the-dev-team/backlog/` (renamed data directory)
2. Accept tasks from GitHub issues (via webhook or polling)
3. Accept manual task submissions via REST API
4. Queue tasks and dispatch to the agent pool

```typescript
// src/core/task-intake.service.ts
@Injectable()
export class TaskIntakeService {
  constructor(
    private agentPool: AgentPoolService,
    private config: DevTeamConfigService,
  ) {}

  async submitTask(input: CreateTaskInput): Promise<Task> {
    const task = this.createTask(input);
    await this.persistTask(task);
    this.agentPool.tryAssign(task);
    return task;
  }

  async pollGitHubIssues(): Promise<void> {
    // Query GitHub API for issues labeled 'the-dev-team'
    // Create tasks for new issues
  }
}
```

### Step 3: Create Agent Pool Service

The existing `agents.service.ts` manages agent state. Evolve into a pool that manages concurrent agent slots:

```typescript
// src/core/agent-pool.service.ts
@Injectable()
export class AgentPoolService {
  private slots: AgentSlot[];

  constructor(config: DevTeamConfigService) {
    this.slots = Array.from({ length: config.maxConcurrentAgents }, (_, i) => ({
      id: i,
      status: 'idle',
    }));
  }

  tryAssign(task: Task): boolean {
    const slot = this.slots.find(s => s.status === 'idle');
    if (!slot) return false;
    slot.status = 'active';
    slot.taskId = task.id;
    this.executeTask(slot, task);  // Fire and forget — runs async
    return true;
  }

  private async executeTask(slot: AgentSlot, task: Task): Promise<void> {
    // Delegates to ExecutionLoopService
  }
}
```

### Step 4: Create Environment Manager Service

The existing `environment.service.ts` (26KB) manages dev environments. Refactor to use Taskfile commands for K8s namespace operations:

```typescript
// src/core/environment-manager.service.ts
@Injectable()
export class EnvironmentManagerService {
  constructor(private taskfile: TaskfileService) {}

  async createEnvironment(taskId: string, imageTag: string): Promise<void> {
    await this.taskfile.run('env:create', taskId);
  }

  async destroyEnvironment(taskId: string): Promise<void> {
    await this.taskfile.run('env:destroy', taskId);
  }

  async checkHealth(taskId: string): Promise<HealthResult> {
    const output = await this.taskfile.run('env:health', taskId);
    return this.parseHealthOutput(output);
  }

  async getLogs(taskId: string, service: string): Promise<string> {
    return this.taskfile.run('env:logs', `${taskId} ${service}`);
  }
}
```

### Step 5: Create Session Manager Service

The existing `session.service.ts` (17KB) tracks sessions. Refactor to support:
- Task-scoped sessions (one task, multiple role sessions)
- Session resume after crashes (via Claude Code SDK session resume)
- State persistence to `.the-dev-team/state/`

### Step 6: Migrate Data Directory

Rename the data directory:
```
.coding-agent-data/ → .the-dev-team/
```

New structure:
```
.the-dev-team/
├── backlog/           ← Task queue (from existing backlog)
├── state/             ← Per-task state files
│   └── {task-id}/
│       ├── status.json
│       ├── plan.md
│       ├── findings/
│       └── gate-results/
├── history/           ← Transcripts, summaries, orchestrator logs
│   ├── sessions/
│   ├── tasks/
│   ├── orchestrator/
│   └── index.jsonl
└── config/
    └── the-dev-team.config.yml
```

### Step 7: Create Scheduler Service

The existing `job-queue/` with `AutoDecompWorker` provides background job infrastructure. Extend with:
- Stale environment cleanup (cron every hour)
- GitHub issue polling (cron every 5 minutes)
- CI monitoring (cron every 5 minutes)
- History sync trigger (cron every 15 minutes)

### Step 8: Create Config Service

Create `src/config/dev-team-config.service.ts` that loads `the-dev-team.config.yml`:

```typescript
@Injectable()
export class DevTeamConfigService {
  private config: DevTeamConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  get maxConcurrentAgents(): number {
    return this.config.maxConcurrent ?? 4;
  }

  getProviderConfig(role: TaskRole): ProviderConfig {
    return this.config.roles[role] ?? this.config.default;
  }

  private loadConfig(): DevTeamConfig {
    const configPath = '.the-dev-team/config/the-dev-team.config.yml';
    // Load and validate YAML config
  }
}
```

### Step 9: Wire Up AppModule

Refactor `src/app.module.ts` to use the new module structure:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),      // @nestjs/schedule for cron
    OrchestratorModule,            // Core services
    AgentModule,                   // Execution loop, roles, gates
    ProviderModule,                // CodingAgentProvider implementations
    SkillModule,                   // Skill loader
    HistoryModule,                 // Transcripts, summaries
    StateModule,                   // Task state, findings
    HealthModule,                  // Health check
  ],
})
export class AppModule {}
```

### Step 10: Create REST API

Create controllers for the orchestrator:

```typescript
// src/core/orchestrator.controller.ts
@Controller('api/tasks')
export class TaskController {
  @Post()
  submitTask(@Body() input: CreateTaskInput) {}

  @Get()
  listTasks(@Query() filters: TaskFilters) {}

  @Get(':id')
  getTask(@Param('id') id: string) {}

  @Delete(':id')
  cancelTask(@Param('id') id: string) {}
}

@Controller('api/agents')
export class AgentController {
  @Get()
  listAgents() {}    // Returns all agent slots with status

  @Get(':id/stream')
  streamAgent(@Param('id') id: string) {}  // SSE stream
}

@Controller('api/environments')
export class EnvironmentController {
  @Get()
  listEnvironments() {}

  @Get(':taskId/health')
  checkHealth(@Param('taskId') taskId: string) {}

  @Delete(':taskId')
  destroyEnvironment(@Param('taskId') taskId: string) {}
}
```

## Verification

- [ ] Orchestrator starts and serves health endpoint
- [ ] Task can be submitted via REST API
- [ ] Task appears in task list
- [ ] Agent pool assigns task to an idle slot
- [ ] Config loads from YAML file
- [ ] WebSocket gateway connects and streams events
- [ ] Scheduler runs cron jobs at configured intervals

## Open Questions

- **How much of the existing code to keep vs rewrite?** The decomposition service (37KB) and environment service (26KB) have significant logic. Audit each to decide what ports cleanly to the new architecture vs what needs a rewrite.
- **Database or filesystem for task state?** The architecture doc says no database for the orchestrator. File-based state in `.the-dev-team/` is simple but concurrent access needs care (file locks or single-writer).
- **NestJS module boundaries:** The existing code has everything in `claude-code-agent/`. The new structure separates concerns into multiple modules. This is a significant refactor — do it incrementally or in one pass?
