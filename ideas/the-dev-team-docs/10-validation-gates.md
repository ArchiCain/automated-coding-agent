# 10 — Validation Gates

## Goal

Implement the 11 validation gates that every task must pass before PR submission. Gates run in order from fastest to slowest, failing fast when possible. Each gate has retry logic and produces structured results.

## Current State

- The coding-agent backend has no formalized validation gate system
- E2E tests exist via Playwright in `projects/application/e2e/`
- Unit tests exist for the application backend (Jest) and frontend (Vitest)
- No automated accessibility, design, or performance validation
- Build tasks exist in `Taskfile.yml`

## Target State

A `GateRunnerService` that executes gates in sequence, captures structured results, and supports retry with bugfixer intervention.

```
Gate Pipeline:
1. BUILD          (~30s)   - Docker image builds
2. UNIT TESTS     (~60s)   - Isolated unit tests
3. DEPLOYMENT     (~90s)   - Full stack healthy in sandbox
4. INTEGRATION    (~60s)   - Tests against live services
5. LOG AUDIT      (~10s)   - No errors in logs
6. API VALIDATION (~30s)   - Endpoints return expected data
7. DB VALIDATION  (~15s)   - Schema and data integrity
8. E2E TESTS      (~2-5m)  - Playwright against deployed env
9. ACCESSIBILITY  (~30s)   - axe-core WCAG AA
10. DESIGN REVIEW (~2-3m)  - Visual + design system
11. PERFORMANCE   (~1-2m)  - Response times, regressions
```

## Implementation Steps

### Step 1: Define Gate Interface

Create `src/agents/gates/gate.interface.ts`:

```typescript
export interface ValidationGate {
  name: string;
  description: string;
  phase: 1 | 2;               // Phase 1 gates are MVP, Phase 2 added later
  applicableTo: 'all' | 'frontend' | 'backend';
  run(context: GateContext): Promise<GateResult>;
}

export interface GateContext {
  taskId: string;
  worktreePath: string;
  namespace: string;           // env-{taskId}
  branch: string;
  touchesFrontend: boolean;
  touchesBackend: boolean;
}

export interface GateResult {
  gate: string;
  passed: boolean;
  output: string;              // Human-readable output
  details?: Record<string, unknown>;  // Structured data
  durationMs: number;
  attempt: number;
}
```

### Step 2: Create Gate Runner Service

Create `src/agents/gates/gate-runner.service.ts`:

```typescript
@Injectable()
export class GateRunnerService {
  private gates: Map<string, ValidationGate>;

  constructor(
    private stateService: TaskStateService,
    private transcriptWriter: TranscriptWriterService,
  ) {
    this.registerGates();
  }

  async run(gateName: string, task: Task, attempt: number = 1): Promise<GateResult> {
    const gate = this.gates.get(gateName);
    if (!gate) throw new Error(`Unknown gate: ${gateName}`);

    // Skip non-applicable gates
    if (gate.applicableTo === 'frontend' && !task.touchesFrontend) {
      return { gate: gateName, passed: true, output: 'Skipped (no frontend changes)', durationMs: 0, attempt };
    }

    const start = Date.now();
    const context: GateContext = {
      taskId: task.id,
      worktreePath: task.worktreePath!,
      namespace: `env-${task.id}`,
      branch: task.branch,
      touchesFrontend: task.touchesFrontend,
      touchesBackend: true,  // Determine from changed files
    };

    const result = await gate.run(context);
    result.attempt = attempt;
    result.durationMs = Date.now() - start;

    // Persist gate result
    await this.stateService.saveGateResult(task.id, result);

    // Log to transcript
    this.transcriptWriter.logEvent(task.id, {
      type: 'gate_result',
      gate: gateName,
      passed: result.passed,
      attempt,
      durationMs: result.durationMs,
    });

    return result;
  }

  async runSequence(gateNames: string[], task: Task): Promise<GateResult[]> {
    const results: GateResult[] = [];
    for (const name of gateNames) {
      const result = await this.run(name, task);
      results.push(result);
      if (!result.passed) break;  // Fail fast
    }
    return results;
  }
}
```

### Step 3: Implement Phase 1 Gates

**Gate 1: BUILD**

```typescript
export class BuildGate implements ValidationGate {
  name = 'build';
  description = 'Docker image builds successfully';
  phase = 1 as const;
  applicableTo = 'all' as const;

  constructor(private taskfile: TaskfileService) {}

  async run(context: GateContext): Promise<GateResult> {
    try {
      const output = await this.taskfile.run('env:build', context.taskId, {
        env: { WORKTREE_PATH: context.worktreePath },
      });
      return { gate: this.name, passed: true, output, durationMs: 0, attempt: 0 };
    } catch (error) {
      return { gate: this.name, passed: false, output: String(error), durationMs: 0, attempt: 0 };
    }
  }
}
```

**Gate 2: UNIT TESTS**

```typescript
export class UnitTestGate implements ValidationGate {
  name = 'unit-tests';
  description = 'Unit tests pass';
  phase = 1 as const;
  applicableTo = 'all' as const;

  async run(context: GateContext): Promise<GateResult> {
    try {
      // Run backend tests
      const backendResult = await exec('npm test', {
        cwd: path.join(context.worktreePath, 'projects/application/backend'),
      });

      // Run frontend tests if applicable
      let frontendResult = '';
      if (context.touchesFrontend) {
        frontendResult = await exec('npm test', {
          cwd: path.join(context.worktreePath, 'projects/application/frontend'),
        });
      }

      return {
        gate: this.name,
        passed: true,
        output: [backendResult, frontendResult].join('\n'),
        durationMs: 0,
        attempt: 0,
      };
    } catch (error) {
      return { gate: this.name, passed: false, output: String(error), durationMs: 0, attempt: 0 };
    }
  }
}
```

**Gate 3: DEPLOYMENT**

```typescript
export class DeploymentGate implements ValidationGate {
  name = 'deployment';
  description = 'Full stack is healthy in sandbox namespace';
  phase = 1 as const;
  applicableTo = 'all' as const;

  constructor(private taskfile: TaskfileService) {}

  async run(context: GateContext): Promise<GateResult> {
    try {
      const healthOutput = await this.taskfile.run('env:health', context.taskId);
      const allHealthy = !healthOutput.includes('UNHEALTHY');
      return {
        gate: this.name,
        passed: allHealthy,
        output: healthOutput,
        durationMs: 0,
        attempt: 0,
      };
    } catch (error) {
      return { gate: this.name, passed: false, output: String(error), durationMs: 0, attempt: 0 };
    }
  }
}
```

**Gate 5: LOG AUDIT**

```typescript
export class LogAuditGate implements ValidationGate {
  name = 'log-audit';
  description = 'No errors in service logs';
  phase = 1 as const;
  applicableTo = 'all' as const;

  constructor(private taskfile: TaskfileService) {}

  async run(context: GateContext): Promise<GateResult> {
    const errorLogs = await this.taskfile.run('env:logs:errors', context.taskId);
    const hasErrors = errorLogs.trim() !== '' && !errorLogs.includes('No errors found');
    return {
      gate: this.name,
      passed: !hasErrors,
      output: hasErrors ? errorLogs : 'No errors in logs',
      durationMs: 0,
      attempt: 0,
    };
  }
}
```

### Step 4: Implement Phase 2 Gates (Stubs)

These gates are more complex and belong to Phase 2. Create stubs that always pass:

**Gate 4: INTEGRATION TESTS** — Depends on having integration test infrastructure. Stub for Phase 1.

**Gate 6: API VALIDATION** — Needs OpenAPI spec or endpoint registry. Stub for Phase 1.

**Gate 7: DATABASE VALIDATION** — Needs schema expectations. Stub for Phase 1.

**Gate 8: E2E TESTS** — Uses Playwright against deployed env. See Plan 14 for full implementation.

**Gate 9: ACCESSIBILITY** — Uses axe-core. See Plan 14.

**Gate 10: DESIGN REVIEW** — Uses Claude Vision. See Plan 14.

**Gate 11: PERFORMANCE** — Uses autocannon/Playwright metrics. See Plan 15.

```typescript
// Stub gate for Phase 2
export class StubGate implements ValidationGate {
  phase = 2 as const;
  applicableTo = 'all' as const;

  constructor(
    public name: string,
    public description: string,
  ) {}

  async run(): Promise<GateResult> {
    return {
      gate: this.name,
      passed: true,
      output: `Gate '${this.name}' is not yet implemented (Phase 2)`,
      durationMs: 0,
      attempt: 0,
    };
  }
}
```

### Step 5: Create Gate Results Storage

Gate results are stored as JSON in the task state directory:

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
  "timestamp": "2026-04-01T10:00:30.000Z"
}
```

### Step 6: Create Gate Sequence Configuration

Define the default gate sequence and allow per-task customization:

```typescript
const DEFAULT_GATE_SEQUENCE = [
  'build',
  'unit-tests',
  'deployment',
  'integration-tests',
  'log-audit',
  'api-validation',
  'database-validation',
  'e2e-tests',
  'accessibility',
  'design-review',
  'performance',
];
```

## Verification

- [ ] GateRunnerService runs all registered gates
- [ ] Gates execute in the defined order
- [ ] Failed gate stops the sequence (fail-fast)
- [ ] Gate results are persisted to state directory
- [ ] Gate results are logged to transcript
- [ ] Phase 1 gates (build, unit-tests, deployment, log-audit) produce real results
- [ ] Phase 2 stubs pass without error
- [ ] Retry logic re-runs failed gates after bugfixer intervention

## Open Questions

- **Gate parallelism:** Some gates are independent (log-audit + api-validation). Could run in parallel for speed. Worth the complexity?
- **Gate configuration:** Should gates be configurable per-project? E.g., a project without a frontend would skip design-review and accessibility gates entirely.
- **Gate thresholds:** Some gates are binary (build pass/fail), others are fuzzy (performance — how much regression is acceptable?). Define thresholds in config.
