// Gate interface
export { ValidationGate, GateContext, GateResult } from './gate.interface';

// Gate runner service
export { GateRunnerService } from './gate-runner.service';

// Phase 1 gates
export { BuildGate } from './implementations/build.gate';
export { UnitTestGate } from './implementations/unit-test.gate';
export { DeploymentGate } from './implementations/deployment.gate';
export { LogAuditGate } from './implementations/log-audit.gate';

// Phase 2 gates
export { IntegrationTestGate } from './implementations/integration-test.gate';
export { ApiValidationGate } from './implementations/api-validation.gate';
export { DatabaseValidationGate } from './implementations/database-validation.gate';
export { E2ETestGate } from './implementations/e2e-test.gate';
export { AccessibilityGate } from './implementations/accessibility.gate';
export { DesignReviewGate } from './implementations/design-review.gate';
export { PerformanceGate } from './implementations/performance.gate';

/**
 * Default gate execution sequence.
 * Phase 1 gates run first (build, unit tests, deployment checks),
 * followed by Phase 2 gates (integration, E2E, accessibility, design, performance).
 */
export const DEFAULT_GATE_SEQUENCE = [
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
