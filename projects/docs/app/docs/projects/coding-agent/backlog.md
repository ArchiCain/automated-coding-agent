# Task State & History

THE Dev Team is deliberately database-less. Everything it needs to know about an active task or a past task lives on the filesystem under `.the-dev-team/`, and is synced to a protected git branch for durability and auditability.

Two concepts:

- **State** — mutable, per-task working memory (`.the-dev-team/state/{task-id}/`). Used while a task is running. Deleted or archived when the task completes.
- **History** — append-only record of everything that happened (`.the-dev-team/history/`). Synced to the `the-dev-team/history` branch on a schedule.

## Per-task state

Each active task owns a directory under `.the-dev-team/state/`:

```
.the-dev-team/state/{task-id}/
├── status.json              # Current phase, retry counts, timestamps
├── plan.md                  # Architect's plan (markdown)
├── findings/                # Inter-role findings protocol
│   ├── reviewer.md
│   ├── designer.md
│   └── tester.md
├── gate-results/            # One JSON file per gate
│   ├── build.json
│   ├── unit-tests.json
│   ├── deployment.json
│   ├── integration-tests.json
│   ├── log-audit.json
│   ├── api-validation.json
│   ├── database-validation.json
│   ├── e2e-tests.json
│   ├── accessibility.json
│   ├── design-review.json
│   └── performance.json
└── screenshots/
    ├── before/
    └── after/
```

### status.json

```json
{
  "id": "abc123",
  "status": "validating",
  "branch": "the-dev-team/feature/abc123",
  "worktree": "/workspace/worktrees/abc123",
  "namespace": "env-abc123",
  "startedAt": "2026-04-05T10:00:00Z",
  "retryCounts": { "build": 0, "unit-tests": 1 },
  "cost": 0.87
}
```

### Gate result file

```json
{
  "gate": "build",
  "passed": true,
  "output": "Build completed successfully",
  "durationMs": 28500,
  "attempt": 1,
  "timestamp": "2026-04-05T10:00:30Z"
}
```

## Findings protocol

Roles communicate with each other asynchronously by writing **findings** — markdown files under `.the-dev-team/state/{task-id}/findings/`. This keeps sessions stateless and makes the orchestrator the single source of truth for cross-role coordination.

How it works:

1. The **reviewer** runs, inspects the diff, and writes `findings/reviewer.md` with a section for each issue.
2. The orchestrator checks the file. If it has content in `## Blocking Issues`, it dispatches the **bugfixer**.
3. The **bugfixer** reads every `.md` file in `findings/`, fixes the issues, rebuilds + redeploys, and clears resolved sections.
4. The **reviewer** runs again on the updated branch.
5. Loop until `findings/reviewer.md` has no blocking issues **or** `config.retryBudget` is exhausted.

The same protocol applies to the **designer** (writes `findings/designer.md` with blocking visual issues) and **tester** (`findings/tester.md` for failing integration tests that need implementation fixes).

A finding file looks like this:

```markdown
# Reviewer Findings — task abc123

## Blocking Issues

### Missing error handling in UserService.create
**File:** `src/features/users/user.service.ts:42`
**Severity:** blocking
The `create()` method does not handle the case where the email is already taken. Wrap the insert in a try/catch and throw `ConflictException`.

## Advisory

### Consider extracting a DTO
The inline object literal in `user.controller.ts:30` should be a proper DTO class.
```

## History

History is the append-only record of everything the system has done. It lives at `.the-dev-team/history/` and is synced to a protected branch every 15 minutes.

```
.the-dev-team/history/
├── sessions/                    # Raw JSONL transcripts, one per role per task
│   └── 2026/04/05/
│       ├── task-abc123-architect-1712313600.jsonl
│       ├── task-abc123-implementer-1712314200.jsonl
│       └── ...
├── tasks/                       # Human-readable markdown summaries
│   └── 2026/04/
│       └── task-abc123-user-profile.md
├── orchestrator/                # System-level event log
│   └── 2026/04/
│       └── 05.jsonl
└── index.jsonl                  # Fast lookup index (one task per line)
```

### Session transcripts (JSONL)

Each role invocation produces one `.jsonl` file with one event per line. Every text message, tool call, tool result, and completion is captured:

```jsonl
{"ts":"2026-04-05T10:02:11Z","type":"session_start","taskId":"abc123","role":"implementer"}
{"ts":"2026-04-05T10:02:14Z","type":"text","role":"implementer","content":"I'll start by reading..."}
{"ts":"2026-04-05T10:02:16Z","type":"tool_use","role":"implementer","tool":"Read","input":{"path":"src/features/users/user.service.ts"}}
{"ts":"2026-04-05T10:04:02Z","type":"session_end","cost":0.12,"tokens":{"in":14200,"out":2100}}
```

### Task summaries (markdown)

After a task completes, the `TaskSummaryService` generates a human-readable summary:

- Title, status, branch, PR number, duration, total cost
- Timeline table (role × action × duration × cost)
- Validation gate table (gate × result × attempts)
- Files changed
- Links to session transcripts

### Index

`.the-dev-team/history/index.jsonl` is a one-line-per-task index used by the dashboard and the `task history:*` commands for fast lookup without parsing every file.

## `task history:*` commands

The history Taskfile (`infrastructure/history/Taskfile.yml`) exposes the archive via the CLI:

```bash
task history:search -- 'TypeError'       # grep transcripts for a pattern
task history:task -- abc123              # Show the markdown summary for a task
task history:sessions -- abc123          # List session transcripts for a task
task history:tail                        # Follow the latest orchestrator events
task history:costs -- 2026-04-05         # Cost rollup for a date
task history:failures                    # Recent failed tasks with reasons
task history:sync                        # Trigger an immediate git sync
task history:cleanup -- 90               # Remove transcripts older than N days
```

See [Taskfile Conventions](../../development/taskfile.md) for the full reference.

## History sync to git

A GitHub Action runs every 15 minutes (and on demand via `task history:sync`) to commit the contents of `.the-dev-team/history/` to a dedicated **`the-dev-team/history`** branch.

Properties of the history branch:

- **Orphan** — not part of the main commit graph, zero merge risk
- **Protected** — the bot account cannot push to it; only the history-sync workflow can
- **No force-push, no delete** — once written, events are immutable
- **Auditable** — anyone with repo read access can check out the branch and run `git log`

This gives you crash-resilience (the PVC can be wiped without losing the record) and a forensic trail for every PR THE Dev Team has ever submitted.

## Retention

- **State** (`state/`) — deleted on task completion unless `keepEnvironmentForReview: true`, in which case it is kept until the PR is merged or closed.
- **History** (`history/`) — transcripts older than 90 days are pruned from the PVC by `task history:cleanup` on a daily cron. The git branch keeps everything indefinitely, so old transcripts remain reachable via `git show`.

Tune the retention window by changing the cron argument in `scheduler.service.ts` or by running the task manually.

## Related reading

- [Orchestrator](backend.md)
- [Execution Loop](../../the-dev-team/execution-loop.md)
- [Validation Gates](../../the-dev-team/validation-gates.md)
- [Dashboard](../the-dev-team-dashboard.md)
