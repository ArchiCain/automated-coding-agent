# Execution Loop

Every task runs through a fixed 7-phase execution loop in `ExecutionLoopService`. The loop is **sequential**: phases do not overlap. Gate failures trigger the bugfixer. A retry budget (default 3) per gate / per reviewer iteration prevents infinite loops.

```
┌──────────────┐
│ 1. Setup     │  create worktree + branch
└──────┬───────┘
       │
┌──────▼────────────┐
│ 2. Implement      │  architect plan → implementer code
└──────┬────────────┘
       │
┌──────▼────────────┐
│ 3. Build + Deploy │  build gate → unit gate → devops → deployment gate
└──────┬────────────┘
       │
┌──────▼────────────┐
│ 4. Test           │  tester → integration/log/api/db gates
│                   │  designer (if frontend) → e2e/a11y/design gates
│                   │  performance gate
└──────┬────────────┘
       │
┌──────▼────────────┐
│ 5. Review + Fix   │  reviewer → bugfixer loop → documentarian
└──────┬────────────┘
       │
┌──────▼────────────┐
│ 6. Submit         │  commit, push, open PR
└──────┬────────────┘
       │
┌──────▼────────────┐
│ 7. Cleanup        │  destroy env (optional), remove worktree, summarise
└───────────────────┘
```

## Phase 1 — Setup

```
- Fetch origin
- Create worktree at /workspace/worktrees/{task-id}
- Create branch the-dev-team/{feature|fix|doc}/{task-id}
- Persist task.worktreePath, task.branch
- Transition status → setting_up
- Log `setup_complete` event
```

The task's `source` field drives the branch prefix:

| `source` | Branch prefix |
|----------|---------------|
| `github_issue`, `manual`, `decomposition` | `the-dev-team/feature/` |
| `ci_failure`, `pr_feedback` | `the-dev-team/fix/` |

For `pr_feedback` tasks the worktree is created from the **existing** PR branch rather than a fresh one — the rework happens in place.

## Phase 2 — Implement

Two roles run sequentially:

1. **architect** — read-only (`Read`/`Grep`/`Glob`), loaded with the `decompose` skill, produces a markdown plan saved to `.the-dev-team/state/{task-id}/plan.md`
2. **implementer** — full write access, loaded with `execute` and `database` skills, receives the plan as part of its prompt

The architect's plan is the authoritative source for everything downstream. If the architect decomposes into sub-tasks instead of writing a plan, the orchestrator queues the sub-tasks and the current task becomes a coordinator.

## Phase 3 — Build + Deploy

```
- Run `build` gate
  ↳ on fail: retryWithFix('build') up to retryBudget
- Run `unit-tests` gate
  ↳ on fail: retryWithFix('unit-tests')
- runRole('devops') → `task env:build` + `task env:create`
- Run `deployment` gate (calls `task env:health`)
  ↳ on fail: retryWithFix('deployment')
```

Build and unit tests run **before** deployment to fail fast on cheap checks. Only then does devops pay the cost of spinning up a sandbox namespace.

`retryWithFix(gate)` dispatches the bugfixer with the gate's output, the bugfixer applies fixes + rebuilds + redeploys, the gate re-runs, and the loop continues up to `retryBudget` attempts.

## Phase 4 — Test

```
- runRole('tester') → writes integration tests, runs them against env-{task-id}
- Run gate sequence: integration-tests → log-audit → api-validation → database-validation

- if task.touchesFrontend:
    runRole('designer') → UI work, Playwright E2E, screenshots, axe-core audit
    Run gate sequence: e2e-tests → accessibility → design-review

- Run `performance` gate
```

`task.touchesFrontend` is determined from the changed files (anything under `projects/application/frontend/` or `projects/coding-agent/dashboard/`). It drives whether the designer runs and whether the three frontend-specific gates are in the sequence.

## Phase 5 — Review + Fix

```
- runRole('reviewer') → writes .the-dev-team/state/{id}/findings/reviewer.md

- iterations = 0
- while findingsService.hasBlockingFindings(taskId) and iterations < retryBudget:
    iterations++
    runRole('bugfixer') → reads findings/, fixes, rebuilds, redeploys
    runRole('reviewer') → re-review

- if still has findings: throw → escalate to human

- runRole('documentarian') → updates docs
```

The reviewer never modifies code. It only writes findings. The bugfixer reads **every** markdown file under `findings/` — so reviewer findings, designer findings, and tester findings are all picked up in one pass.

## Phase 6 — Submit

```
- transition status → submitting
- git add -A, git commit -m buildCommitMessage(task)
- git push origin {branch}
- prManager.createPR(task) → returns PR number
- task.prNumber = prNumber
- log `pr_created` event
```

`prManager.createPR` uses `gh pr create` with a structured body built from the state directory: gate results, screenshots, performance comparison, and a diff stat. See [PR Workflow](pr-workflow.md).

## Phase 7 — Cleanup

```
- if not config.keepEnvironmentForReview:
    envManager.destroyEnvironment(task.id)
- git worktree remove
- transition status → completed
- taskSummaryService.generate(task)
- log `task_completed` event (duration, cost)
```

When `keepEnvironmentForReview: true` (recommended), the sandbox stays alive so a human reviewer can hit the ingress URLs and poke around. The scheduled `env:cleanup:stale` cron reaps anything older than 24 hours.

## How a role runs: `runRole`

Every phase ultimately calls `runRole(role, task, { prompt, skills })`:

```typescript
private async runRole(role, task, options): Promise<RoleResult> {
  const provider   = this.registry.getForRole(role);
  const systemPrompt = await this.skillLoader.buildSystemPrompt(role, { ... });
  const allowedTools = this.skillLoader.getToolsForRole(role);
  const sessionId  = await this.sessionManager.createSession(task.id, role);

  for await (const message of provider.execute({
    prompt: options.prompt,
    cwd: task.worktreePath,
    systemPrompt,
    allowedTools,
  })) {
    this.transcriptWriter.logMessage(task.id, role, message);
    this.dashboardGateway.emitAgentProgress(task.id, role, message);
    if (message.type === 'complete') task.cost += this.calculateCost(message.raw);
  }

  await this.sessionManager.completeSession(sessionId);
  return { output, role, sessionId };
}
```

Properties worth highlighting:

- The **provider is resolved per role** — different roles can run on different models (see [Configuration](configuration.md))
- Messages are streamed synchronously to both the transcript writer **and** the dashboard WebSocket
- Cost is accumulated on the task object and reported in the PR description and task summary
- A session id is created at start and closed at end, so a crashed orchestrator can resume a role via the provider's session-resume feature

## Retry budgets & failure handling

The retry budget is defined in `.the-dev-team/config/the-dev-team.config.yml` (`retryBudget: 3`). It applies:

- **Per gate** — a gate can be retried up to `retryBudget` times with a bugfixer intervention between each attempt
- **Per reviewer loop** — the reviewer/bugfixer loop in Phase 5 is bounded by the same number

Exhausting the budget raises an exception that the loop catches. `handleFailure` marks the task `escalated`, keeps the sandbox alive for human inspection, logs a `task_escalated` orchestrator event, and emits `task:update` so the dashboard moves the card to the escalated column.

## Resume after crash

The orchestrator is not meant to be long-running, but it shouldn't lose work if it is restarted mid-task. Each phase transition writes `status.json` to the task state directory. On startup the orchestrator:

1. Reads all `status.json` files under `.the-dev-team/state/`
2. For any task not in a terminal status, it re-assigns it to an agent slot
3. The execution loop restarts the current phase from the beginning — most phases are idempotent (git worktree create skips if exists, `task env:create` uses `--dry-run=client | apply`, build artifacts are cached)

Gate results and findings are preserved across restarts because they live in the state directory.

## Sequential vs parallel

The execution loop is deliberately sequential. Parallelism lives at the **task pool** level — N agent slots can run N tasks concurrently, each through its own sequential loop. This gives concurrency where it matters (throughput across unrelated tasks) without the complexity of parallel phases within one task. See [Task Decomposition & Concurrency](../projects/coding-agent/backlog.md) and the `AgentPoolService` in the [Orchestrator](../projects/coding-agent/backend.md).

## Related reading

- [Validation Gates](validation-gates.md)
- [Roles & Skills](roles-and-skills.md)
- [Sandbox Environments](sandbox-environments.md)
- [PR Workflow](pr-workflow.md)
- [Configuration](configuration.md)
