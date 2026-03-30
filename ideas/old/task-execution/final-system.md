# Final Task Execution System Design

This document describes the complete 3-stage decomposition and execution system for autonomous task completion.

## Table of Contents

- [Overview](#overview)
- [Stage 0: Brainstorming (Planner)](#stage-0-brainstorming-planner)
- [Stage 1: Project Decomposition](#stage-1-project-decomposition)
- [Stage 2: Feature Decomposition](#stage-2-feature-decomposition)
- [Stage 3: Atomic Task Decomposition](#stage-3-atomic-task-decomposition)
- [Task Storage Format](#task-storage-format)
- [Dependency System](#dependency-system)
- [Execution System](#execution-system)
- [Visualization](#visualization)
- [Complete Flow Example](#complete-flow-example)

---

## Overview

```
User Request → Planner (Stage 0) → Decomp Stage 1 → Decomp Stage 2 → Decomp Stage 3 → Execute
                ↓                      ↓                ↓                ↓
             plan.md              Projects          Features       Atomic Tasks
```

### Key Principles

1. **Explicit Dependencies**: Tasks declare dependencies on other tasks
2. **Cross-Feature Dependencies**: Backend tasks can depend on frontend tasks and vice versa
3. **AMAP Parallelism**: As Many As Possible - spawn workers for all ready tasks
4. **User Approval**: User reviews and approves at each stage
5. **Feature-Based Architecture**: Aligns with the new feature architecture where everything lives in `features/`

---

## Stage 0: Brainstorming (Planner)

### Purpose
Pure brainstorming and requirements gathering. No task creation yet.

### Invocation
```bash
/planner
```

### Output
- **File**: `.backlog/p-{id}/plan.md`
- **Content**: Prose document with:
  - Problem statement
  - Requirements gathered
  - Scope decisions
  - Architecture considerations
  - Open questions resolved

### How Planner Works

The planner skill directly maintains `plan.md` during brainstorming:

1. **Creates plan.md** at session start
2. **Conversationally explores** requirements with user
3. **Continuously updates** plan.md with decisions, scope, requirements
4. **Uses Write/Edit tools** to keep document current
5. **Never creates tasks** - just synthesizes understanding

**Example flow:**
```
User: "We need authentication. Should use JWT tokens."

Planner: [Edits plan.md to add Technical Decision]

User: "It should support admin and user roles."

Planner: [Edits plan.md to add Requirements section]
```

The planner skill operates in the main session - no background agents needed.

### User Approval Gate

When brainstorming is complete:
1. Planner presents summary of plan.md
2. User approves or requests changes
3. If approved, status → `approved`, ready for Stage 1

---

## Stage 1: Project Decomposition

### Purpose
Break feature into **high-level conceptual groupings** (projects).

### Invocation
```bash
/decomp p-abc123
```

### What is a "Project"?
A project is a **major area of work** that may span multiple parts of the codebase.

**Examples:**
```
Feature: "Add real-time chat to application"

Projects:
1. Frontend Chat UI
2. Backend WebSocket API
3. Database Schema Updates
4. Message Persistence Service
```

**Characteristics:**
- High-level, conceptual chunks
- May span frontend + backend
- Not yet executable
- Describes "what" not "how"

### Output Format (tasks.jsonl)

```jsonl
{"id":"p-abc123","type":"plan","name":"Add real-time chat","status":"approved","created":"2026-01-13T..."}
{"id":"1","type":"project","parent":"p-abc123","name":"Frontend Chat UI","description":"Build React components for chat interface","status":"ready"}
{"id":"2","type":"project","parent":"p-abc123","name":"Backend WebSocket API","description":"Create WebSocket gateway for real-time messaging","status":"ready"}
{"id":"3","type":"project","parent":"p-abc123","name":"Database Schema","description":"Add messages table and relationships","status":"ready"}
```

### ASCII Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ Plan: Add real-time chat (p-abc123)                        │
│ Status: Decomposed into projects                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Projects:                                                   │
│                                                              │
│  1. Frontend Chat UI                       [ready]          │
│     Build React components for chat interface               │
│                                                              │
│  2. Backend WebSocket API                  [ready]          │
│     Create WebSocket gateway for real-time messaging        │
│                                                              │
│  3. Database Schema                        [ready]          │
│     Add messages table and relationships                    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Next: Run `/decomp 1` to break down "Frontend Chat UI"     │
└─────────────────────────────────────────────────────────────┘
```

### User Review
User reviews projects and can:
- Request adjustments
- Add/remove projects
- Proceed to Stage 2

---

## Stage 2: Feature Decomposition

### Purpose
Break a project into **features** (the new architecture units).

### Invocation
```bash
/decomp 1  # Decompose project #1
```

### What is a "Feature"?
A **feature** is a directory in `src/features/` that represents either:
- **Full-stack feature**: Has controllers/pages + services + logic
- **Shared feature**: Utilities, components, services used by other features

### Output Format

```jsonl
{"id":"1.1","type":"feature","parent":"1","name":"chat-ui","path":"frontend/src/features/chat-ui","featureType":"full-stack","status":"ready","description":"Chat interface components and pages"}
{"id":"1.2","type":"feature","parent":"1","name":"websocket-client","path":"frontend/src/features/websocket-client","featureType":"shared","status":"ready","description":"Shared WebSocket connection manager"}
{"id":"1.3","type":"feature","parent":"1","name":"message-list","path":"frontend/src/features/message-list","featureType":"shared","status":"ready","description":"Reusable message display components"}
```

### ASCII Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ Project: Frontend Chat UI (1)                              │
│ Status: Decomposed into features                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Features to implement:                                      │
│                                                              │
│  1.1 chat-ui                              [full-stack]      │
│      frontend/src/features/chat-ui                          │
│      └─ Chat interface components and pages                 │
│                                                              │
│  1.2 websocket-client                     [shared]          │
│      frontend/src/features/websocket-client                 │
│      └─ Shared WebSocket connection manager                 │
│                                                              │
│  1.3 message-list                         [shared]          │
│      frontend/src/features/message-list                     │
│      └─ Reusable message display components                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Next: Run `/decomp 1.1` to create atomic tasks             │
└─────────────────────────────────────────────────────────────┘
```

### Feature Type Detection

The decomp skill infers if a feature is "full-stack" or "shared":
- **Full-stack**: Has user-facing interfaces (pages/controllers)
- **Shared**: Utilities used by other features

### User Review
User reviews features and can:
- Adjust feature boundaries
- Change feature types
- Proceed to Stage 3

---

## Stage 3: Atomic Task Decomposition

### Purpose
Break a feature into **atomic, executable tasks** that a worker can complete.

### Invocation
```bash
/decomp 1.1  # Decompose feature 1.1
```

### What is an "Atomic Task"?
- **Completable in one worker session** (30-50 turns)
- **Clear acceptance criteria**
- **Single responsibility**
- **Testable**

### Task Structure

```jsonl
{
  "id": "1.1.3",
  "type": "task",
  "parent": "1.1",
  "name": "Build MessageInput component",
  "description": "Create input component with send functionality",
  "status": "blocked",
  "dependencies": ["1.1.1", "1.1.2"],
  "dependencyReasons": {
    "1.1.1": "Needs feature directory structure",
    "1.1.2": "Component uses ChatContext"
  },
  "branch": "p-abc123-t-1.1.3",
  "acceptanceCriteria": [
    "Component renders correctly",
    "Handles user input",
    "Calls send callback",
    "Tests pass"
  ],
  "estimatedComplexity": "simple"
}
```

### Decomp Process

The decomp agent:

1. **Analyzes feature requirements** - What needs to be built?
2. **Maps to architecture**:
   - Frontend full-stack: pages/, components/, hooks/, services/
   - Backend full-stack: controllers/, services/, guards/, entities/, dto/
   - Shared: components/, utils/, types/
3. **Breaks into atomic tasks**:
   - Setup tasks (directory structure, module creation)
   - Implementation tasks (one component/service/controller at a time)
   - Test tasks (unit, integration)
4. **Identifies dependencies**:
   - What must exist before this task can start?
   - Does it depend on other features/projects?
5. **Adds acceptance criteria** - How do we know it's done?
6. **Assigns branches** - Each task gets its own branch

### Example Output

```typescript
// Decomp Stage 3 for "chat-ui" feature

{
  "feature": "chat-ui",
  "path": "frontend/src/features/chat-ui",
  "tasks": [
    {
      "id": "1.1.1",
      "name": "Create feature directory structure",
      "dependencies": [],
      "acceptanceCriteria": [
        "Directory created",
        "index.ts exports added",
        "Feature module structure follows architecture"
      ],
      "reason": "Foundation task - creates directories, module files, index.ts"
    },
    {
      "id": "1.1.2",
      "name": "Define ChatMessage TypeScript interface",
      "dependencies": ["1.1.1", "2.1.2"],
      "dependencyReasons": {
        "1.1.1": "Needs feature structure to add types file",
        "2.1.2": "Must match backend MessageDTO structure"
      },
      "acceptanceCriteria": [
        "ChatMessage interface defined",
        "Matches backend DTO",
        "Exported from feature index"
      ],
      "reason": "Type definitions needed by all components"
    },
    {
      "id": "1.1.3",
      "name": "Implement ChatContext with message state",
      "dependencies": ["1.1.2"],
      "dependencyReasons": {
        "1.1.2": "Context manages ChatMessage array"
      },
      "acceptanceCriteria": [
        "Context provides message state",
        "useChat hook works",
        "Tests pass"
      ],
      "reason": "Provides state management for chat"
    },
    {
      "id": "1.1.4",
      "name": "Build MessageInput component",
      "dependencies": ["1.1.3"],
      "dependencyReasons": {
        "1.1.3": "Uses ChatContext to send messages"
      },
      "acceptanceCriteria": [
        "Component renders",
        "Handles user input",
        "Calls send callback",
        "Tests pass"
      ],
      "reason": "User input for sending messages"
    },
    {
      "id": "1.1.5",
      "name": "Build MessageList component",
      "dependencies": ["1.1.2", "1.1.3"],
      "dependencyReasons": {
        "1.1.2": "Renders ChatMessage objects",
        "1.1.3": "Subscribes to ChatContext for updates"
      },
      "acceptanceCriteria": [
        "Displays messages",
        "Auto-scrolls",
        "Tests pass"
      ],
      "reason": "Displays chat message history"
    },
    {
      "id": "1.1.6",
      "name": "Implement WebSocket hook (useWebSocket)",
      "dependencies": ["1.1.3", "2.1.3"],
      "dependencyReasons": {
        "1.1.3": "Updates ChatContext on message receive",
        "2.1.3": "Connects to backend WebSocket gateway"
      },
      "acceptanceCriteria": [
        "Hook connects to backend",
        "Receives messages",
        "Updates context",
        "Tests pass"
      ],
      "reason": "Real-time message transport"
    },
    {
      "id": "1.1.7",
      "name": "Create chat page wiring components",
      "dependencies": ["1.1.4", "1.1.5", "1.1.6"],
      "dependencyReasons": {
        "1.1.4": "Page uses MessageInput",
        "1.1.5": "Page uses MessageList",
        "1.1.6": "Page initializes WebSocket connection"
      },
      "acceptanceCriteria": [
        "Page renders",
        "Components wired together",
        "Routing configured",
        "Tests pass"
      ],
      "reason": "Top-level page component"
    },
    {
      "id": "1.1.8",
      "name": "Write unit tests",
      "dependencies": ["1.1.3", "1.1.4", "1.1.5"],
      "dependencyReasons": {
        "1.1.3": "Test ChatContext",
        "1.1.4": "Test MessageInput",
        "1.1.5": "Test MessageList"
      },
      "acceptanceCriteria": [
        "80%+ coverage",
        "All tests pass"
      ],
      "reason": "Verify components work in isolation"
    },
    {
      "id": "1.1.9",
      "name": "Write integration tests",
      "dependencies": ["1.1.7", "1.1.8"],
      "dependencyReasons": {
        "1.1.7": "Test complete page",
        "1.1.8": "Build on unit tests"
      },
      "acceptanceCriteria": [
        "Message flow works end-to-end",
        "Tests pass"
      ],
      "reason": "Verify end-to-end chat flow"
    }
  ]
}
```

### ASCII Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ Feature: chat-ui (1.1)                                      │
│ Path: frontend/src/features/chat-ui                         │
│ Status: Decomposed into atomic tasks                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Tasks:                                                      │
│                                                              │
│  ✓ 1.1.1  Create feature directory         [ready] simple  │
│           └─ AC: Directory created, exports added           │
│                                                              │
│  ✓ 1.1.2  Define ChatMessage interface     [blocked]       │
│           └─ Depends on: 1.1.1, 2.1.2                       │
│           └─ AC: Interface defined, matches backend         │
│                                                              │
│  ✓ 1.1.3  Implement ChatContext            [blocked]       │
│           └─ Depends on: 1.1.2                              │
│           └─ AC: Context works, hook works, tests pass      │
│                                                              │
│  ✓ 1.1.4  Build MessageInput component     [blocked]       │
│           └─ Depends on: 1.1.3                              │
│           └─ AC: Renders, handles input, tests pass         │
│                                                              │
│  ✓ 1.1.5  Build MessageList component      [blocked]       │
│           └─ Depends on: 1.1.2, 1.1.3                       │
│           └─ AC: Displays messages, scrolls, tests pass     │
│                                                              │
│  ✓ 1.1.6  Implement useWebSocket hook      [blocked]       │
│           └─ Depends on: 1.1.3, 2.1.3 ⚠                    │
│           └─ AC: Connects, receives, updates context        │
│                                                              │
│  ✓ 1.1.7  Create chat page                 [blocked]       │
│           └─ Depends on: 1.1.4, 1.1.5, 1.1.6               │
│           └─ AC: Page renders, components wired, routing    │
│                                                              │
│  ✓ 1.1.8  Write unit tests                 [blocked]       │
│           └─ Depends on: 1.1.3, 1.1.4, 1.1.5               │
│           └─ AC: 80%+ coverage, all tests pass              │
│                                                              │
│  ✓ 1.1.9  Write integration tests          [blocked]       │
│           └─ Depends on: 1.1.7, 1.1.8                       │
│           └─ AC: Message flow works end-to-end              │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Legend: ⚠ cross-feature dependency                         │
│ Ready for execution! Run `/execute-plan p-abc123`          │
└─────────────────────────────────────────────────────────────┘
```

### User Review & Adjustment

After decomp displays the task breakdown, user can adjust:

```bash
# User reviews tasks
/decomp 1.1

# If adjustments needed
User: "Actually, 1.1.8 doesn't need to wait for all components.
       It can start as soon as each component is done."

# User can manually edit tasks.jsonl or use a command
/update-task 1.1.8 --dependencies 1.1.3
```

---

## Task Storage Format

### Hierarchical JSONL

All tasks for a plan are stored in a single `.backlog/p-{id}/tasks.jsonl` file.

**Why JSONL?**
- **Append-only**: Easy to add new tasks
- **Line-based**: Easy to parse and update individual tasks
- **Hierarchical IDs**: Show relationships clearly
- **Single file**: All tasks for a plan in one place

### ID Structure

```
p-abc123              Plan
├── 1                 Project
│   ├── 1.1          Feature
│   │   ├── 1.1.1    Task
│   │   ├── 1.1.2    Task
│   │   └── 1.1.3    Task
│   └── 1.2          Feature
│       ├── 1.2.1    Task
│       └── 1.2.2    Task
└── 2                 Project
    └── 2.1          Feature
        └── 2.1.1    Task
```

### Complete Example with Cross-Feature Dependencies

```jsonl
{"id":"p-abc123","type":"plan","name":"Add real-time chat","status":"executing","created":"2026-01-13T10:00:00Z"}
{"id":"1","type":"project","parent":"p-abc123","name":"Frontend Chat UI","status":"in_progress"}
{"id":"1.1","type":"feature","parent":"1","name":"chat-ui","path":"frontend/src/features/chat-ui","featureType":"full-stack","status":"in_progress"}
{"id":"1.1.1","type":"task","parent":"1.1","name":"Create feature directory","branch":"p-abc123-t-1.1.1","status":"complete","dependencies":[],"acceptanceCriteria":["Directory created","index.ts exports added"]}
{"id":"1.1.2","type":"task","parent":"1.1","name":"Define ChatMessage interface","branch":"p-abc123-t-1.1.2","status":"complete","dependencies":["1.1.1","2.1.2"],"dependencyReasons":{"1.1.1":"Needs feature structure","2.1.2":"Must match backend DTO"}}
{"id":"1.1.3","type":"task","parent":"1.1","name":"Implement ChatContext","branch":"p-abc123-t-1.1.3","status":"in_progress","dependencies":["1.1.2"]}
{"id":"1.1.4","type":"task","parent":"1.1","name":"Build MessageInput","branch":"p-abc123-t-1.1.4","status":"blocked","dependencies":["1.1.3"]}
{"id":"1.1.5","type":"task","parent":"1.1","name":"Build MessageList","branch":"p-abc123-t-1.1.5","status":"blocked","dependencies":["1.1.2","1.1.3"]}
{"id":"1.1.6","type":"task","parent":"1.1","name":"Implement useWebSocket","branch":"p-abc123-t-1.1.6","status":"blocked","dependencies":["1.1.3","2.1.3"]}
{"id":"2","type":"project","parent":"p-abc123","name":"Backend WebSocket API","status":"in_progress"}
{"id":"2.1","type":"feature","parent":"2","name":"chat-gateway","path":"backend/src/features/chat-gateway","featureType":"full-stack","status":"in_progress"}
{"id":"2.1.1","type":"task","parent":"2.1","name":"Create feature directory","branch":"p-abc123-t-2.1.1","status":"complete","dependencies":[]}
{"id":"2.1.2","type":"task","parent":"2.1","name":"Define message DTOs","branch":"p-abc123-t-2.1.2","status":"complete","dependencies":["2.1.1"]}
{"id":"2.1.3","type":"task","parent":"2.1","name":"Implement WebSocket gateway","branch":"p-abc123-t-2.1.3","status":"in_progress","dependencies":["2.1.2","3.1.2"]}
{"id":"3","type":"project","parent":"p-abc123","name":"Database Schema","status":"in_progress"}
{"id":"3.1","type":"feature","parent":"3","name":"messages-schema","path":"backend/src/features/typeorm-database-client","featureType":"shared","status":"in_progress"}
{"id":"3.1.1","type":"task","parent":"3.1","name":"Create messages entity","branch":"p-abc123-t-3.1.1","status":"complete","dependencies":[]}
{"id":"3.1.2","type":"task","parent":"3.1","name":"Create migration","branch":"p-abc123-t-3.1.2","status":"in_progress","dependencies":["3.1.1"]}
```

### Storage Directory Structure

```
.backlog/p-abc123/
├── plan.md              # Brainstorm output (Stage 0)
├── tasks.jsonl          # All tasks (Stage 1+)
├── state.json           # Plan metadata (status, timestamps)
├── events.jsonl         # Activity log (for monitoring/UI)
├── locks/               # File locks for task execution
│   ├── 1.1.3.lock
│   └── 2.1.3.lock
└── contexts/            # Execution artifacts
    ├── 1.1.1/
    │   ├── branch: p-abc123-t-1.1.1
    │   └── logs/
    └── 1.1.2/
        ├── branch: p-abc123-t-1.1.2
        └── logs/
```

---

## Dependency System

### Explicit Dependency Model

Tasks declare dependencies using explicit task IDs with human-readable reasons.

```jsonl
{
  "id": "1.1.6",
  "name": "Implement useWebSocket hook",
  "dependencies": ["1.1.3", "2.1.3"],
  "dependencyReasons": {
    "1.1.3": "Updates ChatContext on message receive",
    "2.1.3": "Connects to backend WebSocket gateway"
  }
}
```

### Dependency Types

**Sequential Dependencies:**
```
1.1.1 → 1.1.2 → 1.1.3
```

**Parallel Dependencies:**
```
       1.1.2
      /     \
   1.1.3   1.1.4
      \     /
       1.1.5
```

**Cross-Feature Dependencies:**
```
Frontend Task 1.1.6
    ↓
Backend Task 2.1.3
    ↓
Database Task 3.1.2
```

### Task Status States

| Status | Meaning |
|--------|---------|
| `blocked` | Has unmet dependencies |
| `ready` | All dependencies met, available for worker |
| `in_progress` | Worker is executing |
| `validating` | Worker done, validator checking |
| `complete` | Validated and finished |
| `failed` | Exceeded retries, needs manual intervention |

### Dependency Detection During Decomposition

When Stage 3 creates atomic tasks, the decomp skill analyzes dependencies:

**Agent Instructions:**
```markdown
For each task, analyze:
1. What does this task need to exist before it can start?
2. Does it depend on infrastructure (directories, configs)?
3. Does it depend on other components/services?
4. Does it depend on contracts from other features?
5. Does it depend on database schema?

Declare dependencies explicitly with reasons.
```

The agent outputs structured dependency information that gets written to tasks.jsonl.

---

## Execution System

### Overview

The execution system uses **tmux sessions** + **file locks** + **headless Claude** to:
1. Check dependencies and unblock ready tasks
2. Spawn workers for all ready tasks (AMAP parallelism)
3. Run worker/validator loop until success or max retries
4. Automatically spawn next ready tasks when dependencies are met

### Architecture

```
/execute-plan p-abc123
    ↓
start-next-task.sh
    ├─ Check all blocked tasks
    ├─ Unblock tasks with met dependencies
    ├─ Find all ready tasks
    └─ Spawn workers for each (AMAP)
        ↓
    spawn-task.sh (per task)
        ├─ Acquire file lock
        ├─ Create tmux session
        └─ Run run-task.sh
            ↓
        run-task.sh
            ├─ Run worker (claude -p "/execute-task")
            ├─ Run validator (claude -p "/validate-task")
            ├─ Check result
            └─ If complete: trigger start-next-task.sh
```

### start-next-task.sh

```bash
#!/bin/bash
# scripts/start-next-task.sh
# Finds ready tasks and spawns workers (AMAP)

set -e

PLAN_ID=$1
PLAN_DIR=".backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
STATE_FILE="$PLAN_DIR/state.json"

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

# Check if a task's dependencies are all complete
check_dependencies() {
  local task_id=$1

  # Get dependencies array
  local deps=$(jq -r "select(.id==\"$task_id\") | .dependencies[]?" "$TASKS_FILE" 2>/dev/null)

  # If no dependencies, return success
  if [ -z "$deps" ]; then
    return 0
  fi

  # Check each dependency
  for dep in $deps; do
    local dep_status=$(jq -r "select(.id==\"$dep\") | .status" "$TASKS_FILE")

    if [ "$dep_status" != "complete" ]; then
      log "Task $task_id blocked: waiting for $dep (status: $dep_status)"
      return 1
    fi
  done

  return 0
}

# Update task status in tasks.jsonl
update_task_status() {
  local task_id=$1
  local new_status=$2

  # Create temp file with updated status
  jq "if .id == \"$task_id\" then .status = \"$new_status\" else . end" "$TASKS_FILE" > "$TASKS_FILE.tmp"
  mv "$TASKS_FILE.tmp" "$TASKS_FILE"

  log "Updated $task_id status: $new_status"
}

# Main loop: unblock tasks and spawn workers
log "Checking for tasks to unblock and execute..."

# First pass: unblock any blocked tasks whose dependencies are met
while IFS= read -r line; do
  task_id=$(echo "$line" | jq -r '.id')
  status=$(echo "$line" | jq -r '.status')
  type=$(echo "$line" | jq -r '.type')

  # Only process tasks (not plans/projects/features)
  if [ "$type" != "task" ]; then
    continue
  fi

  # If blocked, check if we can unblock
  if [ "$status" == "blocked" ]; then
    if check_dependencies "$task_id"; then
      log "✓ Unblocking task $task_id - all dependencies met"
      update_task_status "$task_id" "ready"
    fi
  fi
done < <(jq -c '.' "$TASKS_FILE")

# Second pass: spawn workers for ALL ready tasks (AMAP)
ready_tasks=$(jq -r 'select(.type=="task" and .status=="ready") | .id' "$TASKS_FILE")

if [ -z "$ready_tasks" ]; then
  log "No ready tasks available"

  # Check if we're done
  blocked_count=$(jq 'select(.type=="task" and .status=="blocked") | .id' "$TASKS_FILE" | wc -l)
  in_progress_count=$(jq 'select(.type=="task" and (.status=="in_progress" or .status=="validating")) | .id' "$TASKS_FILE" | wc -l)

  if [ "$blocked_count" -eq 0 ] && [ "$in_progress_count" -eq 0 ]; then
    log "All tasks complete!"
    jq '.status = "complete"' "$STATE_FILE" > "$STATE_FILE.tmp"
    mv "$STATE_FILE.tmp" "$STATE_FILE"
  else
    log "Waiting: $in_progress_count in progress, $blocked_count blocked"
  fi

  exit 0
fi

# Spawn workers for all ready tasks (parallel execution!)
log "Found $(echo "$ready_tasks" | wc -l) ready tasks. Spawning workers..."

for task_id in $ready_tasks; do
  task_name=$(jq -r "select(.id==\"$task_id\") | .name" "$TASKS_FILE")
  log "→ Spawning worker for $task_id: $task_name"

  # Spawn in background to continue loop
  ./scripts/spawn-task.sh "$PLAN_ID" "$task_id" &

  # Small delay to avoid race conditions
  sleep 0.5
done

log "Spawned $(echo "$ready_tasks" | wc -l) workers"
```

### spawn-task.sh

```bash
#!/bin/bash
# scripts/spawn-task.sh
# Spawns a tmux session for a specific task with locking

set -e

PLAN_ID=$1
TASK_ID=$2
PLAN_DIR=".backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
LOCK_FILE="$PLAN_DIR/locks/$TASK_ID.lock"

# Create locks directory
mkdir -p "$PLAN_DIR/locks"

# Test if we can acquire the lock
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "Task $TASK_ID already running"
  exit 1
fi

# Get task details
TASK_NAME=$(jq -r "select(.id==\"$TASK_ID\") | .name" "$TASKS_FILE")
SESSION="$PLAN_ID-$TASK_ID"

echo "Spawning session for task $TASK_ID: $TASK_NAME"

# Create tmux session
tmux new-session -d -s "$SESSION" \
  "trap 'rm -rf \"$LOCK_FILE\"' EXIT; ./scripts/run-task.sh '$PLAN_ID' '$TASK_ID'; echo 'Press enter to close...'; read"

echo "Started session: $SESSION"
echo "  Attach with: tmux attach -t $SESSION"
```

### run-task.sh

```bash
#!/bin/bash
# scripts/run-task.sh
# Runs worker + validator loop for a single task

PLAN_ID=$1
TASK_ID=$2
PLAN_DIR=".backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
MAX_RESTARTS=${MAX_RESTARTS:-3}

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

update_task_status() {
  local new_status=$1
  jq "if .id == \"$TASK_ID\" then .status = \"$new_status\" else . end" "$TASKS_FILE" > "$TASKS_FILE.tmp"
  mv "$TASKS_FILE.tmp" "$TASKS_FILE"
}

log "Starting task: $TASK_ID"
update_task_status "in_progress"

for attempt in $(seq 1 $MAX_RESTARTS); do
  log "=== Attempt $attempt/$MAX_RESTARTS ==="

  # Run worker
  log "Running worker..."
  claude -p "/execute-task $PLAN_ID $TASK_ID" --max-turns 50

  # Update status for validation
  update_task_status "validating"

  # Run validator
  log "Running validator..."
  claude -p "/validate-task $PLAN_ID $TASK_ID" --max-turns 10

  # Check result
  STATUS=$(jq -r "select(.id==\"$TASK_ID\") | .status" "$TASKS_FILE")

  if [ "$STATUS" = "complete" ]; then
    log "✓ Task completed successfully!"

    # Trigger next tasks check
    ./scripts/start-next-task.sh "$PLAN_ID" &
    exit 0
  fi

  if [ $attempt -lt $MAX_RESTARTS ]; then
    log "Validation failed, retrying..."
    update_task_status "ready"
    sleep 2
  fi
done

log "Max attempts reached, marking as failed"
update_task_status "failed"
exit 1
```

### Slash Commands

#### /execute-task

Worker agent that implements the task.

```markdown
# .claude/commands/execute-task.md

You are a worker agent executing a task.

## Context

Plan ID: $ARG1
Task ID: $ARG2

Read the task details from `.backlog/$ARG1/tasks.jsonl` (find the line with id=$ARG2)

## Instructions

1. Read the task file to understand:
   - Task name and description
   - Acceptance criteria
   - Feature path (where to create files)
   - Dependencies (for context)

2. Create or checkout the branch specified in the task

3. Implement the work described:
   - Follow the feature architecture (controllers/, services/, guards/, etc.)
   - Create necessary files and directories
   - Implement functionality
   - Write tests as specified in acceptance criteria

4. Commit your work with a clear message referencing the task ID

5. Update task status to "validating" when done

## Important

- Stay focused on this task only
- Make atomic, well-described commits
- Do not mark the task complete - the validator will do that
- If you encounter blockers, document them in the task
```

#### /validate-task

Validator agent that checks completed work.

```markdown
# .claude/commands/validate-task.md

You are a validator agent reviewing completed work.

## Context

Plan ID: $ARG1
Task ID: $ARG2

Read the task details from `.backlog/$ARG1/tasks.jsonl`

## Instructions

1. Read the task to understand acceptance criteria

2. Check out the branch specified in the task

3. Review the implementation:
   - Verify each acceptance criterion is met
   - Run tests if applicable
   - Check code quality and architecture compliance

## If Validation Passes

Update the task in tasks.jsonl:
- Set `status: "complete"`
- Add `completedAt` timestamp

## If Validation Fails

Update the task in tasks.jsonl:
- Set `status: "ready"` (so worker retries)
- Add `validationNotes` explaining what failed and what needs fixing

The failed task will be picked up by a worker again automatically.
```

### AMAP Parallelism

**As Many As Possible** means the system spawns workers for ALL tasks that are ready simultaneously.

**Example execution flow:**

```
Initial: 3 ready tasks
→ Spawn 3 workers immediately (1.1.1, 2.1.1, 3.1.1)

After 1.1.1 completes:
→ Check dependencies
→ 1.1.2 is now ready but depends on 2.1.2 (still blocked)
→ No new tasks to spawn yet

After 2.1.1 completes:
→ Check dependencies
→ 2.1.2 is now ready!
→ Spawn 1 worker (2.1.2)

After 2.1.2 completes:
→ Check dependencies
→ 1.1.2 is now ready! (both 1.1.1 and 2.1.2 complete)
→ Spawn 1 worker (1.1.2)

After 1.1.2 and 3.1.1 complete:
→ Check dependencies
→ 1.1.3, 1.1.4 are now ready
→ Spawn 2 workers (parallel!)
```

Natural parallelism emerges from the dependency graph.

---

## Visualization

### Plan Status View

```bash
/plan-status p-abc123
```

```
┌─────────────────────────────────────────────────────────────┐
│ Plan: Add real-time chat (p-abc123)                        │
│ Status: Executing (3 in progress, 4 ready, 5 blocked)      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Project 1: Frontend Chat UI                                │
│  ├─ Feature 1.1: chat-ui                                    │
│  │  ├─ 1.1.1  Create feature directory      [complete] ✓   │
│  │  ├─ 1.1.2  Define ChatMessage interface  [complete] ✓   │
│  │  │           └─ depends on: 1.1.1, 2.1.2               │
│  │  ├─ 1.1.3  Implement ChatContext         [in_progress]  │
│  │  │           └─ depends on: 1.1.2                        │
│  │  ├─ 1.1.4  Build MessageInput            [ready]        │
│  │  │           └─ depends on: 1.1.3                        │
│  │  ├─ 1.1.5  Build MessageList             [ready]        │
│  │  │           └─ depends on: 1.1.2, 1.1.3                │
│  │  ├─ 1.1.6  Implement useWebSocket        [blocked]      │
│  │  │           └─ depends on: 1.1.3, 2.1.3 ⚠             │
│  │  └─ 1.1.7  Create chat page              [blocked]      │
│  │              └─ depends on: 1.1.4, 1.1.5, 1.1.6         │
│  │                                                           │
│  Project 2: Backend WebSocket API                           │
│  ├─ Feature 2.1: chat-gateway                               │
│  │  ├─ 2.1.1  Create feature directory      [complete] ✓   │
│  │  ├─ 2.1.2  Define message DTOs           [complete] ✓   │
│  │  │           └─ depends on: 2.1.1                        │
│  │  └─ 2.1.3  Implement gateway             [in_progress]  │
│  │              └─ depends on: 2.1.2, 3.1.2                │
│  │                                                           │
│  Project 3: Database Schema                                 │
│  └─ Feature 3.1: messages-schema                            │
│     ├─ 3.1.1  Create messages entity        [complete] ✓   │
│     └─ 3.1.2  Create migration              [in_progress]  │
│                └─ depends on: 3.1.1                         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ Legend: ✓ complete  ⚠ cross-feature dependency             │
│                                                              │
│ Active Workers:                                             │
│  • 1.1.3 - tmux: p-abc123-1.1.3                            │
│  • 2.1.3 - tmux: p-abc123-2.1.3                            │
│  • 3.1.2 - tmux: p-abc123-3.1.2                            │
│                                                              │
│ Next Ready: 1.1.4, 1.1.5 (waiting for 1.1.3)              │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Graph View

```bash
/plan-status p-abc123 --graph
```

```
Dependency Graph:

  1.1.1 ──┐
          ├─→ 1.1.2 ──┬─→ 1.1.3 ──┬─→ 1.1.4 ──┐
  2.1.2 ──┘           │           │           ├─→ 1.1.7
                      │           └─→ 1.1.5 ──┘
                      └───────────────────────┘

  2.1.1 ──→ 2.1.2 ──┐
                    ├─→ 2.1.3 ──→ 1.1.6 ──→ 1.1.7
  3.1.1 ──→ 3.1.2 ──┘

Critical Path: 1.1.1 → 1.1.2 → 1.1.3 → 1.1.6 → 1.1.7
               (must complete 2.1.3 and 3.1.2 first)

Parallel Branches:
  Branch A: 1.1.1 → 1.1.2 → 1.1.3 → [1.1.4, 1.1.5] → 1.1.7
  Branch B: 2.1.1 → 2.1.2 → 2.1.3 → 1.1.6 → 1.1.7
  Branch C: 3.1.1 → 3.1.2 → 2.1.3
```

---

## Complete Flow Example

### Initial Setup

```bash
# User starts with a request
User: "Add real-time chat to the application"

# Run planner skill
/planner

# Planner brainstorms, creates plan.md
# User approves plan

# Run Stage 1 decomposition
/decomp p-abc123
```

**Stage 1 Output:**
```
Projects created:
1. Frontend Chat UI
2. Backend WebSocket API
3. Database Schema
```

### Decompose Projects into Features

```bash
# Decompose each project
/decomp 1
/decomp 2
/decomp 3
```

**Stage 2 Output:**
```
Features created:
1.1 - chat-ui (frontend full-stack)
2.1 - chat-gateway (backend full-stack)
3.1 - messages-schema (backend shared)
```

### Decompose Features into Tasks

```bash
# Decompose each feature
/decomp 1.1
/decomp 2.1
/decomp 3.1
```

**Stage 3 Output:**
```
Atomic tasks created with dependencies:
1.1.1 [ready] → 1.1.2 [blocked] → 1.1.3 [blocked] → ...
2.1.1 [ready] → 2.1.2 [blocked] → 2.1.3 [blocked]
3.1.1 [ready] → 3.1.2 [blocked]

Cross-feature dependencies:
- 1.1.2 depends on 2.1.2 (frontend needs backend DTO)
- 2.1.3 depends on 3.1.2 (gateway needs database schema)
- 1.1.6 depends on 2.1.3 (frontend hook needs backend gateway)
```

### Execute Plan

```bash
/execute-plan p-abc123
```

**Execution Timeline:**

```
T=0: Initial State
├─ 1.1.1 [ready]
├─ 2.1.1 [ready]
└─ 3.1.1 [ready]

System: Spawning 3 workers (AMAP)
→ Worker for 1.1.1 (tmux: p-abc123-1.1.1)
→ Worker for 2.1.1 (tmux: p-abc123-2.1.1)
→ Worker for 3.1.1 (tmux: p-abc123-3.1.1)

T=10min: 1.1.1 completes
├─ 1.1.1 [complete] ✓
├─ 1.1.2 [blocked] (waiting for 2.1.2)
├─ 2.1.1 [in_progress]
└─ 3.1.1 [in_progress]

System: Checking dependencies... No new tasks ready

T=12min: 2.1.1 completes
├─ 2.1.1 [complete] ✓
├─ 2.1.2 [ready] (unblocked!)
└─ 3.1.1 [in_progress]

System: Spawning 1 worker
→ Worker for 2.1.2

T=15min: 2.1.2 completes
├─ 1.1.2 [ready] (unblocked! both 1.1.1 and 2.1.2 done)
├─ 2.1.2 [complete] ✓
└─ 3.1.1 [in_progress]

System: Spawning 1 worker
→ Worker for 1.1.2

T=18min: 3.1.1 completes
├─ 3.1.1 [complete] ✓
├─ 3.1.2 [ready] (unblocked!)
└─ 1.1.2 [in_progress]

System: Spawning 1 worker
→ Worker for 3.1.2

T=20min: 1.1.2 and 3.1.2 complete
├─ 1.1.2 [complete] ✓
├─ 1.1.3 [ready] (unblocked!)
├─ 3.1.2 [complete] ✓
└─ 2.1.3 [ready] (unblocked! both 2.1.2 and 3.1.2 done)

System: Spawning 2 workers (parallel!)
→ Worker for 1.1.3
→ Worker for 2.1.3

T=30min: 1.1.3 completes
├─ 1.1.3 [complete] ✓
├─ 1.1.4 [ready]
├─ 1.1.5 [ready]
└─ 2.1.3 [in_progress]

System: Spawning 2 workers (parallel!)
→ Worker for 1.1.4
→ Worker for 1.1.5

T=35min: 2.1.3 completes
├─ 2.1.3 [complete] ✓
└─ 1.1.6 [ready] (unblocked! both 1.1.3 and 2.1.3 done)

System: Spawning 1 worker
→ Worker for 1.1.6

T=40min: All components complete
├─ 1.1.4 [complete] ✓
├─ 1.1.5 [complete] ✓
├─ 1.1.6 [complete] ✓
└─ 1.1.7 [ready] (unblocked! all deps met)

System: Spawning 1 worker
→ Worker for 1.1.7 (final integration)

T=50min: Feature complete!
└─ 1.1.7 [complete] ✓

System: All tasks complete! Plan p-abc123 finished.
```

**Total execution:**
- **50 minutes** with parallel execution (AMAP)
- **15 tasks completed**
- **Maximum parallelism achieved** (natural based on dependency graph)

### Monitoring During Execution

```bash
# View current status
/plan-status p-abc123

# Attach to specific worker
tmux attach -t p-abc123-1.1.3

# List all active workers
tmux list-sessions | grep p-abc123

# Check for blocked tasks
jq 'select(.type=="task" and .status=="blocked")' .backlog/p-abc123/tasks.jsonl
```

---

## Component Structure

### Architecture Philosophy

**No sub-agents** - Everything runs in the main Claude session for better performance.
- Planner skill directly updates plan.md (no plan-sync agent)
- Decomp skill directly writes to tasks.jsonl (no background agents)
- Execute-plan skill invokes bash scripts (no orchestrator agent)

**Skills over agents** - Multi-turn interactive flows use skills, not spawned agents.

### `.claude/` Directory (Claude Code Configuration)

**Skills** (`.claude/skills/`):
- `planner/SKILL.md` - Stage 0 brainstorming, directly updates plan.md
- `decomp/SKILL.md` - Stages 1, 2, 3 (single skill, detects stage from argument)
- `execute-plan/SKILL.md` - Orchestrates execution via bash scripts

**Commands** (`.claude/commands/`):
- `plan.md` - View status with ASCII visualization
- `execute-task.md` - Worker command (called by scripts via `claude -p`)
- `validate-task.md` - Validator command (called by scripts via `claude -p`)
- `update-task.md` - Optional manual dependency adjustment

### `scripts/` Directory (Project Root)

**Bash Scripts:**
- `start-next-task.sh` - Check dependencies, unblock tasks, spawn workers (AMAP)
- `spawn-task.sh` - Create tmux session with file locking for a task
- `run-task.sh` - Worker/validator retry loop for a single task

**Important:** All bash scripts live in project root `scripts/`, NOT in `.claude/`.

---

## Implementation Order

To build this system, implement in this order:

1. **Planner skill** (`.claude/skills/planner/SKILL.md`) - Stage 0 brainstorming, directly updates plan.md
2. **Decomp skill** (`.claude/skills/decomp/SKILL.md`) - Stages 1, 2, 3 (single skill, detects stage from argument)
3. **Plan command** (`.claude/commands/plan.md`) - Status viewer with ASCII visualization
4. **Execute-task command** (`.claude/commands/execute-task.md`) - Worker logic
5. **Validate-task command** (`.claude/commands/validate-task.md`) - Validator logic
6. **Update-task command** (`.claude/commands/update-task.md`) - Optional dependency adjustment
7. **Execution scripts** (`scripts/` in project root):
   - `scripts/run-task.sh` - Worker/validator retry loop
   - `scripts/spawn-task.sh` - Create tmux session with locking
   - `scripts/start-next-task.sh` - Dependency checking and AMAP spawning
8. **Execute-plan skill** (`.claude/skills/execute-plan/SKILL.md`) - High-level orchestrator that invokes bash scripts

---

## Summary

This system provides:

✅ **3-stage decomposition**: Plan → Projects → Features → Tasks
✅ **Explicit dependencies**: Tasks declare what they need with reasons
✅ **Cross-feature dependencies**: Frontend ↔ Backend ↔ Database
✅ **AMAP parallelism**: Natural parallelism from dependency graph
✅ **Worker/validator pattern**: Automatic retry with validation
✅ **Feature architecture alignment**: Maps directly to `features/` structure
✅ **User control**: Approval at each stage, can adjust dependencies
✅ **Complete visibility**: ASCII visualization, dependency graphs, status monitoring

The result: **Autonomous execution of complex, multi-feature implementations with proper dependency management and maximum parallelism.**

---

*Document created: 2026-01-13*
*Last updated: 2026-01-13*
