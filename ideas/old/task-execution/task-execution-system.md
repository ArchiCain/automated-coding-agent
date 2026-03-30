# Task Execution System

A self-orchestrating task execution system using Claude Code headless mode, tmux, and file locks.

## Overview

This system runs tasks in **headless Claude sessions** with automatic validation and retry:

1. Spawn a tmux session for a task
2. Run Claude headless (`claude -p`) to execute the task
3. Run Claude headless again to validate the work
4. If validation fails, retry (up to MAX_RESTARTS)
5. If validation passes, mark complete and spawn next task

The key insights:
- **Headless mode blocks until done** - no need to watch process state
- **File locks ARE the "in progress" state** - no status field that can get stuck
- **One script, one window per task** - dead simple

---

## Directory Structure

```
project/
├── .claude/
│   └── commands/
│       ├── execute-task.md      # Slash command for workers
│       └── validate-task.md     # Slash command for validators
├── scripts/
│   ├── run-task.sh              # Runs worker + validator loop for one task
│   ├── spawn-task.sh            # Creates tmux session for a task
│   └── start-next-task.sh       # Finds and spawns next ready task
├── planning/
│   ├── tasks/
│   │   ├── task-001.md          # Individual task files
│   │   ├── task-002.md
│   │   └── ...
│   └── completed/               # Tasks moved here when done (optional)
```

---

## Task File Format

```markdown
---
id: task-001
status: ready | validating | complete
branch: feature/task-001
assigned_commit: <empty until work starts>
completed_commit: <empty until work done>
---

## Objective
Implement the user authentication module

## Acceptance Criteria
- [ ] Login endpoint works
- [ ] JWT tokens issued
- [ ] Tests pass

## Context
Related to task-000 which set up the express server

## Validation Notes
<!-- Added by validator if task fails validation -->
```

### Status Meanings

| Status | Meaning |
|--------|---------|
| `ready` | Available for a worker to pick up |
| `validating` | Work done, awaiting validation |
| `complete` | Validated and finished |
| `failed` | Exceeded MAX_RESTARTS, needs manual intervention |

**Note:** There is no "in progress" status. A locked file = in progress. If Claude crashes, the lock releases and the task (still marked `ready`) gets picked up again.

---

## Scripts

### run-task.sh

The core script that runs the worker/validator loop for a single task.

```bash
#!/bin/bash
# scripts/run-task.sh
# Runs worker + validator loop until success or max retries

TASK_FILE="$1"
SCRIPT_DIR="$(dirname "$0")"

if [ -z "$TASK_FILE" ] || [ ! -f "$TASK_FILE" ]; then
    echo "Usage: $0 <task-file>"
    exit 1
fi

TASK_ID=$(basename "$TASK_FILE" .md)
MAX_RESTARTS=${MAX_RESTARTS:-3}
WORKER_MAX_TURNS=${WORKER_MAX_TURNS:-50}
VALIDATOR_MAX_TURNS=${VALIDATOR_MAX_TURNS:-10}

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

log "Starting task: $TASK_ID"
log "Max attempts: $MAX_RESTARTS"

for attempt in $(seq 1 $MAX_RESTARTS); do
    log "=== Attempt $attempt/$MAX_RESTARTS ==="
    
    # Run worker (blocks until Claude exits)
    log "Running worker..."
    claude -p "/execute-task $TASK_FILE" --max-turns $WORKER_MAX_TURNS
    WORKER_EXIT=$?
    log "Worker exited with code: $WORKER_EXIT"
    
    # Run validator (blocks until Claude exits)
    log "Running validator..."
    claude -p "/validate-task $TASK_FILE" --max-turns $VALIDATOR_MAX_TURNS
    VALIDATOR_EXIT=$?
    log "Validator exited with code: $VALIDATOR_EXIT"
    
    # Check the task status
    STATUS=$(grep "^status:" "$TASK_FILE" | awk '{print $2}')
    log "Task status: $STATUS"
    
    if [ "$STATUS" = "complete" ]; then
        log "Task completed successfully!"
        
        # Spawn next task before exiting (optional chaining)
        if [ -x "$SCRIPT_DIR/start-next-task.sh" ]; then
            log "Looking for next task..."
            "$SCRIPT_DIR/start-next-task.sh" &
        fi
        
        exit 0
    fi
    
    if [ $attempt -lt $MAX_RESTARTS ]; then
        log "Validation failed, will retry..."
        sleep 2
    fi
done

log "Max attempts ($MAX_RESTARTS) reached, marking as failed"
sed -i 's/^status:.*/status: failed/' "$TASK_FILE"
exit 1
```

---

### spawn-task.sh

Creates a tmux session for a task with file locking.

```bash
#!/bin/bash
# scripts/spawn-task.sh
# Usage: ./spawn-task.sh <task-file>

set -e

TASK_FILE="$1"
SCRIPT_DIR="$(dirname "$0")"

if [ -z "$TASK_FILE" ] || [ ! -f "$TASK_FILE" ]; then
    echo "Usage: $0 <task-file>"
    exit 1
fi

TASK_ID=$(basename "$TASK_FILE" .md)
SESSION="task-$TASK_ID"
LOCK_FILE="$TASK_FILE.lock"

# Check if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session $SESSION already exists"
    exit 1
fi

# Test if we can acquire the lock
if ! flock -n "$LOCK_FILE" true 2>/dev/null; then
    echo "Task $TASK_ID is locked by another process"
    exit 1
fi

echo "Spawning session for $TASK_ID..."

# Create tmux session running the task script (wrapped in flock)
tmux new-session -d -s "$SESSION" \
    "flock '$LOCK_FILE' '$SCRIPT_DIR/run-task.sh' '$TASK_FILE'; echo 'Press enter to close...'; read"

echo "Started session: $SESSION"
echo "  Attach with: tmux attach -t $SESSION"
```

---

### start-next-task.sh

Finds the next ready task and spawns it.

```bash
#!/bin/bash
# scripts/start-next-task.sh
# Finds a ready task and spawns a session for it

SCRIPT_DIR="$(dirname "$0")"
PLANNING_DIR="${PLANNING_DIR:-$SCRIPT_DIR/../planning/tasks}"

# Find a ready task that isn't locked
for task in "$PLANNING_DIR"/*.md; do
    [ -f "$task" ] || continue
    
    # Check if status is ready
    if ! grep -q "^status: ready" "$task"; then
        continue
    fi
    
    LOCK_FILE="$task.lock"
    
    # Try to acquire lock (non-blocking test)
    if ! flock -n "$LOCK_FILE" true 2>/dev/null; then
        continue  # Already locked, skip
    fi
    
    # Found one - spawn it
    echo "Found ready task: $(basename "$task")"
    "$SCRIPT_DIR/spawn-task.sh" "$task"
    exit 0
done

echo "No ready tasks found"
exit 0
```

---

## Slash Commands

### execute-task.md

```markdown
# .claude/commands/execute-task.md

You are a worker agent executing a task.

## Instructions

1. Read the task file at: $ARGUMENTS
2. Create or checkout the branch specified in the task
3. Record the current commit as `assigned_commit` in the task file
4. Implement the work described in the objective
5. Ensure all acceptance criteria are met
6. Commit your work with a clear message referencing the task ID
7. Run any relevant tests

## Important

- Stay focused on this task only
- Make atomic, well-described commits
- Do not mark the task complete - the validator will do that
- If you encounter blockers, document them in the task file
```

---

### validate-task.md

```markdown
# .claude/commands/validate-task.md

You are a validator agent reviewing completed work.

## Instructions

1. Read the task file at: $ARGUMENTS
2. Check out the branch specified in the task
3. Review the commits between `assigned_commit` and `completed_commit`
4. Verify each acceptance criterion is met
5. Run tests if applicable

## If Validation Passes

Update the task file:
- Set `status: complete`
- Mark acceptance criteria checkboxes as done

## If Validation Fails

Update the task file:
- Set `status: ready` (so a worker picks it up again)
- Add a `## Validation Notes` section explaining what failed and what needs to be fixed

The failed task will be picked up by a worker again automatically.
```

---

## Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│  tmux session: task-001                                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ run-task.sh (wrapped in flock)                            │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Attempt 1/3                                         │  │ │
│  │  │                                                     │  │ │
│  │  │  claude -p "/execute-task ..." ◄── blocks until done│  │ │
│  │  │       │                                             │  │ │
│  │  │       └─► exits                                     │  │ │
│  │  │                                                     │  │ │
│  │  │  claude -p "/validate-task ..." ◄── blocks          │  │ │
│  │  │       │                                             │  │ │
│  │  │       └─► exits, checks status                      │  │ │
│  │  │                                                     │  │ │
│  │  │  status: complete? ─── YES ──► exit 0, spawn next   │  │ │
│  │  │       │                                             │  │ │
│  │  │       NO                                            │  │ │
│  │  │       ▼                                             │  │ │
│  │  └───── retry ─────────────────────────────────────────┘  │ │
│  │         │                                                 │ │
│  │         ▼                                                 │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Attempt 2/3 ...                                     │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │         │                                                 │ │
│  │         ▼                                                 │ │
│  │  (after MAX_RESTARTS: mark failed, exit 1)               │ │
│  │                                                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ on success
                              ▼
                    ┌───────────────────┐
                    │ start-next-task.sh│
                    │                   │
                    │ finds ready task  │
                    │ spawns new session│
                    └───────────────────┘
                              │
                              ▼
                    (cycle continues)
```

### State Transitions

```
┌─────────┐     worker      ┌────────────┐    validator    ┌──────────┐
│  ready  │ ───starts───►   │ validating │  ───passes───►  │ complete │
└─────────┘                 └────────────┘                 └──────────┘
     ▲                            │
     │                            │ fails
     │                            ▼
     └────────── retry ───────────┘
     
     (after MAX_RESTARTS)
            │
            ▼
      ┌──────────┐
      │  failed  │
      └──────────┘
```

---

## How File Locking Works

```bash
flock -n /path/to/task.lock -c "command"
```

- `-n` = non-blocking (fail immediately if can't acquire)
- Lock is automatically released when:
  - Process exits normally
  - Process crashes
  - Process is killed (even `kill -9`)
- The kernel manages it - no stuck states possible

This is why we don't need an "in progress" status. The lock IS the status.

---

## Key Design Decisions

| Concern | Solution |
|---------|----------|
| Race conditions | `flock` on task file - kernel manages lock |
| Crashed agents | Lock auto-releases on process death |
| Knowing when Claude is done | Headless mode (`-p`) blocks until exit |
| Infinite retry loops | `MAX_RESTARTS` limit (default: 3) |
| Stuck "in progress" | No such status - lock IS the progress indicator |
| Continuous execution | Script spawns next task before exiting |
| Failed validation | Fresh Claude session on each retry |
| Context pollution | Each attempt is a new headless session |

---

## Starting the System

### Option 1: Manual start with a specific task
```bash
./scripts/spawn-task.sh planning/tasks/task-001.md
```

### Option 2: Auto-find and start next ready task
```bash
./scripts/start-next-task.sh
```

### Option 3: Create tasks and kick off
```bash
# Create some tasks
cp template.md planning/tasks/task-001.md
cp template.md planning/tasks/task-002.md

# Edit them with your actual work...

# Start the first one (it will chain to the next)
./scripts/start-next-task.sh
```

### Option 4: Start multiple parallel workers
```bash
# Spawn workers for multiple tasks simultaneously
./scripts/spawn-task.sh planning/tasks/task-001.md
./scripts/spawn-task.sh planning/tasks/task-002.md
./scripts/spawn-task.sh planning/tasks/task-003.md
```

---

## Monitoring

### Watch a task in progress
```bash
tmux attach -t task-001
# Ctrl-b d to detach
```

### List all task sessions
```bash
tmux list-sessions | grep "^task-"
```

### Check task statuses
```bash
grep -h "^status:" planning/tasks/*.md
```

### See what's locked (in progress)
```bash
ls planning/tasks/*.lock 2>/dev/null
```

### Kill a stuck task
```bash
tmux kill-session -t task-001
# Lock will auto-release
```

---

## Future Improvements

- [ ] Max concurrent workers limit
- [ ] Task priorities
- [ ] Dependency ordering (task-002 depends on task-001)
- [ ] Notification on completion (slack, email, etc)
- [ ] Web dashboard showing task status
- [ ] Migrate to Claude Agent SDK for programmatic control
- [ ] Configurable MAX_RESTARTS per task
- [ ] Timeout for worker sessions (kill if running too long)
- [ ] Better logging (write to files, not just stdout)

---

## Appendix: Configuration Options

You can customize behavior via environment variables or by editing the scripts:

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| Max retries | `MAX_RESTARTS` | 3 | How many times to retry a failed task |
| Worker turns | `WORKER_MAX_TURNS` | 50 | Max turns for worker Claude session |
| Validator turns | `VALIDATOR_MAX_TURNS` | 10 | Max turns for validator Claude session |
| Planning dir | `PLANNING_DIR` | `../planning/tasks` | Where to find task files |

Example:
```bash
MAX_RESTARTS=5 WORKER_MAX_TURNS=100 ./scripts/spawn-task.sh planning/tasks/task-001.md
```

---

## Appendix: Troubleshooting

### Task stuck in "validating"
The validator didn't update the status. Attach and check the output:
```bash
tmux attach -t task-XXX
```

### Lock file exists but no session running
Stale lock from a crash. Safe to remove:
```bash
rm planning/tasks/task-XXX.md.lock
```

### Task keeps failing validation
Check the `## Validation Notes` section in the task file - the validator explains what's wrong. After MAX_RESTARTS it will be marked `failed`.

### Claude exits immediately
Check that your slash commands exist and are valid:
```bash
cat .claude/commands/execute-task.md
cat .claude/commands/validate-task.md
```

### Want to run multiple tasks in parallel
Just spawn multiple:
```bash
./scripts/spawn-task.sh planning/tasks/task-001.md
./scripts/spawn-task.sh planning/tasks/task-002.md
./scripts/spawn-task.sh planning/tasks/task-003.md
```
Each runs in its own tmux session with its own lock.