# Web UI Specification

The Web UI provides a visual interface for human interaction during planning, real-time monitoring during execution, and review of completed work.

## Core Responsibility

> Enable humans to interact with the agent during planning, monitor autonomous execution in real-time, and review completed work before merging.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         WEB UI                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    FRONTEND (React)                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │  PLAN    │  │ EXECUTE  │  │  REVIEW  │  │  SETTINGS  │  │ │
│  │  │  VIEW    │  │   VIEW   │  │   VIEW   │  │    VIEW    │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              │ WebSocket + REST                  │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    BACKEND (NestJS)                         │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │ │
│  │  │   API    │  │ WEBSOCKET│  │  EVENT   │  │   STATE    │  │ │
│  │  │ GATEWAY  │  │ GATEWAY  │  │   BUS    │  │   SYNC     │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    CORE SERVICES                            │ │
│  │  Decomposition • Execution • Verification • Git • Memory   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Planning Phase

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLANNING FLOW                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. REQUEST INPUT                                                │
│  ─────────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  What would you like to build?                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ Add user authentication with email/password login,  │  │  │
│  │  │ JWT tokens, and password reset via email            │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [📎 Attach files] [🖼️ Add screenshot] [📄 Use template]  │  │
│  │                                                           │  │
│  │                              [Decompose →]                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. DECOMPOSITION PROGRESS                                       │
│  ─────────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔄 Analyzing project context...                          │  │
│  │  ✓ Loaded project configuration                           │  │
│  │  ✓ Identified tech stack: NestJS, TypeORM, PostgreSQL     │  │
│  │  🔄 Generating task breakdown...                          │  │
│  │  ████████████░░░░░░░░ 60%                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. TASK REVIEW                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📋 Task Breakdown (5 tasks)                              │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ 1. Create User entity and migration     [Moderate]  │  │  │
│  │  │    └─ Files: user.entity.ts, migration              │  │  │
│  │  │    └─ Depends on: None                              │  │  │
│  │  │    [Edit] [Decompose ↓] [Delete]                    │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │ 2. Implement AuthService with JWT       [Moderate]  │  │  │
│  │  │    └─ Files: auth.service.ts, jwt.strategy.ts       │  │  │
│  │  │    └─ Depends on: Task 1                            │  │  │
│  │  │    [Edit] [Decompose ↓] [Delete]                    │  │  │
│  │  ├─────────────────────────────────────────────────────┤  │  │
│  │  │ 3. Create AuthController endpoints      [Simple]    │  │  │
│  │  │    ...                                              │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  [+ Add Task]                                             │  │
│  │                                                           │  │
│  │  ────────────────────────────────────────────────────    │  │
│  │  Dependency Graph:                                        │  │
│  │  ┌───┐     ┌───┐     ┌───┐                               │  │
│  │  │ 1 │────▶│ 2 │────▶│ 3 │                               │  │
│  │  └───┘     └─┬─┘     └───┘                               │  │
│  │              │       ┌───┐                                │  │
│  │              └──────▶│ 4 │────▶ ...                       │  │
│  │                      └───┘                                │  │
│  │                                                           │  │
│  │  [← Back]            [Start Execution →]                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 2: Execution Phase

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXECUTION VIEW                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  📊 Plan: Add User Authentication                                │
│  Status: Executing • 2/5 tasks complete • ~15 min remaining     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────┬───────────────────────────────┐│
│  │      TASK PROGRESS          │       LIVE OUTPUT             ││
│  │                             │                               ││
│  │  ✅ Task 1: User entity     │  Worker 1: Task 2             ││
│  │     └─ Commit: a1b2c3d      │  ─────────────────────────    ││
│  │                             │  Creating auth.service.ts...  ││
│  │  🔄 Task 2: AuthService     │                               ││
│  │     └─ Worker 1 • 45s       │  ```typescript                ││
│  │     └─ Attempt 1/3          │  @Injectable()                ││
│  │                             │  export class AuthService {   ││
│  │  🔄 Task 4: Email service   │    constructor(              ││
│  │     └─ Worker 2 • 30s       │      private userService...   ││
│  │                             │  ```                          ││
│  │  ⏳ Task 3: AuthController  │                               ││
│  │     └─ Waiting on Task 2    │  ─────────────────────────    ││
│  │                             │  Worker 2: Task 4             ││
│  │  ⏳ Task 5: Password reset  │  Running npm install...       ││
│  │     └─ Waiting on Task 4    │                               ││
│  │                             │                               ││
│  └─────────────────────────────┴───────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  🚨 Red Flags (1)                                           ││
│  │  ⚠️ Low confidence on Task 2 (0.68) - flagged for review    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [Pause] [View Logs] [View Git History]                         │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 3: Review Phase

```
┌─────────────────────────────────────────────────────────────────┐
│                     REVIEW VIEW                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ✅ Plan Complete: Add User Authentication                       │
│  Branch: plan/p-abc123/2024-01-15 • 5 commits                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📝 SUMMARY                                                 ││
│  │                                                             ││
│  │  Added complete user authentication system including:       ││
│  │  • User entity with password hashing                        ││
│  │  • JWT-based authentication with refresh tokens             ││
│  │  • Login, register, and logout endpoints                    ││
│  │  • Password reset via email                                 ││
│  │                                                             ││
│  │  **Files Changed:** 12 (+486/-23)                           ││
│  │  **Tests:** 24 passing, 0 failing                           ││
│  │  **Coverage:** 87% (+12%)                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ⚠️ REVIEW POINTS (2)                                       ││
│  │                                                             ││
│  │  🔴 High: JWT secret hardcoded in auth.service.ts:45        ││
│  │     └─ Recommendation: Move to environment variable         ││
│  │     └─ [View Code] [Create Fix Task]                        ││
│  │                                                             ││
│  │  🟡 Medium: No rate limiting on login endpoint              ││
│  │     └─ Consider adding to prevent brute force               ││
│  │     └─ [View Code] [Create Fix Task]                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  📁 COMMITS                                                 ││
│  │                                                             ││
│  │  a1b2c3d [t-001] Create User entity and migration           ││
│  │  b2c3d4e [t-002] Implement AuthService with JWT             ││
│  │  c3d4e5f [t-003] Create AuthController endpoints            ││
│  │  d4e5f6g [t-004] Add email service for password reset       ││
│  │  e5f6g7h [t-005] Implement password reset flow              ││
│  │                                                             ││
│  │  [View Full Diff] [View in VS Code]                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  [← Run More Tasks]   [Push to Remote]   [Create PR →]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pages & Components

### 1. Dashboard

Main landing page showing active plans and project overview.

```typescript
interface DashboardPage {
  // Project overview
  project: {
    name: string;
    stack: string[];
    last_analyzed: Date;
  };

  // Active plans
  active_plans: PlanSummary[];

  // Recent activity
  recent_activity: ActivityItem[];

  // Quick stats
  stats: {
    plans_completed: number;
    tasks_executed: number;
    success_rate: number;
    tokens_used_today: number;
  };

  // Quick actions
  actions: ['new_plan', 'analyze_project', 'view_memory'];
}

interface PlanSummary {
  id: string;
  title: string;
  status: PlanStatus;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  started_at: Date;
  branch: string;
}
```

### 2. Plan Creation

Multi-step wizard for creating new plans.

```typescript
interface PlanCreationWizard {
  steps: [
    'input',        // Request input
    'template',     // Template selection (optional)
    'decompose',    // AI decomposition
    'review',       // Human review
    'confirm'       // Final confirmation
  ];

  // Step 1: Input
  input: {
    description: string;
    attachments: Attachment[];
    template_id?: string;
  };

  // Step 2: Template
  template: {
    suggested: Template[];
    selected?: Template;
    variables?: Record<string, string>;
  };

  // Step 3: Decompose
  decomposition: {
    status: 'pending' | 'in_progress' | 'complete' | 'error';
    progress: number;
    tasks?: Task[];
    clarifications?: Clarification[];
  };

  // Step 4: Review
  review: {
    tasks: EditableTask[];
    dependency_graph: Graph;
    validation: ValidationResult;
  };
}
```

### 3. Task Editor

Component for editing individual tasks.

```typescript
interface TaskEditorProps {
  task: Task;
  siblings: Task[];  // For dependency selection
  onSave: (task: Task) => void;
  onDecompose: () => void;
  onDelete: () => void;
}

interface EditableTask extends Task {
  // Editable fields
  title: string;
  description: string;
  acceptance_criteria: string;
  complexity: Complexity;
  depends_on: string[];
  files_affected: string[];
  test_approach: string;

  // UI state
  expanded: boolean;
  validation_errors: string[];
}
```

### 4. Execution Monitor

Real-time execution monitoring view.

```typescript
interface ExecutionMonitor {
  plan: Plan;
  state: ExecutionState;

  // Task tracking
  tasks: {
    completed: TaskWithResult[];
    in_progress: TaskInProgress[];
    pending: Task[];
    blocked: BlockedTask[];
    failed: FailedTask[];
  };

  // Worker status
  workers: WorkerStatus[];

  // Live output
  output_streams: Map<string, OutputLine[]>;

  // Events
  events: ExecutionEvent[];

  // Red flags
  red_flags: RedFlag[];

  // Controls
  controls: {
    canPause: boolean;
    canResume: boolean;
    canAbort: boolean;
  };
}

interface TaskInProgress {
  task: Task;
  worker_id: string;
  started_at: Date;
  elapsed_seconds: number;
  attempt: number;
  current_output: string;
}

interface OutputLine {
  timestamp: Date;
  worker_id: string;
  task_id: string;
  type: 'stdout' | 'stderr' | 'info' | 'error';
  content: string;
}
```

### 5. Review Panel

Final review interface.

```typescript
interface ReviewPanel {
  plan: Plan;
  final_review: FinalReview;

  // Summary
  summary: {
    description: string;
    key_changes: string[];
    stats: {
      files_changed: number;
      lines_added: number;
      lines_removed: number;
      tests_passing: number;
      coverage: number;
    };
  };

  // Review points
  review_points: ReviewPoint[];

  // Commits
  commits: CommitInfo[];

  // Diff viewer
  diff: {
    files: FileDiff[];
    selected_file?: string;
  };

  // Actions
  actions: {
    create_fix_task: (point: ReviewPoint) => void;
    push_to_remote: () => void;
    create_pr: () => void;
    merge_to_main: () => void;
  };
}

interface ReviewPoint {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: 'security' | 'performance' | 'style' | 'bug' | 'suggestion';
  title: string;
  description: string;
  file: string;
  line?: number;
  code_snippet?: string;
  recommendation: string;
  auto_fixable: boolean;
}
```

### 6. Settings Page

Configuration interface.

```typescript
interface SettingsPage {
  sections: [
    'general',
    'llm',
    'git',
    'execution',
    'verification',
    'memory'
  ];

  // General
  general: {
    project_path: string;
    plan_directory: string;
  };

  // LLM settings
  llm: {
    provider: string;
    api_key: string;  // Masked
    default_model: string;
    budget: BudgetSettings;
  };

  // Git settings
  git: {
    default_branch: string;
    commit_format: string;
    auto_push: boolean;
  };

  // ... other sections
}
```

---

## Real-time Communication

### WebSocket Events

```typescript
// Client → Server
interface ClientEvents {
  // Plan management
  'plan:create': { description: string; attachments?: string[] };
  'plan:start': { plan_id: string };
  'plan:pause': { plan_id: string };
  'plan:resume': { plan_id: string };
  'plan:abort': { plan_id: string };

  // Task management
  'task:update': { task_id: string; updates: Partial<Task> };
  'task:decompose': { task_id: string };
  'task:delete': { task_id: string };
  'task:add': { plan_id: string; task: Partial<Task> };

  // Subscriptions
  'subscribe:plan': { plan_id: string };
  'subscribe:execution': { plan_id: string };
  'unsubscribe': { channel: string };
}

// Server → Client
interface ServerEvents {
  // Connection
  'connected': { session_id: string };
  'error': { code: string; message: string };

  // Plan events
  'plan:created': { plan: Plan };
  'plan:updated': { plan_id: string; updates: Partial<Plan> };
  'plan:status_changed': { plan_id: string; status: PlanStatus };

  // Decomposition events
  'decomposition:started': { plan_id: string };
  'decomposition:progress': { plan_id: string; progress: number; message: string };
  'decomposition:complete': { plan_id: string; tasks: Task[] };
  'decomposition:clarification': { plan_id: string; questions: Question[] };
  'decomposition:error': { plan_id: string; error: string };

  // Execution events
  'execution:started': { plan_id: string };
  'execution:task_started': { plan_id: string; task_id: string; worker_id: string };
  'execution:task_progress': { plan_id: string; task_id: string; message: string };
  'execution:task_output': { plan_id: string; task_id: string; output: OutputLine };
  'execution:task_completed': { plan_id: string; task_id: string; result: TaskResult };
  'execution:task_failed': { plan_id: string; task_id: string; error: string };
  'execution:verification': { plan_id: string; verification: VerificationResult };
  'execution:red_flag': { plan_id: string; red_flag: RedFlag };
  'execution:complete': { plan_id: string; final_review: FinalReview };
  'execution:paused': { plan_id: string };
  'execution:resumed': { plan_id: string };
  'execution:aborted': { plan_id: string };

  // Worker events
  'worker:started': { worker_id: string };
  'worker:idle': { worker_id: string };
  'worker:busy': { worker_id: string; task_id: string };
}
```

### WebSocket Gateway (NestJS)

```typescript
@WebSocketGateway({ cors: true })
export class PlanGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private planService: PlanService,
    private executionService: ExecutionService
  ) {}

  @SubscribeMessage('plan:create')
  async handleCreate(
    @MessageBody() data: CreatePlanDto,
    @ConnectedSocket() client: Socket
  ) {
    const plan = await this.planService.create(data);

    // Start decomposition
    this.decompose(plan.id, client);

    return { plan };
  }

  @SubscribeMessage('plan:start')
  async handleStart(
    @MessageBody() data: { plan_id: string },
    @ConnectedSocket() client: Socket
  ) {
    const plan = await this.planService.get(data.plan_id);

    // Subscribe client to execution updates
    client.join(`execution:${plan.id}`);

    // Start execution
    await this.executionService.start(plan.id);

    return { status: 'started' };
  }

  @SubscribeMessage('subscribe:execution')
  handleSubscribe(
    @MessageBody() data: { plan_id: string },
    @ConnectedSocket() client: Socket
  ) {
    client.join(`execution:${data.plan_id}`);
    return { subscribed: true };
  }

  // Emit execution events to subscribed clients
  emitExecutionEvent(planId: string, event: string, data: any) {
    this.server.to(`execution:${planId}`).emit(event, { plan_id: planId, ...data });
  }
}
```

---

## REST API Endpoints

```typescript
// Plans
GET    /api/plans                    // List all plans
POST   /api/plans                    // Create new plan
GET    /api/plans/:id                // Get plan details
PUT    /api/plans/:id                // Update plan
DELETE /api/plans/:id                // Delete plan
POST   /api/plans/:id/start          // Start execution
POST   /api/plans/:id/pause          // Pause execution
POST   /api/plans/:id/resume         // Resume execution
POST   /api/plans/:id/abort          // Abort execution

// Tasks
GET    /api/plans/:id/tasks          // List plan tasks
POST   /api/plans/:id/tasks          // Add task
PUT    /api/tasks/:id                // Update task
DELETE /api/tasks/:id                // Delete task
POST   /api/tasks/:id/decompose      // Decompose task

// Execution
GET    /api/plans/:id/execution      // Get execution state
GET    /api/plans/:id/workers        // Get worker status
GET    /api/plans/:id/logs           // Get execution logs
GET    /api/plans/:id/events         // Get execution events

// Review
GET    /api/plans/:id/review         // Get final review
GET    /api/plans/:id/diff           // Get full diff
POST   /api/plans/:id/fix-task       // Create fix task from review point

// Git
GET    /api/plans/:id/commits        // Get commit history
POST   /api/plans/:id/push           // Push to remote
POST   /api/plans/:id/pr             // Create pull request

// Project
GET    /api/project                  // Get project info
GET    /api/project/analysis         // Get project analysis
POST   /api/project/analyze          // Trigger analysis

// Memory
GET    /api/memory/patterns          // List patterns
GET    /api/memory/gotchas           // List gotchas
GET    /api/memory/stats             // Get memory stats

// Usage
GET    /api/usage                    // Get usage stats
GET    /api/usage/budget             // Get budget status

// Templates
GET    /api/templates                // List templates
GET    /api/templates/:id            // Get template
```

---

## Frontend Components

### Component Hierarchy

```
App
├── Layout
│   ├── Sidebar
│   │   ├── Logo
│   │   ├── Navigation
│   │   └── QuickStats
│   └── Header
│       ├── Breadcrumbs
│       └── UserMenu
│
├── Pages
│   ├── Dashboard
│   │   ├── ProjectOverview
│   │   ├── ActivePlans
│   │   ├── RecentActivity
│   │   └── QuickActions
│   │
│   ├── PlanCreate
│   │   ├── RequestInput
│   │   ├── TemplateSelector
│   │   ├── DecompositionProgress
│   │   ├── TaskReview
│   │   │   ├── TaskList
│   │   │   │   └── TaskCard
│   │   │   ├── DependencyGraph
│   │   │   └── ValidationPanel
│   │   └── ConfirmationStep
│   │
│   ├── PlanExecution
│   │   ├── ExecutionHeader
│   │   ├── TaskProgress
│   │   │   ├── TaskStatusList
│   │   │   └── TaskDetailPanel
│   │   ├── LiveOutput
│   │   │   ├── OutputTabs
│   │   │   └── OutputStream
│   │   ├── RedFlagPanel
│   │   └── ExecutionControls
│   │
│   ├── PlanReview
│   │   ├── ReviewSummary
│   │   ├── ReviewPoints
│   │   │   └── ReviewPointCard
│   │   ├── CommitList
│   │   ├── DiffViewer
│   │   │   ├── FileTree
│   │   │   └── CodeDiff
│   │   └── ReviewActions
│   │
│   └── Settings
│       ├── GeneralSettings
│       ├── LLMSettings
│       ├── GitSettings
│       └── ExecutionSettings
│
└── Shared
    ├── TaskEditor (Modal)
    ├── DependencyGraph (D3/React Flow)
    ├── CodeViewer
    ├── DiffViewer
    ├── Terminal
    ├── ProgressBar
    ├── StatusBadge
    └── LoadingSpinner
```

### Key Component Specs

**TaskCard:**
```typescript
interface TaskCardProps {
  task: Task;
  status: TaskStatus;
  result?: TaskResult;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDecompose: () => void;
  onDelete: () => void;
}

// Visual states:
// - pending: Gray, dashed border
// - in_progress: Blue, animated border, show worker info
// - completed: Green, checkmark, show commit hash
// - failed: Red, X mark, show error
// - blocked: Orange, show blocking task
```

**DependencyGraph:**
```typescript
interface DependencyGraphProps {
  tasks: Task[];
  layout: 'horizontal' | 'vertical' | 'radial';
  interactive: boolean;
  onTaskClick?: (taskId: string) => void;
  highlightPath?: string[];  // Highlight critical path
}

// Use React Flow or D3.js for rendering
// Show:
// - Nodes: Tasks with status colors
// - Edges: Dependencies with direction
// - Levels: Parallel execution groups
// - Critical path: Highlighted
```

**LiveOutput:**
```typescript
interface LiveOutputProps {
  streams: Map<string, OutputLine[]>;
  selectedWorker?: string;
  autoScroll: boolean;
  maxLines: number;
  onSearch: (query: string) => void;
  onFilter: (type: OutputType) => void;
}

// Features:
// - Tab per worker
// - ANSI color support
// - Search/filter
// - Auto-scroll toggle
// - Copy support
```

**DiffViewer:**
```typescript
interface DiffViewerProps {
  files: FileDiff[];
  selectedFile?: string;
  viewMode: 'split' | 'unified';
  onFileSelect: (path: string) => void;
  onCommentAdd?: (file: string, line: number, comment: string) => void;
}

// Features:
// - File tree navigation
// - Split or unified view
// - Syntax highlighting
// - Line numbers
// - Expand/collapse hunks
// - Comment support
```

---

## State Management

Using React Query + Zustand:

```typescript
// React Query for server state
const queryClient = new QueryClient();

// Plan queries
export const usePlan = (planId: string) =>
  useQuery(['plan', planId], () => api.getPlan(planId));

export const usePlanTasks = (planId: string) =>
  useQuery(['plan', planId, 'tasks'], () => api.getPlanTasks(planId));

export const useExecution = (planId: string) =>
  useQuery(['plan', planId, 'execution'], () => api.getExecution(planId), {
    refetchInterval: 1000  // Poll during execution
  });

// Mutations
export const useStartExecution = () =>
  useMutation(
    (planId: string) => api.startExecution(planId),
    {
      onSuccess: (_, planId) => {
        queryClient.invalidateQueries(['plan', planId]);
      }
    }
  );

// Zustand for UI state
interface UIStore {
  // Active selections
  activePlanId: string | null;
  selectedTaskId: string | null;
  selectedWorker: string | null;

  // UI preferences
  sidebarCollapsed: boolean;
  outputAutoScroll: boolean;
  diffViewMode: 'split' | 'unified';

  // Actions
  setActivePlan: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePlanId: null,
  selectedTaskId: null,
  selectedWorker: null,
  sidebarCollapsed: false,
  outputAutoScroll: true,
  diffViewMode: 'split',

  setActivePlan: (id) => set({ activePlanId: id }),
  selectTask: (id) => set({ selectedTaskId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
}));
```

### WebSocket Integration

```typescript
// WebSocket hook for real-time updates
export function useExecutionSocket(planId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io('/execution');

    socket.emit('subscribe:execution', { plan_id: planId });

    socket.on('execution:task_started', (data) => {
      queryClient.setQueryData(['plan', planId, 'execution'], (old: any) => ({
        ...old,
        tasks: updateTaskStatus(old.tasks, data.task_id, 'in_progress')
      }));
    });

    socket.on('execution:task_completed', (data) => {
      queryClient.setQueryData(['plan', planId, 'execution'], (old: any) => ({
        ...old,
        tasks: updateTaskStatus(old.tasks, data.task_id, 'completed', data.result)
      }));
    });

    socket.on('execution:task_output', (data) => {
      // Append to output stream
    });

    socket.on('execution:red_flag', (data) => {
      // Show notification
      toast.warning(data.red_flag.description);
    });

    socket.on('execution:complete', (data) => {
      queryClient.invalidateQueries(['plan', planId]);
      // Navigate to review
    });

    return () => {
      socket.emit('unsubscribe', { channel: `execution:${planId}` });
      socket.disconnect();
    };
  }, [planId, queryClient]);
}
```

---

## Notifications & Alerts

```typescript
interface NotificationSystem {
  // Types
  types: ['info', 'success', 'warning', 'error'];

  // Triggers
  triggers: {
    'execution:complete': 'success',
    'execution:failed': 'error',
    'red_flag:critical': 'warning',
    'budget:threshold': 'warning',
    'verification:failed': 'error'
  };

  // Display
  display: {
    toast: boolean;
    sound: boolean;
    desktop: boolean;  // Browser notifications
  };
}

// Toast notifications
function showNotification(type: string, message: string, data?: any) {
  switch (type) {
    case 'execution:complete':
      toast.success(`Plan "${data.plan.title}" completed!`, {
        action: {
          label: 'Review',
          onClick: () => navigate(`/plans/${data.plan.id}/review`)
        }
      });
      break;

    case 'red_flag:critical':
      toast.warning(`Critical issue: ${data.description}`, {
        duration: 10000,
        action: {
          label: 'View',
          onClick: () => scrollToRedFlag(data.id)
        }
      });
      break;
  }
}
```

---

## Responsive Design

```typescript
// Breakpoints
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Layout adaptations
const layouts = {
  // Mobile: Stack everything
  mobile: {
    sidebar: 'hidden',
    taskList: 'full-width',
    output: 'tabs',
    diff: 'unified'
  },

  // Tablet: Side panel
  tablet: {
    sidebar: 'collapsible',
    taskList: 'side-panel',
    output: 'tabs',
    diff: 'unified'
  },

  // Desktop: Full layout
  desktop: {
    sidebar: 'visible',
    taskList: 'side-by-side',
    output: 'split-view',
    diff: 'split'
  }
};
```

---

## Configuration

```json
// .rtslabs/config.json
{
  "ui": {
    "port": 3000,
    "host": "localhost",
    "theme": "system",
    "notifications": {
      "enabled": true,
      "sound": false,
      "desktop": true
    },
    "execution": {
      "auto_scroll": true,
      "max_output_lines": 1000,
      "show_timestamps": true
    },
    "diff": {
      "default_view": "split",
      "syntax_highlighting": true,
      "word_wrap": false
    }
  }
}
```

---

## Security

```typescript
// Authentication (optional, for multi-user)
interface AuthConfig {
  enabled: boolean;
  provider: 'local' | 'oauth';
  session_timeout_minutes: number;
}

// API security
interface SecurityMiddleware {
  // Rate limiting
  rate_limit: {
    window_ms: number;
    max_requests: number;
  };

  // CORS
  cors: {
    origin: string[];
    credentials: boolean;
  };

  // Input validation
  validation: {
    max_request_size: string;
    sanitize_input: boolean;
  };
}

// Sensitive data handling
const MASKED_FIELDS = ['api_key', 'password', 'token', 'secret'];

function maskSensitiveData(obj: any): any {
  // Recursively mask sensitive fields
  for (const key of Object.keys(obj)) {
    if (MASKED_FIELDS.some(f => key.toLowerCase().includes(f))) {
      obj[key] = '••••••••';
    } else if (typeof obj[key] === 'object') {
      maskSensitiveData(obj[key]);
    }
  }
  return obj;
}
```

---

## Integration Points

### With All Core Services
- Decomposition Engine: Trigger decomposition, display progress
- Execution Engine: Start/pause/abort, stream events
- Verification System: Display results, red flags
- Git Manager: Show commits, diffs, enable push/PR
- Memory System: Display patterns, gotchas
- Project Analyzer: Show project info
- LLM Router: Display usage stats

### External Integrations
- VS Code: Open files in editor
- GitHub/GitLab: Link to PRs, issues
- Slack/Discord: Notifications (future)
