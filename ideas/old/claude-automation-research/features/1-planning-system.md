# Planning System Specification

This document defines the file-based planning system for the coding-agent. Plans are stored in git alongside the project code, enabling version control, collaboration, and execution resumption.

## Design Principles

1. **Git-native**: All plan data lives in the repository, versioned alongside code
2. **Append-friendly**: JSONL format for high-frequency writes without rewriting entire files
3. **Conflict-resistant**: Hash-based IDs prevent merge conflicts in multi-agent scenarios
4. **Resumable**: Committed state allows execution to resume after crashes or pauses
5. **Auditable**: Event logs provide full execution history
6. **Template-driven**: Common patterns are captured as reusable templates

## Directory Structure

```
.rtslabs/
├── config.json                      # Global settings
├── templates/                       # Plan templates
│   ├── crud-feature.json
│   ├── api-endpoint.json
│   ├── refactor.json
│   └── bugfix.json
├── plans/
│   └── {plan-id}/                   # e.g., p-a3f8e9/
│       ├── meta.json                # Plan metadata
│       ├── request.md               # Original request (human reference)
│       ├── tasks.jsonl              # Task definitions (append-only)
│       ├── state.json               # Execution state (mutable)
│       ├── verification.jsonl       # Verification log (append-only)
│       └── events.jsonl             # Audit trail (append-only)
├── worktrees/                       # Git worktrees for plan isolation
│   └── {plan-id}/
└── memory/
    ├── patterns.jsonl               # Learned patterns for this project
    ├── gotchas.jsonl                # Known pitfalls
    └── insights/
        └── {plan-id}.json           # Per-plan learnings
```

## ID Formats

### Plan IDs
```
p-{6-char-hash}
p-a3f8e9
p-b7c2d1
```

### Task IDs
```
t-{6-char-hash}           # Root tasks
t-{parent-hash}-{index}   # Child tasks (from decomposition)

Examples:
t-c2d4f1                  # Root task
t-c2d4f1-1                # First child of t-c2d4f1
t-c2d4f1-2                # Second child of t-c2d4f1
```

Hash-based IDs prevent merge conflicts when multiple agents or users create tasks simultaneously.

## File Formats

### `config.json` - Global Configuration

```json
{
  "version": "1.0.0",
  "defaults": {
    "max_workers": 4,
    "verification_layers": ["self", "quick", "phase_gate", "final_review"],
    "cheap_model": "claude-3-5-haiku",
    "execution_model": "claude-sonnet-4",
    "auto_commit": true
  },
  "project": {
    "name": "my-project",
    "stack": "nestjs",
    "test_command": "npm test",
    "typecheck_command": "npm run typecheck",
    "lint_command": "npm run lint"
  }
}
```

### `meta.json` - Plan Metadata

Small file containing plan-level information. Rarely changes after creation.

```json
{
  "id": "p-a3f8e9",
  "slug": "user-auth",
  "created_at": "2024-01-09T10:00:00Z",
  "created_by": "user@example.com",
  "template": "crud-feature",
  "template_variables": {
    "entity_name": "User",
    "fields": ["email:string", "passwordHash:string"]
  },
  "branch": "plan/p-a3f8e9-user-auth",
  "worktree": ".rtslabs/worktrees/p-a3f8e9",
  "status": "executing",
  "project_path": "/path/to/project",
  "original_request_hash": "sha256:abc123..."
}
```

**Status values:**
- `drafting` - Plan is being created/decomposed
- `ready` - All tasks are atomic, ready to execute
- `executing` - Execution in progress
- `paused` - Execution paused by user
- `review` - Execution complete, awaiting human review
- `completed` - Human approved, merged
- `failed` - Execution failed, needs intervention

### `request.md` - Original Request

Human-readable markdown file preserving the original request for reference.

```markdown
# Original Request

Created: 2024-01-09T10:00:00Z
Author: user@example.com

## Description

Add user authentication to the application. Users should be able to:
- Register with email and password
- Login and receive a JWT token
- Access protected endpoints with the token
- Reset their password via email

## Attachments

- [Screenshot: Login mockup](attachments/login-mockup.png)
- [API spec draft](attachments/auth-api.yaml)

## Notes

Use bcrypt for password hashing. JWT tokens should expire after 24 hours.
```

### `tasks.jsonl` - Task Definitions

One task per line. Append-only - new decompositions add new lines, never modify existing lines.

```jsonl
{"id":"t-c2d4f1","parent":null,"title":"Create User entity","description":"Create TypeORM entity for User with fields: id (uuid), email (unique), passwordHash, createdAt, updatedAt","acceptance":"Entity file exists at src/entities/user.entity.ts with correct decorators and types","atomic":true,"depends_on":[],"order":0,"created_at":"2024-01-09T10:00:00Z"}
{"id":"t-e5f6a2","parent":null,"title":"Create Auth service","description":"Service with methods: hashPassword, verifyPassword, generateToken, validateToken","acceptance":"Service exists at src/services/auth.service.ts with unit tests covering all methods","atomic":true,"depends_on":["t-c2d4f1"],"order":1,"created_at":"2024-01-09T10:00:05Z"}
{"id":"t-g7h8b3","parent":null,"title":"Create Auth controller","description":"REST endpoints: POST /auth/register, POST /auth/login, GET /auth/me (protected)","acceptance":"Controller exists with Swagger docs and integration tests","atomic":true,"depends_on":["t-e5f6a2"],"order":2,"created_at":"2024-01-09T10:00:10Z"}
{"id":"t-i9j0c4","parent":null,"title":"Add password reset flow","description":"Full password reset with email verification","acceptance":"User can request reset, receive email, and set new password","atomic":false,"depends_on":[],"order":3,"created_at":"2024-01-09T10:00:15Z"}
{"id":"t-i9j0c4-1","parent":"t-i9j0c4","title":"Create PasswordResetToken entity","description":"Entity to store reset tokens with expiration","acceptance":"Entity exists with token, userId, expiresAt fields","atomic":true,"depends_on":["t-c2d4f1"],"order":0,"created_at":"2024-01-09T10:05:00Z"}
{"id":"t-i9j0c4-2","parent":"t-i9j0c4","title":"Add email service for reset emails","description":"Service to send password reset emails with tokenized links","acceptance":"Service sends emails via configured SMTP/provider","atomic":true,"depends_on":[],"order":1,"created_at":"2024-01-09T10:05:05Z"}
```

**Task fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier (hash-based) |
| `parent` | string\|null | Parent task ID if this is a decomposition result |
| `title` | string | Short task title |
| `description` | string | Detailed description of what to implement |
| `acceptance` | string | Clear criteria for task completion |
| `atomic` | boolean | True if task cannot be decomposed further |
| `depends_on` | string[] | Task IDs that must complete before this task |
| `order` | number | Display/execution order within siblings |
| `created_at` | string | ISO timestamp of task creation |

### `state.json` - Execution State

Mutable file tracking current execution state. Updated frequently during execution.

```json
{
  "plan_id": "p-a3f8e9",
  "execution": {
    "started_at": "2024-01-09T10:30:00Z",
    "paused_at": null,
    "completed_at": null,
    "total_tasks": 6,
    "completed_tasks": 2,
    "failed_tasks": 0
  },
  "workers": {
    "active": ["t-e5f6a2", "t-i9j0c4-2"],
    "max": 4
  },
  "tasks": {
    "t-c2d4f1": {
      "status": "completed",
      "started_at": "2024-01-09T10:30:00Z",
      "completed_at": "2024-01-09T10:32:15Z",
      "attempt": 1,
      "commit": "abc1234def5678",
      "files_modified": [
        "src/entities/user.entity.ts",
        "src/entities/user.entity.spec.ts"
      ],
      "tests_written": ["src/entities/user.entity.spec.ts"],
      "duration_ms": 135000
    },
    "t-e5f6a2": {
      "status": "in_progress",
      "started_at": "2024-01-09T10:31:00Z",
      "attempt": 1,
      "worker_id": 2
    },
    "t-g7h8b3": {
      "status": "blocked",
      "blocked_by": ["t-e5f6a2"],
      "ready_when": ["t-e5f6a2"]
    },
    "t-i9j0c4": {
      "status": "decomposed",
      "decomposed_at": "2024-01-09T10:05:00Z",
      "children": ["t-i9j0c4-1", "t-i9j0c4-2"]
    },
    "t-i9j0c4-1": {
      "status": "pending"
    },
    "t-i9j0c4-2": {
      "status": "in_progress",
      "started_at": "2024-01-09T10:31:30Z",
      "attempt": 1,
      "worker_id": 3
    }
  },
  "phase_gates": {
    "gate-backend-core": {
      "name": "Backend Core Complete",
      "after_tasks": ["t-c2d4f1", "t-e5f6a2", "t-g7h8b3"],
      "status": "pending",
      "checks": ["tests", "typecheck", "lint"]
    }
  },
  "qa_loops": [
    {
      "task_id": "t-e5f6a2",
      "started_at": "2024-01-09T10:35:00Z",
      "reason": "test_failure",
      "attempts": 1,
      "max_attempts": 5,
      "resolved": false
    }
  ]
}
```

**Task status values:**
- `pending` - Not yet started, may be blocked
- `blocked` - Waiting on dependencies
- `in_progress` - Currently executing
- `verifying` - Execution complete, running verification
- `completed` - Successfully completed and verified
- `failed` - Failed after max retries
- `decomposed` - Non-atomic task that was broken into children

### `verification.jsonl` - Verification Results

Append-only log of all verification attempts across all layers.

```jsonl
{"task_id":"t-c2d4f1","layer":"self","passed":true,"at":"2024-01-09T10:32:00Z","attempt":1,"duration_ms":5000,"details":{"tests_run":3,"tests_passed":3,"coverage":85}}
{"task_id":"t-c2d4f1","layer":"quick","passed":true,"at":"2024-01-09T10:32:10Z","model":"claude-3-5-haiku","duration_ms":2500,"details":{"checks":["code_matches_description","tests_cover_acceptance","no_obvious_issues"],"score":0.95}}
{"task_id":"t-e5f6a2","layer":"self","passed":false,"at":"2024-01-09T10:35:00Z","attempt":1,"duration_ms":8000,"details":{"tests_run":5,"tests_passed":4,"failures":[{"test":"verifyPassword should handle invalid hash","error":"Timeout after 5000ms"}]}}
{"task_id":"t-e5f6a2","layer":"self","passed":true,"at":"2024-01-09T10:37:00Z","attempt":2,"duration_ms":6000,"details":{"tests_run":5,"tests_passed":5,"coverage":92}}
{"plan_id":"p-a3f8e9","layer":"phase_gate","gate":"gate-backend-core","passed":true,"at":"2024-01-09T10:45:00Z","duration_ms":45000,"details":{"tests":{"run":48,"passed":48},"typecheck":{"errors":0},"lint":{"errors":0,"warnings":3}}}
{"plan_id":"p-a3f8e9","layer":"final_review","passed":true,"at":"2024-01-09T10:50:00Z","model":"claude-sonnet-4","details":{"summary":"All acceptance criteria met...","security_issues":[],"suggestions":["Consider adding rate limiting to login endpoint"]}}
```

**Verification layers:**
| Layer | When | What | Model |
|-------|------|------|-------|
| `self` | After task execution | Run tests written by the task | N/A (test runner) |
| `quick` | After self passes | LLM validates code matches intent | Cheap (Haiku/Ollama) |
| `phase_gate` | After task group completes | Full test suite, typecheck, lint | N/A (build tools) |
| `final_review` | Before human review | Full diff review, security scan | Capable (Sonnet/Opus) |

### `events.jsonl` - Audit Trail

Complete log of all execution events for debugging and learning.

```jsonl
{"type":"plan_created","at":"2024-01-09T10:00:00Z","plan_id":"p-a3f8e9","template":"crud-feature"}
{"type":"task_created","at":"2024-01-09T10:00:00Z","task_id":"t-c2d4f1","title":"Create User entity"}
{"type":"task_created","at":"2024-01-09T10:00:05Z","task_id":"t-e5f6a2","title":"Create Auth service"}
{"type":"task_decomposed","at":"2024-01-09T10:05:00Z","task_id":"t-i9j0c4","children":["t-i9j0c4-1","t-i9j0c4-2"]}
{"type":"plan_started","at":"2024-01-09T10:30:00Z","branch":"plan/p-a3f8e9-user-auth","worktree":".rtslabs/worktrees/p-a3f8e9"}
{"type":"task_started","at":"2024-01-09T10:30:00Z","task_id":"t-c2d4f1","worker_id":1}
{"type":"task_started","at":"2024-01-09T10:30:05Z","task_id":"t-e5f6a2","worker_id":2}
{"type":"task_completed","at":"2024-01-09T10:32:15Z","task_id":"t-c2d4f1","commit":"abc1234def5678","files":["src/entities/user.entity.ts"]}
{"type":"task_unblocked","at":"2024-01-09T10:32:15Z","task_id":"t-g7h8b3","unblocked_by":"t-e5f6a2"}
{"type":"verification_failed","at":"2024-01-09T10:35:00Z","task_id":"t-e5f6a2","layer":"self","reason":"test_failure"}
{"type":"qa_loop_started","at":"2024-01-09T10:35:30Z","task_id":"t-e5f6a2","attempt":2}
{"type":"task_retry","at":"2024-01-09T10:35:30Z","task_id":"t-e5f6a2","attempt":2,"reason":"test_failure"}
{"type":"task_completed","at":"2024-01-09T10:37:15Z","task_id":"t-e5f6a2","commit":"def5678abc1234","attempt":2}
{"type":"phase_gate_started","at":"2024-01-09T10:45:00Z","gate":"gate-backend-core"}
{"type":"phase_gate_passed","at":"2024-01-09T10:45:45Z","gate":"gate-backend-core"}
{"type":"plan_review_ready","at":"2024-01-09T10:50:00Z","summary":"6 tasks completed, all tests passing"}
{"type":"plan_approved","at":"2024-01-09T11:00:00Z","approved_by":"user@example.com"}
{"type":"plan_merged","at":"2024-01-09T11:00:30Z","merge_commit":"xyz789","target_branch":"main"}
```

## Templates

Templates define reusable task structures for common patterns. They use variable substitution to customize tasks for specific use cases.

### Template Location

Templates are stored in `.rtslabs/templates/` within each project. This allows project-specific templates while the coding-agent service can provide default templates.

### Template Format

```json
{
  "id": "tmpl-crud-feature",
  "name": "CRUD Feature",
  "description": "Standard CRUD endpoints for a database entity",
  "version": "1.0.0",
  "variables": {
    "entity_name": {
      "type": "string",
      "description": "Name of the entity (e.g., 'User', 'Product')",
      "required": true,
      "pattern": "^[A-Z][a-zA-Z]*$"
    },
    "fields": {
      "type": "array",
      "description": "List of fields in format 'name:type'",
      "required": true,
      "items": {
        "type": "string",
        "pattern": "^[a-z][a-zA-Z]*:(string|number|boolean|date|text|uuid)$"
      }
    },
    "include_soft_delete": {
      "type": "boolean",
      "description": "Include soft delete (deletedAt) field",
      "default": true
    },
    "include_timestamps": {
      "type": "boolean",
      "description": "Include createdAt/updatedAt fields",
      "default": true
    }
  },
  "tasks": [
    {
      "title": "Create {{entity_name}} entity",
      "description": "Create TypeORM entity for {{entity_name}} with fields:\n{{#each fields}}- {{this}}\n{{/each}}{{#if include_timestamps}}- createdAt: date\n- updatedAt: date{{/if}}{{#if include_soft_delete}}\n- deletedAt: date (nullable){{/if}}",
      "acceptance": "- Entity file exists at src/entities/{{entity_name | lowercase}}.entity.ts\n- All fields have correct types and decorators\n- Entity is exported from entities index",
      "atomic": true,
      "depends_on": []
    },
    {
      "title": "Create {{entity_name}} migration",
      "description": "Generate TypeORM migration for {{entity_name}} table creation",
      "acceptance": "- Migration file created in src/migrations/\n- Migration runs successfully (up and down)\n- Table created with correct columns and constraints",
      "atomic": true,
      "depends_on": ["Create {{entity_name}} entity"]
    },
    {
      "title": "Create {{entity_name}} service",
      "description": "Service class with CRUD operations:\n- create(dto): Create new {{entity_name}}\n- findAll(query): List with pagination/filtering\n- findOne(id): Get by ID\n- update(id, dto): Update existing\n- remove(id): {{#if include_soft_delete}}Soft delete{{else}}Hard delete{{/if}}",
      "acceptance": "- Service at src/services/{{entity_name | lowercase}}.service.ts\n- All CRUD methods implemented\n- Proper error handling (NotFoundException, etc.)\n- Unit tests with >80% coverage",
      "atomic": true,
      "depends_on": ["Create {{entity_name}} entity"]
    },
    {
      "title": "Create {{entity_name}} DTOs",
      "description": "Data transfer objects:\n- Create{{entity_name}}Dto\n- Update{{entity_name}}Dto\n- {{entity_name}}ResponseDto\n- {{entity_name}}QueryDto (for filtering)",
      "acceptance": "- DTOs at src/dto/{{entity_name | lowercase}}/\n- Validation decorators (class-validator)\n- Swagger decorators for documentation",
      "atomic": true,
      "depends_on": []
    },
    {
      "title": "Create {{entity_name}} controller",
      "description": "REST controller with endpoints:\n- POST /{{entity_name | lowercase}}s - Create\n- GET /{{entity_name | lowercase}}s - List all\n- GET /{{entity_name | lowercase}}s/:id - Get one\n- PATCH /{{entity_name | lowercase}}s/:id - Update\n- DELETE /{{entity_name | lowercase}}s/:id - Delete",
      "acceptance": "- Controller at src/controllers/{{entity_name | lowercase}}.controller.ts\n- All endpoints implemented with proper HTTP status codes\n- Swagger documentation complete\n- Request validation using DTOs",
      "atomic": true,
      "depends_on": ["Create {{entity_name}} service", "Create {{entity_name}} DTOs"]
    },
    {
      "title": "Create {{entity_name}} integration tests",
      "description": "Integration tests for all {{entity_name}} endpoints using test database",
      "acceptance": "- Test file at src/controllers/{{entity_name | lowercase}}.controller.spec.ts\n- Tests for all CRUD operations\n- Tests for validation errors\n- Tests for not found cases\n- All tests passing",
      "atomic": true,
      "depends_on": ["Create {{entity_name}} controller"]
    }
  ],
  "phase_gates": [
    {
      "name": "Pre-controller",
      "after": ["Create {{entity_name}} service", "Create {{entity_name}} DTOs"],
      "checks": ["typecheck", "lint"]
    },
    {
      "name": "Final",
      "after": ["Create {{entity_name}} integration tests"],
      "checks": ["tests", "typecheck", "lint"]
    }
  ]
}
```

### Template Variable Syntax

Templates use Handlebars-style syntax for variable substitution:

| Syntax | Description | Example |
|--------|-------------|---------|
| `{{variable}}` | Simple substitution | `{{entity_name}}` → `User` |
| `{{variable \| lowercase}}` | With filter | `{{entity_name \| lowercase}}` → `user` |
| `{{#if variable}}...{{/if}}` | Conditional | Include soft delete section |
| `{{#each array}}...{{/each}}` | Iteration | List all fields |
| `{{#unless variable}}...{{/unless}}` | Negative conditional | |

### Template Instantiation

When a template is instantiated:

1. **Variable extraction**: LLM parses user request to extract variable values
2. **Validation**: Variables are validated against schema
3. **Substitution**: Template tasks are rendered with variable values
4. **ID generation**: Hash-based IDs are generated for each task
5. **Plan creation**: Files are written to `.rtslabs/plans/{plan-id}/`

## Task Dependencies and Parallel Execution

### Dependency Graph

Tasks form a Directed Acyclic Graph (DAG) based on their `depends_on` fields. The execution engine:

1. Builds the dependency graph from `tasks.jsonl`
2. Identifies tasks with no dependencies (ready to execute)
3. Executes ready tasks in parallel (up to `max_workers`)
4. When a task completes, checks if any blocked tasks are now unblocked
5. Continues until all tasks complete or a failure occurs

### Example Dependency Graph

```
t-c2d4f1 (Entity) ────────┬─────────────────────────────┐
                          │                             │
                          ▼                             │
              t-e5f6a2 (Service) ──────┐                │
                          │            │                │
                          │            ▼                ▼
                          │    t-d4e5f6 (DTOs)    t-i9j0c4-1 (Reset Token Entity)
                          │            │
                          ▼            │
              t-g7h8b3 (Controller) ◄──┘
                          │
                          ▼
              t-h8i9j0 (Integration Tests)
                          │
                          ▼
                   [Phase Gate: Final]

Parallel execution groups:
- Level 0: [Entity, DTOs, Reset Token Entity] - no dependencies
- Level 1: [Service] - depends on Entity
- Level 2: [Controller] - depends on Service + DTOs
- Level 3: [Integration Tests] - depends on Controller
```

## Worktree Management

Each plan executes in an isolated git worktree to prevent conflicts with the main working directory.

### Worktree Creation

When a plan starts execution:
1. Create branch: `git branch plan/p-{id}-{slug}`
2. Create worktree: `git worktree add .rtslabs/worktrees/p-{id} plan/p-{id}-{slug}`
3. Install dependencies if needed

### Worktree Cleanup

Worktree cleanup is a manual process triggered by the user. Cleanup involves:
1. Verify plan is in `completed` or `failed` status
2. Remove worktree: `git worktree remove .rtslabs/worktrees/p-{id}`
3. Optionally delete branch if merged: `git branch -d plan/p-{id}-{slug}`
4. Archive or delete plan directory

## Memory System

The memory system captures learnings from plan execution to improve future runs.

### `patterns.jsonl` - Learned Patterns

```jsonl
{"pattern":"nestjs_service_injection","description":"Services should be injected via constructor with private readonly","confidence":0.95,"learned_from":["p-a3f8e9","p-b7c2d1"],"created_at":"2024-01-09T12:00:00Z"}
{"pattern":"typeorm_entity_decorators","description":"Always include @Entity() and @PrimaryGeneratedColumn('uuid')","confidence":0.98,"learned_from":["p-a3f8e9"],"created_at":"2024-01-09T12:00:00Z"}
```

### `gotchas.jsonl` - Known Pitfalls

```jsonl
{"gotcha":"bcrypt_import","description":"Use 'import * as bcrypt' not 'import bcrypt' to avoid ESM issues","severity":"high","learned_from":"p-a3f8e9","created_at":"2024-01-09T12:00:00Z"}
{"gotcha":"typeorm_migrations","description":"Run migrations before tests in CI - database schema must be current","severity":"medium","learned_from":"p-b7c2d1","created_at":"2024-01-10T09:00:00Z"}
```

### `insights/{plan-id}.json` - Per-Plan Learnings

```json
{
  "plan_id": "p-a3f8e9",
  "completed_at": "2024-01-09T11:00:00Z",
  "duration_total_ms": 3600000,
  "tasks_total": 6,
  "tasks_succeeded_first_try": 5,
  "tasks_required_retry": 1,
  "discoveries": {
    "src/services/auth.service.ts": "JWT signing requires async/await in NestJS context"
  },
  "what_worked": [
    "Breaking password reset into separate entity and email service tasks",
    "Running entity creation before service creation"
  ],
  "what_failed": [
    "Initial bcrypt import syntax caused test failures"
  ],
  "recommendations": [
    "Consider adding rate limiting template for auth endpoints",
    "Password reset should include token expiration check"
  ]
}
```

## Git Commit Strategy

Each completed task results in a git commit in the plan's worktree.

### Commit Message Format

```
[coding-agent] {task-title}

Task: {task-id}
Plan: {plan-id}

{task-description}

Acceptance criteria:
{acceptance-criteria}

Files modified:
- {file-1}
- {file-2}

Tests: {tests-passed}/{tests-total} passing
```

### Example

```
[coding-agent] Create User entity

Task: t-c2d4f1
Plan: p-a3f8e9

Create TypeORM entity for User with fields: id (uuid), email (unique),
passwordHash, createdAt, updatedAt

Acceptance criteria:
- Entity file exists at src/entities/user.entity.ts
- All fields have correct types and decorators
- Entity is exported from entities index

Files modified:
- src/entities/user.entity.ts
- src/entities/user.entity.spec.ts
- src/entities/index.ts

Tests: 3/3 passing
```

## File Mutability Summary

| File | Mutability | Git Strategy |
|------|------------|--------------|
| `config.json` | Rarely changed | Commit on change |
| `meta.json` | Written once, status updates only | Commit on status change |
| `request.md` | Written once | Commit on creation |
| `tasks.jsonl` | Append-only | Commit on new tasks |
| `state.json` | Frequently updated | Commit on pause/completion |
| `verification.jsonl` | Append-only | Commit periodically |
| `events.jsonl` | Append-only | Commit on completion |

## Future Considerations

### Phase Gates
The specific triggering mechanism for phase gates (after specific tasks, after depth levels, manual definition) will be determined during implementation.

### Template Inheritance
Templates could support inheritance, where a specialized template extends a base template.

### Multi-Project Memory
Cross-project learning where patterns from one project inform another (with user consent).

### Collaborative Editing
Multiple users editing a plan simultaneously during the drafting phase.
