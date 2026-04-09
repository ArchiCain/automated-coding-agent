# Validation Gates

A **gate** is a deterministic check that a task must pass before the execution loop can advance. Gates run in a fixed sequence, fail fast on the first broken check, and trigger the bugfixer with a retry budget when they fail.

Gates are the system's immune response. A task cannot become a PR unless every applicable gate is green.

## The canonical 11-gate sequence

| # | Gate | Phase | Applies to | Typical time | Implementation phase |
|---|------|-------|------------|--------------|----------------------|
| 1 | `build` | 1 | all | ~30s | Phase 1 (real) |
| 2 | `unit-tests` | 1 | all | ~60s | Phase 1 (real) |
| 3 | `deployment` | 1 | all | ~90s | Phase 1 (real) |
| 4 | `integration-tests` | 2 | all | ~60s | Phase 2 (stub) |
| 5 | `log-audit` | 1 | all | ~10s | Phase 1 (real) |
| 6 | `api-validation` | 2 | backend | ~30s | Phase 2 (stub) |
| 7 | `database-validation` | 2 | backend | ~15s | Phase 2 (stub) |
| 8 | `e2e-tests` | 2 | frontend | 2-5m | Phase 2 (real) |
| 9 | `accessibility` | 2 | frontend | ~30s | Phase 2 (real) |
| 10 | `design-review` | 2 | frontend | 2-3m | Phase 2 (real) |
| 11 | `performance` | 2-3 | all | 1-2m | Phase 2 (real) |

"Implementation phase" refers to the rollout plan, not the 7-phase execution loop:

- **Phase 1 (real)** — implemented and enforced from day one
- **Phase 2 (real)** — implemented in the second milestone; some of these (e2e, design, perf) require significant per-project set-up
- **Phase 2 (stub)** — the gate exists and is wired into the loop, but the implementation is a no-op that always passes. It will be replaced without changing any surrounding code.

The stubbed gates return `passed: true` with an output line like `"Gate 'api-validation' is not yet implemented (Phase 2)"` so they don't block execution but are still visible in transcripts and PR descriptions.

## What each gate does

### 1. build
Runs `task env:build` against the worktree. Fails on any Docker build error. All images are tagged with the task id and pushed to the in-cluster registry.

### 2. unit-tests
Runs `npm test` in `projects/application/backend/` (and, if `touchesFrontend`, `projects/application/frontend/`). Fails on any test failure or on a coverage regression below the project's floor.

### 3. deployment
Calls `task env:health` which checks pod readiness and hits `/health` on each service in the sandbox namespace. Fails if any pod is not `Ready` or any health endpoint returns non-200.

### 4. integration-tests  *(Phase 2 stub)*
Runs integration tests against the live sandbox (`env-{task-id}`). The existing `*.integration.spec.ts` test suites get a new base URL pointing at cluster-internal DNS. Stubbed until the orchestrator has a reliable way to run `npm run test:integration` against the sandbox.

### 5. log-audit
Runs `task env:logs:errors` and fails if any log line at level `error` is found across the sandbox services. This catches runtime issues that don't fail tests — unhandled promise rejections, failed migrations, missing env vars.

### 6. api-validation  *(Phase 2 stub)*
Will hit every registered endpoint (OpenAPI spec or NestJS route registry) and verify the response shape matches the contract. Stubbed until the contract source-of-truth exists.

### 7. database-validation  *(Phase 2 stub)*
Will verify the schema state in the sandbox database matches the expected migrations output. Stubbed until schema expectations are codified.

### 8. e2e-tests
Runs `npx playwright test` from `projects/application/e2e/` with `BASE_URL=http://app.env-{task-id}.svc.cluster.local`. Fails on any failing spec. See [Design Validation](../projects/coding-agent/backend.md) for how the designer writes these.

### 9. accessibility
The designer uses `@axe-core/playwright` to run WCAG AA audits on every page modified by the task. The raw axe output is written to `.the-dev-team/state/{task-id}/gate-results/accessibility-raw.json`, and the gate reads it. Fails if there are **any** violations — advisory findings are included in the PR description but do not block.

### 10. design-review
The designer captures screenshots at 375, 768, and 1440 wide using Playwright, compares them to the `main` branch screenshots, and evaluates them against the `design-review` skill. Findings go to `.the-dev-team/state/{task-id}/findings/designer.md`. The gate passes if the file has no `## Blocking Issues` section with content.

### 11. performance
Runs latency samples against `backend.env-{task-id}.svc.cluster.local` and frontend Playwright metrics (TTFB, DOM content loaded, LCP). Compares against `.the-dev-team/baselines/performance.json`. Fails if any metric regresses by more than `regressionThreshold` (default 20%). Baselines are updated on merge to `main` by a dedicated GitHub Action.

## Where gate results live

Each gate writes a JSON file to the task state directory:

```
.the-dev-team/state/{task-id}/gate-results/
├── build.json
├── unit-tests.json
├── deployment.json
├── integration-tests.json
├── log-audit.json
├── api-validation.json
├── database-validation.json
├── e2e-tests.json
├── accessibility.json
├── design-review.json
└── performance.json
```

Each file:

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

The PR manager reads this directory to build the PR description. The dashboard subscribes to `gate:result` events and displays them in the agent detail view. The history task summary includes the full gate table.

## Retry with bugfixer

When a gate fails, the execution loop calls `retryWithFix`:

```typescript
while (!result.passed && attempts < retryBudget) {
  attempts++;
  await this.runRole('bugfixer', task, {
    prompt: `The ${gateName} gate failed:\n\n${result.output}\n\nFix the issue, then rebuild and redeploy.`,
    skills: ['execute', 'infrastructure'],
  });
  result = await this.gateRunner.run(gateName, task);
}
if (!result.passed) throw new Error(`Gate '${gateName}' failed after ${retryBudget} attempts`);
```

The bugfixer is given the gate's raw output and the `infrastructure` skill so it can rebuild / redeploy / tail logs on its own. Every retry produces a new gate result (with incremented `attempt`) so the history preserves the full story.

The retry budget is configured in `.the-dev-team/config/the-dev-team.config.yml` (`retryBudget: 3` by default) and applies per gate. Exhausting the budget escalates the task — see [Execution Loop](execution-loop.md#retry-budgets--failure-handling).

## Gate skipping

Gates with `applicableTo: 'frontend'` return `passed: true, output: 'Skipped (no frontend changes)'` for tasks where `touchesFrontend` is false. The dashboard marks them grey rather than green so it's clear they were skipped, not run.

## Adding a gate

1. Create `src/agents/gates/{name}.gate.ts` implementing `ValidationGate`
2. Register it in `GateRunnerService.registerGates()`
3. Add it to `DEFAULT_GATE_SEQUENCE` in the order you want it to run
4. Optionally, make it opt-in per task via a config flag

## Related reading

- [Execution Loop](execution-loop.md)
- [Sandbox Environments](sandbox-environments.md)
- [Task State & History](../projects/coding-agent/backlog.md)
- [PR Workflow](pr-workflow.md)
