# Backlog: Active Plans

This directory contains active implementation plans created by the `planner` Claude Code skill.

---

## Purpose

The `.backlog/` directory serves as **temporary storage** for plans while we build the autonomous coding agent system. Think of it as:

- **Short-term:** Manual workflow using Claude Code skills
- **Long-term:** Will be replaced by the coding-agent-backend system

---

## Structure

Each plan gets its own directory:

```
.backlog/
├── p-abc123/               # Plan 1
│   ├── meta.json           # Metadata (id, slug, status, project)
│   ├── request.md          # Original feature request
│   ├── tasks.jsonl         # All tasks (append-only, one per line)
│   ├── state.json          # Execution state (mutable)
│   └── events.jsonl        # Audit trail (append-only)
├── p-def456/               # Plan 2
│   └── ...
└── README.md               # This file
```

---

## File Formats

### `meta.json` (Mutable)

Plan metadata:

```json
{
  "id": "p-abc123",
  "slug": "user-notifications",
  "projectName": "backend",
  "projectPath": "/Users/scain/.../projects/backend",
  "status": "drafting|ready|executing|completed|failed",
  "createdAt": "2026-01-11T10:30:00.000Z",
  "updatedAt": "2026-01-11T10:30:00.000Z"
}
```

### `request.md` (Immutable)

Original feature request with requirements, context, success criteria.

### `tasks.jsonl` (Append-Only)

One JSON object per line. Tasks are never modified, only appended.

```jsonl
{"id":"t-abc123","planId":"p-abc123","parentId":null,"title":"Task title","description":"Task description","acceptanceCriteria":["Criteria 1","Criteria 2"],"dependsOn":[],"atomic":true,"filesAffected":["file.ts"],"testApproach":"Unit tests","complexity":"simple","order":1,"createdAt":"2026-01-11T10:30:00.000Z"}
```

**Key Fields:**
- `id`: t-{hash} or t-{parent}-{index} for subtasks
- `parentId`: null for top-level, task ID for subtasks
- `dependsOn`: Array of task IDs that must complete first
- `atomic`: true if can't decompose further
- `complexity`: trivial | simple | moderate | complex
- `acceptanceCriteria`: Array of verifiable conditions

### `state.json` (Mutable)

Current execution state:

```json
{
  "status": "drafting",
  "tasksTotal": 10,
  "tasksCompleted": 3,
  "tasksInProgress": 2,
  "tasksPending": 5,
  "workersActive": ["worker-1", "worker-2"],
  "currentPhase": "planning|decomposition|execution|review",
  "lastUpdated": "2026-01-11T10:30:00.000Z"
}
```

### `events.jsonl` (Append-Only)

Audit trail of all plan activities:

```jsonl
{"timestamp":"2026-01-11T10:30:00.000Z","event":"plan:created","actor":"claude","data":{"planId":"p-abc123"}}
{"timestamp":"2026-01-11T10:35:00.000Z","event":"task:decomposed","actor":"claude","data":{"taskId":"t-abc123","subtasks":["t-abc123-1","t-abc123-2"]}}
{"timestamp":"2026-01-11T10:40:00.000Z","event":"task:completed","actor":"worker-1","data":{"taskId":"t-abc123-1"}}
```

---

## Plan Lifecycle

### 1. Drafting

Plan created, tasks being decomposed.

```bash
claude --skill planner
# Creates plan with status: "drafting"

claude --skill decomp --plan p-abc123
# Decomposes complex tasks
```

### 2. Ready

All tasks atomic, ready for execution.

```bash
# Manually update meta.json
jq '.status = "ready"' .backlog/p-abc123/meta.json > tmp.json
mv tmp.json .backlog/p-abc123/meta.json
```

### 3. Executing

Tasks being worked on.

```bash
# Manually for now (executor skill coming)
claude --skill project-context --prompt "Work on task t-abc123"

# Update state.json as tasks complete
```

### 4. Completed

All tasks done, work merged.

```bash
# Mark complete
jq '.status = "completed"' .backlog/p-abc123/meta.json > tmp.json
mv tmp.json .backlog/p-abc123/meta.json
```

### 5. Archived

Plan directory can be moved to `.backlog/archive/` for history.

---

## Active Plans

<!-- Update this section as you create/complete plans -->

### Currently Active:

_None yet. Create your first plan with `claude --skill planner`_

### Recently Completed:

_None yet._

---

## Relationship to coding-agent-backend

This `.backlog/` system **mimics** the structure being built in `coding-agent-backend`:

| .backlog/ (Temporary) | coding-agent-backend (Permanent) |
|----------------------|----------------------------------|
| Manual plan creation | Web UI plan creation |
| Claude Code skills | NestJS decomposition engine |
| Manual execution | Autonomous worker pool |
| File-based storage | File-based storage (same format!) |
| No real-time updates | WebSocket real-time updates |
| Human-driven | Agent-driven with human approval |

**Migration Path:**

1. Build coding-agent system using `.backlog/` workflow
2. When system complete, test it on `.backlog/` plans
3. Switch to using the system itself
4. Archive `.backlog/` as historical artifact

---

## Commands

### List all plans
```bash
ls -1 .backlog/ | grep "^p-"
```

### View plan metadata
```bash
cat .backlog/p-abc123/meta.json | jq '.'
```

### View all tasks
```bash
cat .backlog/p-abc123/tasks.jsonl | jq -s '.'
```

### View tasks by status
```bash
# Non-atomic tasks
cat .backlog/p-abc123/tasks.jsonl | jq 'select(.atomic == false)'

# Complex tasks
cat .backlog/p-abc123/tasks.jsonl | jq 'select(.complexity == "complex")'

# Tasks with no dependencies (can start now)
cat .backlog/p-abc123/tasks.jsonl | jq 'select(.dependsOn | length == 0)'
```

### View events
```bash
cat .backlog/p-abc123/events.jsonl | jq -s '.[] | "\(.timestamp) | \(.event) | \(.actor)"'
```

### Check plan health
```bash
# Verify all task dependencies exist
PLAN_ID="p-abc123"
ALL_IDS=$(cat .backlog/$PLAN_ID/tasks.jsonl | jq -r '.id')
cat .backlog/$PLAN_ID/tasks.jsonl | jq -r '.dependsOn[]' | while read dep; do
  if ! echo "$ALL_IDS" | grep -q "^$dep$"; then
    echo "ERROR: Missing dependency $dep"
  fi
done
```

---

## .gitignore Considerations

Should `.backlog/` be committed to git?

**Option A: Commit It** (Recommended)
- ✅ Team sees active plans
- ✅ Plan history preserved
- ✅ Collaboration easier
- ❌ Adds noise to git log

**Option B: Ignore It**
- ✅ Clean git history
- ❌ Lost on machine failure
- ❌ Can't collaborate

**Current Decision:** Commit `.backlog/` to git. Add to `.gitignore` later if becomes noisy.

---

## Cleanup

### Archive completed plans
```bash
mkdir -p .backlog/archive
mv .backlog/p-abc123 .backlog/archive/
```

### Delete draft plans
```bash
# If plan abandoned
rm -rf .backlog/p-abc123
```

---

## Future

Once `coding-agent-backend` is complete:

1. Import existing `.backlog/` plans into the system
2. Use web UI for all new plans
3. Archive `.backlog/` directory
4. Update this README with "DEPRECATED" notice

---

**Created:** 2026-01-11
**Purpose:** Temporary scaffolding for building autonomous coding agent
**Status:** Active (MVP workflow)
**Replacement:** coding-agent-backend (when complete)
