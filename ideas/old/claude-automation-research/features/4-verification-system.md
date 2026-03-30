# Verification System Specification

The verification system ensures task execution quality through multiple validation layers, catching errors early and preventing bad code from accumulating.

## Core Responsibility

> Validate that each task meets its acceptance criteria and doesn't break existing functionality, using a layered approach from fast self-checks to comprehensive final review.

---

## Verification Philosophy

### MAKER-Inspired Principles

1. **Early Detection**: Catch errors at the smallest scope possible
2. **Multiple Perspectives**: Use different verification strategies that catch different error types
3. **Red-Flagging**: Identify when the system is confused or uncertain
4. **Graceful Degradation**: Failures at one layer escalate to the next, not immediate abort

### Verification Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    VERIFICATION PYRAMID                          │
│                                                                  │
│                         ┌───────┐                                │
│                         │ FINAL │  ← Once per plan               │
│                         │REVIEW │    Comprehensive               │
│                        ─┴───────┴─                               │
│                       ┌───────────┐                              │
│                       │   PHASE   │  ← Between execution levels  │
│                       │   GATE    │    Integration focus         │
│                      ─┴───────────┴─                             │
│                     ┌───────────────┐                            │
│                     │     QUICK     │  ← Every N tasks           │
│                     │ VERIFICATION  │    Syntax + tests          │
│                    ─┴───────────────┴─                           │
│                   ┌───────────────────┐                          │
│                   │       SELF        │  ← Every task            │
│                   │   VERIFICATION    │    Acceptance criteria   │
│                  ─┴───────────────────┴─                         │
│                                                                  │
│    Frequency: High ──────────────────────────────▶ Low           │
│    Scope:     Narrow ────────────────────────────▶ Wide          │
│    Cost:      Cheap ─────────────────────────────▶ Expensive     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Self-Verification

Runs immediately after each task execution, within the same worker.

### Purpose
- Verify task meets its own acceptance criteria
- Run task-specific tests
- Check for obvious errors (syntax, imports, types)

### Trigger
- After every task execution, before commit

### Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-VERIFICATION FLOW                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. SYNTAX CHECK                               │
│  ─────────────────────────────────────────────────────────────  │
│  • TypeScript: tsc --noEmit on changed files                    │
│  • Linting: eslint on changed files                             │
│  • Formatting: prettier --check                                  │
│  • Fast fail if syntax errors                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. UNIT TESTS                                 │
│  ─────────────────────────────────────────────────────────────  │
│  • Run tests for changed files only                             │
│  • Run tests specified in task.test_approach                    │
│  • Capture test output for retry context                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. ACCEPTANCE CRITERIA CHECK                  │
│  ─────────────────────────────────────────────────────────────  │
│  • LLM evaluates: do changes satisfy acceptance criteria?       │
│  • Check each criterion individually                            │
│  • Flag uncertain criteria for escalation                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. CONFIDENCE ASSESSMENT                      │
│  ─────────────────────────────────────────────────────────────  │
│  • LLM rates confidence in completion (0-1)                     │
│  • Low confidence → flag for Quick Verification                 │
│  • Identify potential issues for review                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               [PASS]              [FAIL]
                    │                   │
                    ▼                   ▼
            ┌─────────────┐    ┌─────────────────┐
            │   COMMIT    │    │  RETRY or FAIL  │
            │   CHANGES   │    │  (with context) │
            └─────────────┘    └─────────────────┘
```

### Implementation

```typescript
interface SelfVerification {
  taskId: string;
  checks: VerificationCheck[];
  overall: 'pass' | 'fail' | 'uncertain';
  confidence: number;
  duration_ms: number;
}

interface VerificationCheck {
  name: string;
  type: 'syntax' | 'test' | 'acceptance' | 'confidence';
  status: 'pass' | 'fail' | 'skip' | 'uncertain';
  details: string;
  output?: string;
}

async function selfVerify(
  task: Task,
  execution: TaskExecution,
  context: ExecutionContext
): Promise<SelfVerification> {
  const checks: VerificationCheck[] = [];

  // 1. Syntax check
  const syntaxCheck = await runSyntaxCheck(execution.filesChanged, context);
  checks.push(syntaxCheck);
  if (syntaxCheck.status === 'fail') {
    return { taskId: task.id, checks, overall: 'fail', confidence: 0 };
  }

  // 2. Unit tests
  const testCheck = await runTaskTests(task, execution.filesChanged, context);
  checks.push(testCheck);
  if (testCheck.status === 'fail') {
    return { taskId: task.id, checks, overall: 'fail', confidence: 0.2 };
  }

  // 3. Acceptance criteria
  const acceptanceCheck = await checkAcceptanceCriteria(task, execution, context);
  checks.push(acceptanceCheck);

  // 4. Confidence assessment
  const confidenceCheck = await assessConfidence(task, execution, checks);
  checks.push(confidenceCheck);

  const overall = determineOverall(checks);
  return {
    taskId: task.id,
    checks,
    overall,
    confidence: confidenceCheck.confidence,
    duration_ms: Date.now() - startTime
  };
}
```

### Acceptance Criteria Prompt

```markdown
Evaluate if the code changes satisfy the task's acceptance criteria.

## Task
**Title:** {{task.title}}
**Description:** {{task.description}}

## Acceptance Criteria
{{task.acceptance_criteria}}

## Changes Made
{{#each filesChanged}}
### {{this.path}}
```diff
{{this.diff}}
```
{{/each}}

## Evaluation Instructions
For each acceptance criterion:
1. Quote the specific code that satisfies it
2. Rate confidence (0-1) that criterion is met
3. Note any concerns or edge cases

## Response Format
```json
{
  "criteria": [
    {
      "criterion": "string (the criterion text)",
      "satisfied": true|false,
      "confidence": 0.0-1.0,
      "evidence": "code snippet or explanation",
      "concerns": ["string"] | null
    }
  ],
  "overall_satisfied": true|false,
  "overall_confidence": 0.0-1.0,
  "concerns": ["string"] | null
}
```
```

---

## Layer 2: Quick Verification

Periodic checks during execution to catch integration issues early.

### Purpose
- Run broader test suite
- Check for regressions
- Verify multiple tasks work together
- Type-check entire project

### Trigger
- Every N completed tasks (configurable, default: 3)
- After any task with low self-verification confidence
- Before moving to next execution level

### Process

```
┌─────────────────────────────────────────────────────────────────┐
│                   QUICK VERIFICATION FLOW                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. FULL TYPE CHECK                            │
│  ─────────────────────────────────────────────────────────────  │
│  • tsc --noEmit (entire project)                                │
│  • Check for type errors introduced by recent tasks             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. AFFECTED TEST SUITES                       │
│  ─────────────────────────────────────────────────────────────  │
│  • Identify test files related to changed modules               │
│  • Run those test suites (not full suite)                       │
│  • ~30-60 second budget                                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. IMPORT/DEPENDENCY CHECK                    │
│  ─────────────────────────────────────────────────────────────  │
│  • Verify all imports resolve                                   │
│  • Check for circular dependencies introduced                   │
│  • Validate module boundaries                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               [PASS]              [FAIL]
                    │                   │
                    ▼                   ▼
            ┌─────────────┐    ┌─────────────────┐
            │  CONTINUE   │    │  PAUSE & FLAG   │
            │  EXECUTION  │    │  for debugging  │
            └─────────────┘    └─────────────────┘
```

### Implementation

```typescript
interface QuickVerification {
  trigger: 'periodic' | 'low_confidence' | 'level_complete';
  tasksVerified: string[];  // Task IDs since last quick verify
  checks: QuickCheck[];
  overall: 'pass' | 'fail';
  duration_ms: number;
}

interface QuickCheck {
  name: string;
  status: 'pass' | 'fail';
  details: string;
  failures?: string[];
}

async function quickVerify(
  completedTasks: Task[],
  context: ExecutionContext
): Promise<QuickVerification> {
  const checks: QuickCheck[] = [];

  // 1. Full type check
  const typeCheck = await runFullTypeCheck(context.worktree);
  checks.push({
    name: 'type_check',
    status: typeCheck.errors.length === 0 ? 'pass' : 'fail',
    details: `${typeCheck.errors.length} type errors`,
    failures: typeCheck.errors
  });

  // 2. Affected test suites
  const affectedFiles = completedTasks.flatMap(t => t.files_affected);
  const testSuites = await findAffectedTestSuites(affectedFiles);
  const testResults = await runTestSuites(testSuites, { timeout: 60000 });
  checks.push({
    name: 'affected_tests',
    status: testResults.failed === 0 ? 'pass' : 'fail',
    details: `${testResults.passed}/${testResults.total} tests passed`,
    failures: testResults.failedTests
  });

  // 3. Import check
  const importCheck = await checkImports(affectedFiles, context.worktree);
  checks.push({
    name: 'imports',
    status: importCheck.valid ? 'pass' : 'fail',
    details: importCheck.message,
    failures: importCheck.issues
  });

  return {
    trigger: context.trigger,
    tasksVerified: completedTasks.map(t => t.id),
    checks,
    overall: checks.every(c => c.status === 'pass') ? 'pass' : 'fail',
    duration_ms: Date.now() - startTime
  };
}
```

---

## Layer 3: Phase Gate Verification

Runs between execution levels to ensure phases integrate correctly.

### Purpose
- Verify integration between task groups
- Run integration tests
- Check that phase objectives are met
- Opportunity for architecture validation

### Trigger
- When all tasks in an execution level complete
- Before starting next level

### Process

```
┌─────────────────────────────────────────────────────────────────┐
│                   PHASE GATE VERIFICATION                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. INTEGRATION TESTS                          │
│  ─────────────────────────────────────────────────────────────  │
│  • Run integration test suites                                  │
│  • Test API endpoints if applicable                             │
│  • ~2-5 minute budget                                           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. BUILD VERIFICATION                         │
│  ─────────────────────────────────────────────────────────────  │
│  • Full build (npm run build)                                   │
│  • Check for build warnings                                     │
│  • Verify output artifacts                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. PHASE OBJECTIVE CHECK                      │
│  ─────────────────────────────────────────────────────────────  │
│  • LLM evaluates: does completed work satisfy phase goals?      │
│  • Check cross-task consistency                                 │
│  • Identify gaps or issues                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. ARCHITECTURE REVIEW                        │
│  ─────────────────────────────────────────────────────────────  │
│  • LLM reviews code structure                                   │
│  • Check for anti-patterns introduced                           │
│  • Verify consistency with project patterns                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
               [PASS]              [FAIL]
                    │                   │
                    ▼                   ▼
           ┌──────────────┐   ┌─────────────────┐
           │   PROCEED    │   │  CREATE REPAIR  │
           │   TO NEXT    │   │     TASKS       │
           │    LEVEL     │   └─────────────────┘
           └──────────────┘
```

### Implementation

```typescript
interface PhaseGateVerification {
  level: number;
  tasksInPhase: string[];
  checks: PhaseCheck[];
  overall: 'pass' | 'fail' | 'pass_with_warnings';
  warnings: string[];
  repairTasks?: Task[];  // Generated if issues found
  duration_ms: number;
}

interface PhaseCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
  output?: string;
}

async function phaseGateVerify(
  level: number,
  completedTasks: Task[],
  context: ExecutionContext
): Promise<PhaseGateVerification> {
  const checks: PhaseCheck[] = [];
  const warnings: string[] = [];

  // 1. Integration tests
  const integrationResults = await runIntegrationTests(context.worktree);
  checks.push({
    name: 'integration_tests',
    status: integrationResults.failed === 0 ? 'pass' : 'fail',
    details: `${integrationResults.passed}/${integrationResults.total} passed`,
    output: integrationResults.output
  });

  // 2. Build verification
  const buildResult = await runBuild(context.worktree);
  checks.push({
    name: 'build',
    status: buildResult.success ? 'pass' : 'fail',
    details: buildResult.success ? 'Build successful' : 'Build failed',
    output: buildResult.output
  });
  if (buildResult.warnings.length > 0) {
    warnings.push(...buildResult.warnings);
  }

  // 3. Phase objective check
  const objectiveCheck = await checkPhaseObjectives(level, completedTasks, context);
  checks.push({
    name: 'phase_objectives',
    status: objectiveCheck.satisfied ? 'pass' : 'fail',
    details: objectiveCheck.summary
  });

  // 4. Architecture review
  const archReview = await reviewArchitecture(completedTasks, context);
  checks.push({
    name: 'architecture',
    status: archReview.issues.length === 0 ? 'pass' : 'warning',
    details: archReview.summary
  });
  if (archReview.issues.length > 0) {
    warnings.push(...archReview.issues);
  }

  // Generate repair tasks if needed
  let repairTasks: Task[] | undefined;
  if (checks.some(c => c.status === 'fail')) {
    repairTasks = await generateRepairTasks(checks, completedTasks, context);
  }

  return {
    level,
    tasksInPhase: completedTasks.map(t => t.id),
    checks,
    overall: determinePhaseOverall(checks),
    warnings,
    repairTasks,
    duration_ms: Date.now() - startTime
  };
}
```

### Phase Objective Prompt

```markdown
Evaluate if the completed tasks satisfy the phase objectives.

## Phase Level
Level {{level}} of {{totalLevels}}

## Completed Tasks This Phase
{{#each completedTasks}}
### {{this.title}}
**Acceptance Criteria:** {{this.acceptance_criteria}}
**Status:** Completed
**Files Changed:** {{this.files_affected | join(", ")}}
{{/each}}

## Overall Plan Context
**Plan Goal:** {{plan.description}}
**Remaining Levels:** {{remainingLevels}}

## Evaluation Instructions
1. Assess if completed tasks form a coherent, functional unit
2. Check for integration issues between tasks
3. Identify any gaps that should have been addressed
4. Evaluate if the codebase is in a stable state

## Response Format
```json
{
  "satisfied": true|false,
  "summary": "string",
  "integration_issues": ["string"] | null,
  "gaps": ["string"] | null,
  "stable": true|false,
  "recommendations": ["string"] | null
}
```
```

---

## Layer 4: Final Review

Comprehensive review when plan execution completes.

### Purpose
- Full test suite validation
- Complete build verification
- Human-readable summary generation
- Quality metrics collection
- Prepare for human review

### Trigger
- All tasks completed successfully
- OR execution stopped due to failures (still generate report)

### Process

```
┌─────────────────────────────────────────────────────────────────┐
│                     FINAL REVIEW FLOW                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. FULL TEST SUITE                            │
│  ─────────────────────────────────────────────────────────────  │
│  • Run entire test suite                                        │
│  • Include e2e tests if available                               │
│  • No timeout (let it complete)                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. PRODUCTION BUILD                           │
│  ─────────────────────────────────────────────────────────────  │
│  • Full production build                                        │
│  • Bundle analysis if configured                                │
│  • Check for production warnings                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. CODE QUALITY ANALYSIS                      │
│  ─────────────────────────────────────────────────────────────  │
│  • Run linter on all changed files                              │
│  • Check code coverage delta                                    │
│  • Analyze complexity metrics                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. LLM COMPREHENSIVE REVIEW                   │
│  ─────────────────────────────────────────────────────────────  │
│  • Review all changes holistically                              │
│  • Check for security issues                                    │
│  • Verify patterns consistency                                  │
│  • Generate human-readable summary                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. GENERATE REVIEW REPORT                     │
│  ─────────────────────────────────────────────────────────────  │
│  • Compile all verification results                             │
│  • Create diff summary                                          │
│  • List all commits                                             │
│  • Highlight concerns for human review                          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ READY FOR HUMAN │
                    │     REVIEW      │
                    └─────────────────┘
```

### Implementation

```typescript
interface FinalReview {
  planId: string;
  status: 'success' | 'partial' | 'failed';

  // Test results
  tests: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    coverage?: number;
    coverageDelta?: number;
  };

  // Build results
  build: {
    success: boolean;
    warnings: string[];
    bundleSize?: number;
    bundleSizeDelta?: number;
  };

  // Code quality
  quality: {
    lintErrors: number;
    lintWarnings: number;
    complexityScore?: number;
    duplicateCode?: number;
  };

  // LLM review
  review: {
    summary: string;
    securityConcerns: string[];
    patternViolations: string[];
    suggestions: string[];
    overallAssessment: 'good' | 'acceptable' | 'needs_attention';
  };

  // Change summary
  changes: {
    commits: CommitInfo[];
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    byCategory: Record<string, number>;  // e.g., { 'src': 10, 'tests': 5 }
  };

  // Concerns for human
  humanReviewPoints: {
    priority: 'high' | 'medium' | 'low';
    description: string;
    files: string[];
  }[];

  duration_ms: number;
}

async function finalReview(
  plan: Plan,
  context: ExecutionContext
): Promise<FinalReview> {
  // 1. Full test suite
  const testResults = await runFullTestSuite(context.worktree);

  // 2. Production build
  const buildResult = await runProductionBuild(context.worktree);

  // 3. Code quality
  const qualityResults = await analyzeCodeQuality(context.worktree);

  // 4. LLM review
  const llmReview = await comprehensiveLLMReview(plan, context);

  // 5. Generate report
  const changes = await summarizeChanges(plan, context);
  const humanReviewPoints = await identifyHumanReviewPoints(
    testResults, buildResult, qualityResults, llmReview
  );

  return {
    planId: plan.id,
    status: determineStatus(testResults, buildResult),
    tests: testResults,
    build: buildResult,
    quality: qualityResults,
    review: llmReview,
    changes,
    humanReviewPoints,
    duration_ms: Date.now() - startTime
  };
}
```

### Comprehensive Review Prompt

```markdown
You are conducting a final review of all changes made during plan execution.

## Plan Summary
**Goal:** {{plan.description}}
**Tasks Completed:** {{completedTasks.length}}
**Tasks Failed:** {{failedTasks.length}}

## All Changes
{{#each commits}}
### Commit: {{this.hash}}
**Task:** {{this.taskTitle}}
**Files:**
{{#each this.files}}
- {{this.path}} (+{{this.additions}}/-{{this.deletions}})
{{/each}}
{{/each}}

## Full Diff Summary
```diff
{{fullDiff}}
```

## Test Results
- Passed: {{tests.passed}}
- Failed: {{tests.failed}}
- Coverage: {{tests.coverage}}%

## Review Instructions
Conduct a thorough review considering:

1. **Correctness**: Does the code do what it's supposed to?
2. **Security**: Any potential security vulnerabilities?
3. **Performance**: Any obvious performance issues?
4. **Maintainability**: Is the code readable and well-structured?
5. **Consistency**: Does it follow project patterns?
6. **Edge Cases**: Are edge cases handled?
7. **Testing**: Is test coverage adequate?

## Response Format
```json
{
  "summary": "2-3 paragraph summary of changes and their quality",
  "security_concerns": [
    { "severity": "high|medium|low", "description": "string", "files": ["string"] }
  ],
  "pattern_violations": [
    { "pattern": "string", "violation": "string", "files": ["string"] }
  ],
  "suggestions": ["string"],
  "overall_assessment": "good|acceptable|needs_attention",
  "human_review_needed": [
    { "priority": "high|medium|low", "description": "string", "files": ["string"] }
  ]
}
```
```

---

## Red-Flagging System

Inspired by MAKER, identify when the system is uncertain or confused.

### Red Flag Triggers

```typescript
interface RedFlag {
  type: RedFlagType;
  severity: 'warning' | 'critical';
  task_id?: string;
  phase?: number;
  description: string;
  evidence: string;
  recommended_action: string;
}

type RedFlagType =
  | 'low_confidence'       // LLM expressed low confidence
  | 'conflicting_outputs'  // Multiple attempts gave different results
  | 'excessive_retries'    // Task required many retries
  | 'unexpected_changes'   // Files changed that weren't in files_affected
  | 'test_flakiness'       // Tests pass/fail inconsistently
  | 'pattern_violation'    // Code doesn't match project patterns
  | 'scope_creep'          // Task implementation exceeded scope
  | 'missing_tests'        // No tests written for new code
  | 'security_concern';    // Potential security issue detected
```

### Detection Logic

```typescript
function detectRedFlags(
  task: Task,
  execution: TaskExecution,
  verification: SelfVerification
): RedFlag[] {
  const flags: RedFlag[] = [];

  // Low confidence
  if (verification.confidence < 0.7) {
    flags.push({
      type: 'low_confidence',
      severity: verification.confidence < 0.5 ? 'critical' : 'warning',
      task_id: task.id,
      description: 'LLM expressed low confidence in task completion',
      evidence: `Confidence: ${verification.confidence}`,
      recommended_action: 'Review task output manually'
    });
  }

  // Excessive retries
  if (execution.attempts > 2) {
    flags.push({
      type: 'excessive_retries',
      severity: execution.attempts > 3 ? 'critical' : 'warning',
      task_id: task.id,
      description: 'Task required multiple retry attempts',
      evidence: `Attempts: ${execution.attempts}`,
      recommended_action: 'Review task complexity and decomposition'
    });
  }

  // Unexpected files changed
  const unexpectedFiles = execution.filesChanged.filter(
    f => !task.files_affected.includes(f)
  );
  if (unexpectedFiles.length > 0) {
    flags.push({
      type: 'unexpected_changes',
      severity: unexpectedFiles.length > 2 ? 'critical' : 'warning',
      task_id: task.id,
      description: 'Task modified files not in expected list',
      evidence: `Unexpected: ${unexpectedFiles.join(', ')}`,
      recommended_action: 'Review changes for scope creep'
    });
  }

  // Missing tests (for non-trivial tasks)
  if (task.complexity !== 'trivial') {
    const testFiles = execution.filesChanged.filter(f => f.includes('.spec.') || f.includes('.test.'));
    if (testFiles.length === 0) {
      flags.push({
        type: 'missing_tests',
        severity: 'warning',
        task_id: task.id,
        description: 'No test files modified for non-trivial task',
        evidence: `Complexity: ${task.complexity}, Test files: 0`,
        recommended_action: 'Verify test coverage for changes'
      });
    }
  }

  return flags;
}
```

---

## Repair Task Generation

When verification fails, generate repair tasks automatically.

```typescript
interface RepairTaskGenerator {
  generateFromFailure(
    failure: VerificationFailure,
    originalTask: Task,
    context: ExecutionContext
  ): Promise<Task>;
}

async function generateRepairTask(
  failure: VerificationFailure,
  originalTask: Task,
  context: ExecutionContext
): Promise<Task> {
  const prompt = buildRepairPrompt(failure, originalTask);

  const response = await llm.complete(prompt);

  return {
    id: generateTaskId(),
    parent_id: originalTask.id,
    title: `Fix: ${failure.summary}`,
    description: response.description,
    acceptance_criteria: response.acceptance_criteria,
    complexity: 'simple',
    depends_on: [originalTask.id],
    files_affected: failure.affectedFiles,
    test_approach: response.test_approach,
    status: 'pending',
    created_at: new Date().toISOString(),
    metadata: {
      is_repair: true,
      original_task: originalTask.id,
      failure_type: failure.type
    }
  };
}
```

### Repair Prompt

```markdown
A task failed verification. Generate a repair task to fix the issue.

## Original Task
**Title:** {{originalTask.title}}
**Description:** {{originalTask.description}}

## Failure Information
**Type:** {{failure.type}}
**Summary:** {{failure.summary}}
**Details:**
```
{{failure.details}}
```

## Files Involved
{{#each failure.affectedFiles}}
- {{this}}
{{/each}}

## Instructions
Generate a focused repair task that:
1. Addresses the specific failure
2. Has clear acceptance criteria
3. Is minimal in scope (fix only what's broken)

## Response Format
```json
{
  "description": "string",
  "acceptance_criteria": "string (markdown bullets)",
  "test_approach": "string",
  "estimated_complexity": "trivial|simple|moderate"
}
```
```

---

## Verification Storage

Results stored in `.rtslabs/plans/{plan-id}/verification.json`:

```json
{
  "plan_id": "p-abc123",
  "verifications": [
    {
      "type": "self",
      "task_id": "t-def456",
      "timestamp": "2024-01-15T10:35:00Z",
      "result": {
        "overall": "pass",
        "confidence": 0.92,
        "checks": [...]
      }
    },
    {
      "type": "quick",
      "trigger": "periodic",
      "timestamp": "2024-01-15T10:40:00Z",
      "tasks_verified": ["t-def456", "t-ghi789", "t-jkl012"],
      "result": {
        "overall": "pass",
        "checks": [...]
      }
    },
    {
      "type": "phase_gate",
      "level": 1,
      "timestamp": "2024-01-15T11:00:00Z",
      "result": {
        "overall": "pass_with_warnings",
        "warnings": ["..."],
        "checks": [...]
      }
    },
    {
      "type": "final",
      "timestamp": "2024-01-15T12:00:00Z",
      "result": {
        "status": "success",
        "tests": {...},
        "build": {...},
        "review": {...}
      }
    }
  ],
  "red_flags": [
    {
      "type": "low_confidence",
      "task_id": "t-xyz789",
      "severity": "warning",
      "description": "...",
      "timestamp": "2024-01-15T10:45:00Z"
    }
  ]
}
```

---

## Configuration

```json
// .rtslabs/config.json
{
  "verification": {
    "self": {
      "enabled": true,
      "require_tests": true,
      "confidence_threshold": 0.7
    },
    "quick": {
      "enabled": true,
      "frequency": 3,
      "timeout_ms": 60000
    },
    "phase_gate": {
      "enabled": true,
      "require_build": true,
      "require_integration_tests": false
    },
    "final": {
      "enabled": true,
      "full_test_suite": true,
      "production_build": true,
      "llm_review": true
    },
    "red_flags": {
      "pause_on_critical": true,
      "low_confidence_threshold": 0.5
    }
  }
}
```

---

## Integration Points

### With Execution Engine
- Called after each task (self-verification)
- Called periodically (quick verification)
- Called between levels (phase gate)
- Called at completion (final review)
- Can pause/resume execution based on results

### With Decomposition Engine
- Red flags inform decomposition quality feedback
- Repair tasks feed back into task queue

### With Memory System
- Store verification patterns that worked
- Learn from common failure modes
- Track red flag frequency by task type

### With Web UI
- Stream verification progress
- Display red flags prominently
- Show final review report
- Highlight human review points
