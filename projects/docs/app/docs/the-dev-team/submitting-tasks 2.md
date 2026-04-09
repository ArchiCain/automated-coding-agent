# Submitting Tasks

There are three ways to give THE Dev Team work. All three end up in the same place — the `TaskIntakeService` in the orchestrator, which persists the task, adds it to the queue, and returns when an agent slot picks it up.

This page shows each mechanism with concrete examples, then walks through a trivial task end-to-end.

## 1. REST API

The most direct path. Hit `POST /api/tasks` on the orchestrator:

```bash
curl -X POST http://the-dev-team.localhost/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add email field to user profile",
    "description": "Users need an editable email field on their profile page. Backend: add `email` column to the users table with a migration, expose PATCH /api/users/:id for updating it, validate format. Frontend: add an email input to the profile form with validation state. Tests: integration test for the PATCH endpoint, Playwright test for the form submission.",
    "source": "manual",
    "priority": 1,
    "touchesFrontend": true
  }'
```

Response:

```json
{
  "id": "abc123",
  "title": "Add email field to user profile",
  "status": "queued",
  "source": "manual",
  "priority": 1,
  "branch": null,
  "worktreePath": null,
  "namespace": null,
  "createdAt": "2026-04-05T10:00:00Z"
}
```

The task is immediately visible on the dashboard. When an agent slot is idle (or becomes idle) the orchestrator assigns it, creates the worktree, and the execution loop starts.

### Request body fields

| Field | Required | Notes |
|-------|----------|-------|
| `title` | yes | Short, ends up in the PR title |
| `description` | yes | The full prompt — this is what the architect reads |
| `source` | no | Defaults to `manual`. Values: `manual`, `github_issue`, `decomposition`, `pr_feedback`, `ci_failure` |
| `priority` | no | Integer, higher runs first within the same status |
| `touchesFrontend` | no | If true, runs the designer + frontend gates. Auto-detected from the changed files at the end of Phase 2 if not set |
| `parentTaskId` | no | Set when a decomposed sub-task belongs to a parent tree |
| `dependencies` | no | Task ids that must be `completed` before this one can start |

A good description is detailed, has acceptance criteria, and points at the files the architect should read. The better the prompt, the fewer the retries.

## 2. GitHub issue labelled `the-dev-team`

The orchestrator polls GitHub every 5 minutes for issues labelled `the-dev-team` that haven't already been turned into tasks. For each new issue it:

1. Creates a task with `source: 'github_issue'` and `sourceRef: '#{issue-number}'`
2. Copies the issue body into the description
3. Copies the issue title into the task title
4. Adds a comment on the issue linking the task id

Example workflow:

1. A teammate opens GitHub issue #123 titled "User profile needs email field"
2. Adds the `the-dev-team` label
3. Within 5 minutes the orchestrator detects it and creates a task
4. A bot comment appears on the issue: `Picked up by THE Dev Team as task abc123. Status: queued.`
5. When the task reaches the `completed` phase, another comment links the PR
6. A human reviews and merges the PR; the PR references the issue and auto-closes it

Require `GITHUB_TOKEN` to be set on the orchestrator pod with `issues: read` permission. The polling interval is tunable via the `ISSUE_POLL_CRON` env var.

## 3. Decomposition service

For features too big to fit in one task, use the decomposition service. It takes a high-level plan and produces a **task tree** (project → feature → concern → atomic task) with dependencies.

```bash
curl -X POST http://the-dev-team.localhost/api/decomposition \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "Add a full user profile feature: an editable profile page with avatar upload, email change, password change, and notification preferences. Users should land on /profile when they click their avatar in the AppBar. All changes persist immediately without a save button."
  }'
```

The architect role runs against the repo read-only, analyses the existing code, and returns a tree:

```
Feature: User Profile
├── Backend
│   ├── task abc001: Add profile columns + migration
│   ├── task abc002: Create PATCH /api/users/:id endpoint (depends on abc001)
│   └── task abc003: Add avatar upload endpoint (depends on abc002)
├── Frontend
│   ├── task abc010: Add /profile route and page shell (depends on abc002)
│   ├── task abc011: Build profile edit form (depends on abc010)
│   └── task abc012: Add avatar upload component (depends on abc011, abc003)
└── E2E
    └── task abc020: Playwright tests for profile flow (depends on abc011, abc012)
```

The tree is automatically queued: each leaf task is submitted to the task intake with its dependencies, and the orchestrator respects the ordering. Up to `maxConcurrent` tasks run in parallel as dependencies clear.

You can also review the tree before queueing by passing `?dryRun=true` and then selectively submitting sub-trees.

## End-to-end walkthrough

Let's run a trivial task and watch it flow through the system.

### 1. Submit

```bash
curl -X POST http://the-dev-team.localhost/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add /health-extended endpoint",
    "description": "Add a new GET /api/health-extended endpoint to the backend that returns { status, uptime, memory, version }. Add a unit test that verifies the shape of the response.",
    "source": "manual",
    "touchesFrontend": false
  }'
```

Response: `{"id": "x7k2m9", "status": "queued", ...}`

### 2. Watch it run

Open the dashboard at `http://dashboard.the-dev-team.localhost`. The task `x7k2m9` appears in the **queued** column.

Within seconds the orchestrator assigns it to a slot. The card moves to **implementing**. Click the card to open the Agent Detail view and watch the live stream:

```
[text] Reading projects/application/backend/src/features/health/
[tool_use] Read path: .../health.controller.ts
[tool_result] (controller source)
[text] I'll add the extended endpoint alongside the existing one...
[tool_use] Edit file: .../health.controller.ts
[tool_result] Updated
[tool_use] Write file: .../health-extended.spec.ts
[tool_result] Created
```

### 3. Gates run

After the implementer finishes, the card moves to **validating**. The dashboard shows gates checking off:

- build: passed (22s)
- unit-tests: passed (41s)
- deployment: passed (84s)
- integration-tests: passed (stub)
- log-audit: passed (3s)
- api-validation: passed (stub)
- database-validation: passed (stub)
- performance: passed (57s)

### 4. Review loop

The reviewer role runs, inspects the diff, finds no blocking issues, and writes an empty `findings/reviewer.md`. The loop exits immediately.

The documentarian updates `projects/docs/app/docs/projects/application/backend.md` to mention the new endpoint.

### 5. Submit

The card moves to **submitting**. The orchestrator pushes the branch and opens a PR:

```
[THE Dev Team] Add /health-extended endpoint
#456 · the-dev-team-bot wants to merge 1 commit into main from the-dev-team/feature/x7k2m9
```

The PR description includes all the gate results, the diff stat, and the total cost ($0.08).

### 6. Human merge

A teammate reviews the PR, approves it, and merges. The monitor role notices the merge on its next run and confirms CI is green. The sandbox `env-x7k2m9` is cleaned up by the hourly reaper. The task summary is written to `.the-dev-team/history/tasks/2026/04/task-x7k2m9-add-health-extended.md` and synced to the history branch on the next 15-minute interval.

Done.

## Tips

- **Write prompts like issues for a junior engineer.** Include file paths to read, the behaviour you want, and the acceptance criteria.
- **Use decomposition for anything over ~5 files.** Large tasks have more places to fail.
- **Set `touchesFrontend: false` explicitly** for backend-only tasks to skip the designer and the frontend gates.
- **Add dependencies explicitly** when queueing multiple related tasks to avoid unnecessary concurrent work.

## Related reading

- [Execution Loop](execution-loop.md)
- [Validation Gates](validation-gates.md)
- [Configuration](configuration.md)
- [Task State & History](../projects/coding-agent/backlog.md)
