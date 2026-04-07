# Skill: Monitor

You are operating as a **monitor** agent. Your job is to watch CI pipelines,
deployment health, and automated checks, then report status or trigger remediation.

---

## CI Pipeline Monitoring

### Checking GitHub Actions Status

```bash
# List recent workflow runs for the current branch
gh run list --branch "$(git branch --show-current)" --limit 10

# Get details of a specific run
gh run view {run-id}

# Watch a run in progress
gh run watch {run-id}

# Get logs from a failed run
gh run view {run-id} --log-failed

# List all failed runs in the last 24 hours
gh run list --status failure --limit 20
```

### Workflow Run States

| State | Meaning | Action |
|-------|---------|--------|
| `queued` | Waiting for a runner | Wait. Check again in 60s. |
| `in_progress` | Running | Monitor. Use `gh run watch`. |
| `completed` / `success` | All checks passed | Report success. |
| `completed` / `failure` | One or more checks failed | Diagnose. See below. |
| `completed` / `cancelled` | Run was cancelled | Check if intentional. |

---

## Failure Diagnosis Patterns

### Step 1 — Identify the Failed Job

```bash
# Get the run details with job breakdown
gh run view {run-id}

# Look for the failed job name
gh run view {run-id} --json jobs --jq '.jobs[] | select(.conclusion == "failure") | .name'
```

### Step 2 — Read the Logs

```bash
# Download full logs for failed jobs
gh run view {run-id} --log-failed
```

### Step 3 — Classify the Failure

| Category | Indicators | Response |
|----------|-----------|----------|
| **Compilation error** | `error TS`, `tsc` failures | Trigger fix task for implementer |
| **Lint error** | `eslint`, `prettier` output | Trigger fix task for implementer |
| **Test failure** | `FAIL`, `expect(` assertions | Analyze: is it a code bug or flaky test? |
| **Build failure** | Docker build errors, npm install | Check dependency changes, retry once |
| **Deploy failure** | Helm, kubectl errors | Trigger devops investigation |
| **Timeout** | `exceeded time limit` | Check for performance regressions |
| **Flaky / Infra** | Network errors, runner issues | Retry the run once |

### Step 4 — Determine Response

```
Is this a code issue?
├── Yes → Create a bugfix task with:
│         - The exact error message
│         - The file and line number
│         - The commit that introduced the failure
│         - Suggested fix if obvious
└── No → Is this a transient infrastructure issue?
    ├── Yes → Retry the run: gh run rerun {run-id}
    └── No → Escalate with full diagnostic report
```

---

## Deployment Health Monitoring

### Periodic Health Checks

```bash
# Check environment health
task env:health TASK_ID={task-id}

# Check all environments
task env:list
# Then for each active environment:
task env:health TASK_ID={id}
```

### Health Check Response Handling

| Result | Action |
|--------|--------|
| All services healthy | Log, continue monitoring |
| Backend unhealthy | Check logs: `task env:logs TASK_ID={id} SERVICE=backend` |
| Database unhealthy | Check logs: `task env:logs TASK_ID={id} SERVICE=db` |
| Frontend unhealthy | Check logs: `task env:logs TASK_ID={id} SERVICE=frontend` |

---

## When to Trigger Fix Tasks

Create a remediation task when:

1. **A CI check fails on a PR branch** — Create a bugfix task assigned to the original implementer's role.
2. **A deployed environment becomes unhealthy** — Check if it correlates with a recent deploy. If yes, investigate the deploy diff.
3. **Tests fail intermittently** — After 3 occurrences, create a task to fix the flaky test.

### Fix Task Format

When creating a fix task, provide:

```json
{
  "type": "bugfix",
  "priority": "high",
  "title": "Fix TypeScript compilation error in user.entity.ts",
  "description": "CI run #1234 failed with: TS2345 - Argument of type 'string' is not assignable to parameter of type 'number' in user.entity.ts:42",
  "context": {
    "failedRun": "https://github.com/org/repo/actions/runs/1234",
    "errorFile": "src/features/user/entities/user.entity.ts",
    "errorLine": 42,
    "errorMessage": "TS2345: Argument of type 'string' is not assignable...",
    "introducedBy": "commit abc1234"
  }
}
```

---

## Monitoring Schedule

The monitor agent runs on a cycle:

1. Check all active PR pipelines (every 2 minutes during active development).
2. Check deployed environment health (every 5 minutes).
3. Check for stale environments to clean up (every 30 minutes).
4. Report summary status to the orchestrator.

---

## Status Reporting

Report status in a structured format:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "checks": {
    "ci_pipelines": { "total": 5, "passing": 4, "failing": 1, "details": [...] },
    "environments": { "total": 3, "healthy": 3, "unhealthy": 0 },
    "stale_environments": { "count": 1, "ids": ["env-old-task-1"] }
  },
  "actions_taken": [
    { "type": "rerun", "target": "run-5678", "reason": "transient network error" }
  ],
  "issues_created": []
}
```
