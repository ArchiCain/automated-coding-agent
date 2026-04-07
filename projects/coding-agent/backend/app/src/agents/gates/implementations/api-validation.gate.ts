import { Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

const execFile = promisify(execFileCb);

export class ApiValidationGate implements ValidationGate {
  readonly name = 'api-validation';
  readonly description = 'Validates API contract conformance by building and scanning route decorators';
  readonly phase = 2 as const;
  readonly applicableTo = 'backend' as const;

  private readonly logger = new Logger(ApiValidationGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();
    const results: string[] = [];
    let passed = true;

    const backendAppDir = path.join(
      context.worktreePath,
      'projects',
      'coding-agent',
      'backend',
      'app',
    );

    // Step 1: Run npm run build to verify compilation (no type errors in controllers)
    try {
      this.logger.log(
        `Running backend build for API validation on task ${context.taskId}`,
      );

      const { stdout, stderr } = await execFile('npx', ['tsc', '--noEmit'], {
        cwd: backendAppDir,
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 10,
      });

      results.push('[Build Check] TypeScript compilation succeeded');
      if (stdout) results.push(stdout.trim());
      if (stderr) results.push(stderr.trim());
    } catch (err) {
      passed = false;
      const error = err as Error & { stdout?: string; stderr?: string };
      results.push(
        `[Build Check - FAILED] TypeScript compilation errors found:\n${error.stdout || ''}\n${error.stderr || ''}\n${error.message}`,
      );

      // If build fails, return early — route scanning would be unreliable
      return {
        gate: this.name,
        passed: false,
        output: results.join('\n\n'),
        details: { buildFailed: true },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }

    // Step 2: Scan for NestJS route decorators to build a route map
    const srcDir = path.join(backendAppDir, 'src');
    const routeSummary = await this.scanRoutes(srcDir);

    results.push(`[Route Scan]\n${routeSummary.summary}`);

    if (routeSummary.controllerCount === 0) {
      results.push(
        '[Warning] No @Controller decorators found. This may indicate the source directory is not structured as expected.',
      );
    }

    return {
      gate: this.name,
      passed,
      output: results.join('\n\n'),
      details: {
        controllers: routeSummary.controllerCount,
        routes: routeSummary.routeCount,
        routeDetails: routeSummary.routes,
      },
      durationMs: Date.now() - start,
      attempt: 1,
    };
  }

  private async scanRoutes(
    srcDir: string,
  ): Promise<{
    controllerCount: number;
    routeCount: number;
    routes: Array<{ controller: string; method: string; path: string }>;
    summary: string;
  }> {
    const routes: Array<{ controller: string; method: string; path: string }> = [];
    let controllerCount = 0;

    try {
      const controllerFiles = await this.findFiles(srcDir, /\.controller\.ts$/);

      for (const filePath of controllerFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const controllerMatch = content.match(
            /@Controller\(\s*['"`]([^'"`]*)['"`]\s*\)/,
          );

          if (controllerMatch) {
            controllerCount++;
            const basePath = controllerMatch[1];

            // Scan for HTTP method decorators
            const httpMethods = [
              { decorator: '@Get', method: 'GET' },
              { decorator: '@Post', method: 'POST' },
              { decorator: '@Put', method: 'PUT' },
              { decorator: '@Patch', method: 'PATCH' },
              { decorator: '@Delete', method: 'DELETE' },
            ];

            for (const { decorator, method } of httpMethods) {
              const regex = new RegExp(
                `${decorator.replace('(', '\\(')}\\(\\s*(?:['"\`]([^'"\`]*)['"\`])?\\s*\\)`,
                'g',
              );
              let match: RegExpExecArray | null;
              while ((match = regex.exec(content)) !== null) {
                const routePath = match[1] || '';
                routes.push({
                  controller: basePath,
                  method,
                  path: `/${basePath}${routePath ? '/' + routePath : ''}`.replace(
                    /\/+/g,
                    '/',
                  ),
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch (err) {
      return {
        controllerCount: 0,
        routeCount: 0,
        routes: [],
        summary: `Error scanning routes: ${(err as Error).message}`,
      };
    }

    const lines = routes.map(
      (r) => `  ${r.method.padEnd(7)} ${r.path}`,
    );
    const summary = [
      `Found ${controllerCount} controller(s) with ${routes.length} route(s):`,
      ...lines,
    ].join('\n');

    return {
      controllerCount,
      routeCount: routes.length,
      routes,
      summary,
    };
  }

  private async findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
          const subResults = await this.findFiles(fullPath, pattern);
          results.push(...subResults);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory not readable — skip
    }

    return results;
  }
}
