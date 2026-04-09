# 15 — Performance Validation

## Goal

Implement the performance validation gate that catches regressions before they reach production. Compare API response times, frontend load metrics, and database query performance against baselines from the main branch.

## Current State

- No automated performance testing
- No baseline metrics stored
- No load testing tools in the project
- Application backend logs exist but aren't structured for performance analysis

## Target State

- Performance baselines stored and updated after each merge to main
- API response time checks (p50, p95, p99) per endpoint
- Frontend load metrics via Playwright (TTFB, LCP, DOM content loaded)
- Lightweight load testing with autocannon
- Regression detection with configurable thresholds (default: 20% slower = fail)
- Performance skill document for the devops/tester roles

## Implementation Steps

### Step 1: Create Performance Skill

Create `skills/performance/SKILL.md`:

```markdown
# Performance Skill

## Your Role
Validate that changes don't introduce performance regressions.

## API Performance Check
For each API endpoint, measure response time:
```bash
for endpoint in /api/health /api/users /api/auth/profile; do
  TIME=$(curl -w '%{time_total}' -o /dev/null -s \
    http://backend.env-{task-id}.svc.cluster.local:8085${endpoint})
  echo "$endpoint: ${TIME}s"
done
```

## Load Testing
Run a lightweight load test with autocannon:
```bash
npx autocannon -c 10 -d 15 \
  http://backend.env-{task-id}.svc.cluster.local:8085/api/users
```

Compare results against baselines in `.the-dev-team/baselines/performance.json`.

## Frontend Metrics
Use Playwright to capture:
- Time to First Byte (TTFB)
- DOM Content Loaded
- Largest Contentful Paint (LCP)
- Total page load time

## Regression Threshold
A metric regresses if it is >20% slower than the baseline.
If any metric regresses beyond threshold, the gate fails.
```

### Step 2: Create Baseline Storage

Create `.the-dev-team/baselines/performance.json`:

```json
{
  "updatedAt": "2026-04-01T00:00:00Z",
  "branch": "main",
  "api": {
    "/api/health": { "p50": 5, "p95": 15, "p99": 25 },
    "/api/users": { "p50": 35, "p95": 65, "p99": 120 }
  },
  "frontend": {
    "/": { "ttfb": 50, "domContentLoaded": 800, "lcp": 1200, "load": 1500 },
    "/dashboard": { "ttfb": 60, "domContentLoaded": 900, "lcp": 1400, "load": 1800 }
  },
  "regressionThreshold": 0.20
}
```

Baselines are updated automatically when PRs merge to main (via CI or a scheduled job that measures the main deployment).

### Step 3: Implement Performance Gate

Create `src/agents/gates/performance.gate.ts`:

```typescript
export class PerformanceGate implements ValidationGate {
  name = 'performance';
  description = 'Response times within thresholds, no regressions';
  phase = 2 as const;
  applicableTo = 'all' as const;

  async run(context: GateContext): Promise<GateResult> {
    const baselines = await this.loadBaselines();
    const current = await this.measurePerformance(context);
    const regressions = this.detectRegressions(baselines, current);

    if (regressions.length > 0) {
      return {
        gate: this.name,
        passed: false,
        output: `Performance regressions detected:\n${regressions.map(r =>
          `${r.endpoint}: ${r.metric} regressed ${r.percentChange}% (${r.baseline}ms → ${r.current}ms)`
        ).join('\n')}`,
        details: { regressions },
        durationMs: 0,
        attempt: 0,
      };
    }

    return {
      gate: this.name,
      passed: true,
      output: this.formatComparison(baselines, current),
      details: { current },
      durationMs: 0,
      attempt: 0,
    };
  }

  private async measurePerformance(context: GateContext): Promise<PerformanceMetrics> {
    const baseUrl = `http://backend.env-${context.taskId}.svc.cluster.local:8085`;

    // Measure API endpoints
    const apiMetrics: Record<string, EndpointMetrics> = {};
    const endpoints = ['/api/health', '/api/users'];

    for (const endpoint of endpoints) {
      const times: number[] = [];
      // Take 10 samples
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await fetch(`${baseUrl}${endpoint}`);
        times.push(Date.now() - start);
      }
      times.sort((a, b) => a - b);
      apiMetrics[endpoint] = {
        p50: times[Math.floor(times.length * 0.5)],
        p95: times[Math.floor(times.length * 0.95)],
        p99: times[Math.floor(times.length * 0.99)],
      };
    }

    return { api: apiMetrics };
  }

  private detectRegressions(
    baselines: PerformanceBaselines,
    current: PerformanceMetrics,
  ): Regression[] {
    const regressions: Regression[] = [];
    const threshold = baselines.regressionThreshold;

    for (const [endpoint, metrics] of Object.entries(current.api)) {
      const baseline = baselines.api[endpoint];
      if (!baseline) continue;

      for (const metric of ['p50', 'p95', 'p99'] as const) {
        const percentChange = (metrics[metric] - baseline[metric]) / baseline[metric];
        if (percentChange > threshold) {
          regressions.push({
            endpoint,
            metric,
            baseline: baseline[metric],
            current: metrics[metric],
            percentChange: Math.round(percentChange * 100),
          });
        }
      }
    }

    return regressions;
  }

  private formatComparison(baselines: PerformanceBaselines, current: PerformanceMetrics): string {
    const lines = ['| Endpoint | Metric | Baseline | Current | Delta |', '|----------|--------|----------|---------|-------|'];
    for (const [endpoint, metrics] of Object.entries(current.api)) {
      const baseline = baselines.api[endpoint];
      for (const metric of ['p50', 'p95'] as const) {
        const delta = baseline
          ? `${Math.round(((metrics[metric] - baseline[metric]) / baseline[metric]) * 100)}%`
          : 'new';
        lines.push(`| ${endpoint} | ${metric} | ${baseline?.[metric] ?? 'N/A'}ms | ${metrics[metric]}ms | ${delta} |`);
      }
    }
    return lines.join('\n');
  }
}
```

### Step 4: Add Frontend Performance Measurement

Extend the performance gate to measure frontend metrics using Playwright:

```typescript
private async measureFrontendPerformance(context: GateContext): Promise<FrontendMetrics> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const baseUrl = `http://app.env-${context.taskId}.svc.cluster.local`;

  const metrics: Record<string, PageMetrics> = {};

  for (const pagePath of ['/', '/dashboard']) {
    await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'load' });

    const timing = await page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        ttfb: perf.responseStart - perf.requestStart,
        domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
        load: perf.loadEventEnd - perf.navigationStart,
      };
    });

    // LCP
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1].startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(0), 5000);
      });
    });

    metrics[pagePath] = { ...timing, lcp };
  }

  await browser.close();
  return metrics;
}
```

### Step 5: Baseline Update Workflow

Create a GitHub Action or Taskfile command that updates baselines after merge to main:

```yaml
# In .github/workflows/update-baselines.yml
name: Update Performance Baselines

on:
  push:
    branches: [main]

jobs:
  update:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Measure performance against main deployment
        run: task performance:measure-baselines
      - name: Commit updated baselines
        run: |
          git add .the-dev-team/baselines/performance.json
          git diff --cached --quiet || \
            git commit -m "chore: update performance baselines"
          git push
```

### Step 6: Add Performance Data to PR Description

The PR Manager (Plan 13) includes performance comparison in the PR body:

```markdown
### Performance
| Endpoint | Baseline p95 | Current p95 | Delta |
|----------|-------------|-------------|-------|
| GET /api/users | 65ms | 62ms | -5% |
| GET /api/health | 15ms | 14ms | -7% |
```

## Verification

- [ ] Performance baselines file exists with API and frontend metrics
- [ ] Performance gate measures API response times correctly
- [ ] Frontend metrics are captured via Playwright
- [ ] Regressions beyond threshold (20%) fail the gate
- [ ] Performance comparison table is included in PR description
- [ ] Baselines are updated after merge to main

## Open Questions

- **Load testing scope:** Should the agent run full load tests (autocannon) or just latency checks? Load tests are slower and may be noisy in resource-constrained sandbox environments. Start with simple latency checks; add load testing in Phase 4.
- **Baseline accuracy:** Sandbox environments have minimal resources — baselines from main may have different resource levels. Normalize for resource differences, or maintain separate sandbox baselines?
- **Database query performance:** Should the performance gate measure database query times? This requires structured logging with query duration. Add this when the structured logging requirement (Plan architecture doc) is implemented.
