# Skill: Performance

You are running **performance checks** to ensure the application meets response time
and throughput baselines, and to detect regressions.

---

## API Performance Checks

### Quick Response Time Check

Use `curl` with timing to measure individual endpoint performance:

```bash
# Measure a single request with detailed timing
curl -w "\n---\nDNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\nStatus: %{http_code}\n" \
  -o /dev/null -s \
  "${API_BASE_URL}/api/health"

# Measure multiple endpoints
for endpoint in "/api/health" "/api/features" "/api/users"; do
  echo "--- $endpoint ---"
  curl -w "TTFB: %{time_starttransfer}s | Total: %{time_total}s | Status: %{http_code}\n" \
    -o /dev/null -s \
    "${API_BASE_URL}${endpoint}"
done
```

### Baseline Targets

| Metric | Target | Regression Threshold |
|--------|--------|---------------------|
| Health endpoint TTFB | < 50ms | > 100ms |
| List endpoint TTFB (empty) | < 100ms | > 200ms |
| List endpoint TTFB (100 rows) | < 200ms | > 400ms |
| Single item GET TTFB | < 80ms | > 160ms |
| Create/Update POST TTFB | < 150ms | > 300ms |
| Complex query TTFB | < 500ms | > 1000ms |

Regression threshold: any endpoint that is **more than 2x its baseline** (or
**more than 20% slower than the previous measurement**) is a regression.

---

## Load Testing with Autocannon

### Installation

```bash
npx autocannon --help  # Uses npx, no global install needed
```

### Basic Load Test

```bash
# 10 concurrent connections, 30 seconds duration
npx autocannon -c 10 -d 30 "${API_BASE_URL}/api/features"

# POST endpoint with body
npx autocannon -c 10 -d 30 \
  -m POST \
  -H "Content-Type: application/json" \
  -b '{"name":"load-test","description":"perf check"}' \
  "${API_BASE_URL}/api/features"
```

### Interpreting Results

Autocannon outputs a table with latency percentiles and throughput:

```
┌─────────┬──────┬──────┬───────┬──────┬─────────┐
│ Stat    │ 2.5% │ 50%  │ 97.5% │ 99%  │ Avg     │
├─────────┼──────┼──────┼───────┼──────┼─────────┤
│ Latency │ 5 ms │ 12ms │ 45ms  │ 80ms │ 15ms    │
└─────────┴──────┴──────┴───────┴──────┴─────────┘
```

Key metrics to record:
- **p50 latency** — Typical user experience.
- **p99 latency** — Worst case for 1% of requests.
- **Throughput (req/sec)** — Overall capacity.
- **Errors** — Any non-2xx responses under load.

### Load Test Baselines

| Scenario | Connections | Duration | p50 Target | p99 Target | Error Rate |
|----------|------------|----------|------------|------------|------------|
| Light load | 5 | 30s | < 50ms | < 200ms | 0% |
| Normal load | 20 | 60s | < 100ms | < 500ms | < 0.1% |
| Stress test | 50 | 60s | < 200ms | < 1000ms | < 1% |

---

## Frontend Performance Metrics

### Measuring with Playwright

```typescript
import { test, expect } from '@playwright/test';

test('frontend performance metrics', async ({ page }) => {
  // Navigate and wait for load
  await page.goto('/features');
  await page.waitForLoadState('networkidle');

  // Get performance metrics
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    const lcp = new Promise<number>(resolve => {
      new PerformanceObserver(list => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1].startTime);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      // Fallback timeout
      setTimeout(() => resolve(-1), 5000);
    });

    return {
      ttfb: nav.responseStart - nav.requestStart,
      domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
      loadComplete: nav.loadEventEnd - nav.fetchStart,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime ?? -1,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime ?? -1,
    };
  });

  console.log('Performance metrics:', JSON.stringify(metrics, null, 2));

  // Assert baselines
  expect(metrics.ttfb).toBeLessThan(500);
  expect(metrics.domContentLoaded).toBeLessThan(2000);
  expect(metrics.firstContentfulPaint).toBeLessThan(1500);
});
```

### Frontend Baselines

| Metric | Target | Regression Threshold |
|--------|--------|---------------------|
| TTFB | < 200ms | > 400ms |
| First Contentful Paint (FCP) | < 1000ms | > 1500ms |
| Largest Contentful Paint (LCP) | < 2500ms | > 3000ms |
| DOM Content Loaded | < 1500ms | > 2000ms |
| Total page load | < 3000ms | > 4000ms |

---

## Baseline Comparison

### Recording Baselines

After each successful performance run, save results:

```bash
# Save API performance baseline
cat > performance-baselines/api-$(date +%Y%m%d).json << 'EOF'
{
  "date": "2025-01-15",
  "commit": "abc1234",
  "endpoints": {
    "/api/health": { "p50": 12, "p99": 45, "unit": "ms" },
    "/api/features": { "p50": 35, "p99": 120, "unit": "ms" },
    "/api/features/:id": { "p50": 28, "p99": 95, "unit": "ms" }
  }
}
EOF
```

### Comparing Against Baseline

```bash
# Compare current results against last baseline
# Regression = current p50 > baseline p50 * 1.2 (20% threshold)

BASELINE_P50=35
CURRENT_P50=44
THRESHOLD=$(echo "$BASELINE_P50 * 1.2" | bc)

if (( $(echo "$CURRENT_P50 > $THRESHOLD" | bc -l) )); then
  echo "REGRESSION: /api/features p50 increased from ${BASELINE_P50}ms to ${CURRENT_P50}ms (threshold: ${THRESHOLD}ms)"
fi
```

---

## Regression Detection

### 20% Rule

A performance regression is defined as:
- Any endpoint where **p50 latency increases by more than 20%** compared to the baseline.
- Any endpoint where **p99 latency increases by more than 50%** compared to the baseline.
- Any endpoint where **error rate exceeds 0.1%** under normal load.
- Frontend LCP exceeding 2500ms.

### Performance Gate

When a regression is detected:

1. **Verify** — Run the test 3 times to rule out noise.
2. **Identify** — Check which commit introduced the regression using `git bisect` logic.
3. **Report** — File a performance issue with:
   - Endpoint affected
   - Baseline vs. current numbers
   - Suspected commit
   - Suggested investigation areas (N+1 queries, missing indexes, large payloads)
4. **Block** — Do not approve the PR until the regression is resolved or acknowledged.

---

## Common Performance Issues

| Symptom | Likely Cause | Investigation |
|---------|-------------|---------------|
| Slow list endpoints | Missing database index | `EXPLAIN ANALYZE` on the query |
| Slow after adding relations | N+1 query problem | Check for eager loading, add `relations` to `find()` |
| Slow POST/PUT | Large transaction | Check if multiple operations can be batched |
| High p99 but normal p50 | Connection pool exhaustion | Check pool size, connection leaks |
| Slow first request | Cold start / JIT | Warm up the service before measuring |
| Frontend LCP regression | Large unoptimized images | Check network tab, compress images |
