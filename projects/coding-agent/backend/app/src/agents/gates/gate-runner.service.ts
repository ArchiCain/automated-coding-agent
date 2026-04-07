import { Injectable, Logger } from '@nestjs/common';
import { ValidationGate, GateContext, GateResult } from './gate.interface';
import { Task } from '../../core/interfaces/task.interface';
import { TaskfileService } from '../../shared/taskfile.service';
import { DevTeamConfigService } from '../../config/dev-team-config.service';

// Phase 1 gates
import { BuildGate } from './implementations/build.gate';
import { UnitTestGate } from './implementations/unit-test.gate';
import { DeploymentGate } from './implementations/deployment.gate';
import { LogAuditGate } from './implementations/log-audit.gate';

// Phase 2 gates
import { IntegrationTestGate } from './implementations/integration-test.gate';
import { ApiValidationGate } from './implementations/api-validation.gate';
import { DatabaseValidationGate } from './implementations/database-validation.gate';
import { E2ETestGate } from './implementations/e2e-test.gate';
import { AccessibilityGate } from './implementations/accessibility.gate';
import { DesignReviewGate } from './implementations/design-review.gate';
import { PerformanceGate } from './implementations/performance.gate';

@Injectable()
export class GateRunnerService {
  private readonly logger = new Logger(GateRunnerService.name);
  private readonly gates = new Map<string, ValidationGate>();

  constructor(
    private readonly taskfileService: TaskfileService,
    private readonly configService: DevTeamConfigService,
  ) {
    this.registerGates();
  }

  /**
   * Instantiate and register all validation gates.
   */
  private registerGates(): void {
    const gateInstances: ValidationGate[] = [
      // Phase 1
      new BuildGate(this.taskfileService),
      new UnitTestGate(),
      new DeploymentGate(this.taskfileService),
      new LogAuditGate(this.taskfileService),
      // Phase 2
      new IntegrationTestGate(),
      new ApiValidationGate(),
      new DatabaseValidationGate(),
      new E2ETestGate(),
      new AccessibilityGate(),
      new DesignReviewGate(),
      new PerformanceGate(),
    ];

    for (const gate of gateInstances) {
      this.gates.set(gate.name, gate);
    }

    this.logger.log(
      `Registered ${this.gates.size} gates: ${Array.from(this.gates.keys()).join(', ')}`,
    );
  }

  /**
   * Run a single gate by name.
   *
   * Skips gates that are not applicable to the current task context.
   * Returns the gate result with the attempt number set.
   */
  async run(
    gateName: string,
    task: Task,
    attempt = 1,
  ): Promise<GateResult> {
    const gate = this.gates.get(gateName);
    if (!gate) {
      this.logger.warn(`Gate "${gateName}" not found — skipping`);
      return {
        gate: gateName,
        passed: true,
        output: `Gate "${gateName}" not registered — skipped`,
        durationMs: 0,
        attempt,
      };
    }

    // Check applicability
    const context = this.buildContext(task);
    if (!this.isApplicable(gate, context)) {
      this.logger.debug(
        `Skipping gate "${gateName}" — not applicable (applicableTo=${gate.applicableTo}, touchesFrontend=${context.touchesFrontend}, touchesBackend=${context.touchesBackend})`,
      );
      return {
        gate: gateName,
        passed: true,
        output: `Gate "${gateName}" skipped — not applicable to this task`,
        details: { skipped: true, reason: 'not applicable' },
        durationMs: 0,
        attempt,
      };
    }

    this.logger.log(
      `Running gate "${gateName}" (attempt ${attempt}) for task ${task.id}`,
    );

    const start = Date.now();
    try {
      const result = await gate.run(context);
      result.attempt = attempt;

      const status = result.passed ? 'PASSED' : 'FAILED';
      this.logger.log(
        `Gate "${gateName}" ${status} in ${result.durationMs}ms (attempt ${attempt})`,
      );

      return result;
    } catch (err) {
      // Gates should not throw, but handle it gracefully if they do
      const error = err as Error;
      this.logger.error(
        `Gate "${gateName}" threw an unexpected error: ${error.message}`,
      );
      return {
        gate: gateName,
        passed: false,
        output: `Gate "${gateName}" threw an error: ${error.message}`,
        details: { error: error.message, stack: error.stack },
        durationMs: Date.now() - start,
        attempt,
      };
    }
  }

  /**
   * Run a sequence of gates in order.
   * Fails fast on the first gate failure.
   *
   * Returns all results collected up to and including the first failure.
   */
  async runSequence(
    gateNames: string[],
    task: Task,
  ): Promise<{ results: GateResult[]; allPassed: boolean }> {
    const results: GateResult[] = [];
    let allPassed = true;

    for (const gateName of gateNames) {
      const result = await this.run(gateName, task);
      results.push(result);

      if (!result.passed) {
        allPassed = false;
        this.logger.warn(
          `Gate sequence failed at "${gateName}" for task ${task.id} — stopping`,
        );
        break;
      }
    }

    return { results, allPassed };
  }

  /**
   * Build a GateContext from a Task.
   */
  private buildContext(task: Task): GateContext {
    return {
      taskId: task.id,
      worktreePath: task.worktreePath ?? process.cwd(),
      namespace: task.namespace ?? '',
      branch: task.branch,
      touchesFrontend: task.touchesFrontend,
      touchesBackend: !task.touchesFrontend || true, // Default: assume backend is always touched
      executionMode: this.configService.executionMode,
    };
  }

  /**
   * Determine whether a gate is applicable to the current context.
   */
  private isApplicable(gate: ValidationGate, context: GateContext): boolean {
    if (gate.applicableTo === 'all') return true;
    if (gate.applicableTo === 'frontend') return context.touchesFrontend;
    if (gate.applicableTo === 'backend') return context.touchesBackend;
    return true;
  }
}
