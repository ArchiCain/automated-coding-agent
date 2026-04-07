import { Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

const execFile = promisify(execFileCb);

interface PerformanceBaseline {
  endpoints: Record<
    string,
    {
      p50: number;
      p95: number;
      p99: number;
    }
  >;
  frontend?: {
    lcp?: number;
    fcp?: number;
    cls?: number;
    tti?: number;
  };
  regressionThreshold?: number;
}

interface MetricComparison {
  endpoint: string;
  metric: string;
  baseline: number;
  current: number;
  regressionPct: number;
  passed: boolean;
}

export class PerformanceGate implements ValidationGate {
  readonly name = 'performance';
  readonly description = 'Measures API response times and compares against baselines';
  readonly phase = 2 as const;
  readonly applicableTo = 'all' as const;

  private readonly logger = new Logger(PerformanceGate.name);
  private readonly defaultThreshold = 0.2; // 20% regression threshold

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();

    try {
      const baselinesPath = path.join(
        context.worktreePath,
        '.the-dev-team',
        'baselines',
        'performance.json',
      );

      let baselines: PerformanceBaseline;
      try {
        const raw = await fs.readFile(baselinesPath, 'utf-8');
        baselines = JSON.parse(raw) as PerformanceBaseline;
      } catch {
        // No baselines file — skip performance checks
        return {
          gate: this.name,
          passed: true,
          output: 'No performance baselines found — skipping comparison',
          details: { skipped: true },
          durationMs: Date.now() - start,
          attempt: 1,
        };
      }

      const threshold = baselines.regressionThreshold ?? this.defaultThreshold;
      const comparisons: MetricComparison[] = [];
      let allPassed = true;

      // Measure API response times
      for (const [endpoint, baseline] of Object.entries(baselines.endpoints)) {
        const timings = await this.measureEndpoint(endpoint, context, 10);

        if (timings.length === 0) {
          comparisons.push({
            endpoint,
            metric: 'reachability',
            baseline: 0,
            current: -1,
            regressionPct: 1,
            passed: false,
          });
          allPassed = false;
          continue;
        }

        timings.sort((a, b) => a - b);
        const current = {
          p50: timings[Math.floor(timings.length * 0.5)],
          p95: timings[Math.floor(timings.length * 0.95)],
          p99: timings[Math.floor(timings.length * 0.99)],
        };

        for (const metric of ['p50', 'p95', 'p99'] as const) {
          const baselineVal = baseline[metric];
          const currentVal = current[metric];
          const regressionPct =
            baselineVal > 0 ? (currentVal - baselineVal) / baselineVal : 0;
          const passed = regressionPct <= threshold;

          if (!passed) allPassed = false;

          comparisons.push({
            endpoint,
            metric,
            baseline: baselineVal,
            current: currentVal,
            regressionPct,
            passed,
          });
        }
      }

      // Measure frontend metrics if applicable
      if (context.touchesFrontend && baselines.frontend) {
        const frontendResults = await this.measureFrontendMetrics(context);
        if (frontendResults) {
          for (const [metric, baselineVal] of Object.entries(baselines.frontend)) {
            if (baselineVal == null) continue;
            const currentVal = frontendResults[metric as keyof typeof frontendResults];
            if (currentVal == null) continue;

            const regressionPct =
              baselineVal > 0 ? (currentVal - baselineVal) / baselineVal : 0;
            const passed = regressionPct <= threshold;

            if (!passed) allPassed = false;

            comparisons.push({
              endpoint: 'frontend',
              metric,
              baseline: baselineVal,
              current: currentVal,
              regressionPct,
              passed,
            });
          }
        }
      }

      const output = this.formatComparison(comparisons, threshold);

      return {
        gate: this.name,
        passed: allPassed,
        output,
        details: {
          comparisons,
          threshold,
          endpointCount: Object.keys(baselines.endpoints).length,
        },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Performance gate error for task ${context.taskId}: ${error.message}`);

      return {
        gate: this.name,
        passed: false,
        output: `Performance gate error: ${error.message}`,
        details: { error: error.message },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }
  }

  private async measureEndpoint(
    endpoint: string,
    context: GateContext,
    count: number,
  ): Promise<number[]> {
    const timings: number[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const url = endpoint.startsWith('http')
          ? endpoint
          : `http://localhost:${context.namespace || '8085'}${endpoint}`;

        const start = Date.now();
        await execFile('curl', ['-sf', '--max-time', '10', '-o', '/dev/null', '-w', '', url], {
          timeout: 15_000,
        });
        timings.push(Date.now() - start);
      } catch {
        // Request failed — skip this measurement
        this.logger.debug(`Request to ${endpoint} failed (attempt ${i + 1}/${count})`);
      }
    }

    return timings;
  }

  private async measureFrontendMetrics(
    context: GateContext,
  ): Promise<Record<string, number> | null> {
    try {
      const e2eDir = path.join(context.worktreePath, 'projects', 'coding-agent', 'e2e');
      const baseUrl = `http://localhost:3000`;

      // Use Playwright to measure web vitals
      const script = `
        const { chromium } = require('playwright');
        (async () => {
          const browser = await chromium.launch();
          const page = await browser.newPage();
          const metrics = {};
          page.on('console', msg => {
            try {
              const data = JSON.parse(msg.text());
              if (data.type === 'web-vital') {
                metrics[data.name] = data.value;
              }
            } catch {}
          });
          await page.goto('${baseUrl}', { waitUntil: 'networkidle' });
          await page.waitForTimeout(3000);
          const perfEntries = await page.evaluate(() => {
            const entries = performance.getEntriesByType('paint');
            const result = {};
            for (const entry of entries) {
              if (entry.name === 'first-contentful-paint') result.fcp = entry.startTime;
            }
            const lcp = performance.getEntriesByType('largest-contentful-paint');
            if (lcp.length > 0) result.lcp = lcp[lcp.length - 1].startTime;
            return result;
          });
          Object.assign(metrics, perfEntries);
          await browser.close();
          console.log(JSON.stringify(metrics));
        })();
      `;

      const { stdout } = await execFile('node', ['-e', script], {
        cwd: e2eDir,
        timeout: 30_000,
        env: { ...process.env, BASE_URL: baseUrl },
      });

      return JSON.parse(stdout.trim()) as Record<string, number>;
    } catch (err) {
      this.logger.debug(`Frontend metrics measurement failed: ${(err as Error).message}`);
      return null;
    }
  }

  private formatComparison(
    comparisons: MetricComparison[],
    threshold: number,
  ): string {
    if (comparisons.length === 0) {
      return 'No performance comparisons to report';
    }

    const lines: string[] = [
      `Performance Report (regression threshold: ${(threshold * 100).toFixed(0)}%)`,
      '',
      '| Endpoint | Metric | Baseline (ms) | Current (ms) | Regression | Status |',
      '|----------|--------|--------------|-------------|------------|--------|',
    ];

    for (const c of comparisons) {
      const regressionStr =
        c.current === -1
          ? 'N/A'
          : `${(c.regressionPct * 100).toFixed(1)}%`;
      const status = c.passed ? 'PASS' : 'FAIL';
      const baselineStr = c.baseline >= 0 ? c.baseline.toFixed(0) : 'N/A';
      const currentStr = c.current >= 0 ? c.current.toFixed(0) : 'UNREACHABLE';

      lines.push(
        `| ${c.endpoint} | ${c.metric} | ${baselineStr} | ${currentStr} | ${regressionStr} | ${status} |`,
      );
    }

    const failCount = comparisons.filter((c) => !c.passed).length;
    lines.push('');
    lines.push(
      failCount === 0
        ? 'All metrics within acceptable thresholds.'
        : `${failCount} metric(s) exceeded the regression threshold.`,
    );

    return lines.join('\n');
  }
}
