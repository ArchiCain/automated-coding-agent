# Task State & History

THE Dev Team records every task's state and history in the `.the-dev-team/` directory at the repo root.

## Directory structure

```
.the-dev-team/
├── config/
│   └── the-dev-team.config.yml   # Runtime configuration
├── state/                        # Per-task working memory (ephemeral)
│   └── {task-id}/
│       ├── status.json           # Current phase
│       ├── plan.md               # Architect's plan
│       ├── findings/             # Reviewer/designer/tester findings
│       └── gate-results/         # JSON result per gate
├── history/                      # Append-only record (synced to git)
│   ├── sessions/                 # JSONL transcripts per session
│   ├── tasks/                    # Markdown summaries per task
│   ├── orchestrator/             # Orchestrator event log
│   └── index.jsonl               # Master index
└── baselines/
    └── performance.json          # Baseline metrics for the performance gate
```

## State vs history

- **State** (`state/{task-id}/`) is working memory. It exists while a task is active and is cleaned up after completion. Gate results, findings, and the architect's plan live here.
- **History** (`history/`) is the permanent record. Task summaries, session transcripts, and orchestrator events are written here and synced to the `the-dev-team/history` git branch on a 15-minute interval.

## Commands

```bash
task history:search -- 'pattern'       # Grep transcripts
task history:task -- {task-id}         # Print task summary
task history:sessions -- {task-id}     # List session transcripts
task history:tail                      # Follow orchestrator events
task history:costs -- 2026-04-05       # Cost rollup for a date
task history:failures                  # Recent failed tasks
task history:sync                      # Trigger immediate git sync
task history:cleanup -- 90             # Remove transcripts older than N days
```

## Related reading

- [THE Dev Team Overview](../../the-dev-team/overview.md)
- [Execution Loop](../../the-dev-team/execution-loop.md)
- [Validation Gates](../../the-dev-team/validation-gates.md)
