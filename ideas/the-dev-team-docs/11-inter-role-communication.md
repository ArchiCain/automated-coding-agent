# 11 — Inter-Role Communication

## Goal

Define how roles communicate with each other through the filesystem. Roles write findings, the orchestrator watches for them, and dispatches the bugfixer. No database, no message queue — state files are the protocol.

## Current State

- The existing coding-agent backend uses in-memory state in services
- No formalized inter-role communication mechanism
- The filesystem-based backlog (`backlog.service.ts`) provides a pattern for file-based state

## Target State

```
.the-dev-team/state/{task-id}/
├── status.json              ← Task status, updated by orchestrator
├── plan.md                  ← Architect's implementation plan
├── findings/
│   ├── reviewer.md          ← Review findings
│   ├── tester.md            ← Test findings
│   └── designer.md          ← Design findings
└── gate-results/
    ├── build.json
    ├── unit-tests.json
    └── ...
```

## Implementation Steps

### Step 1: Create Task State Service

Create `src/state/task-state.service.ts`:

```typescript
@Injectable()
export class TaskStateService {
  private basePath = '.the-dev-team/state';

  async createTaskState(task: Task): Promise<void> {
    const taskDir = path.join(this.basePath, task.id);
    await fs.mkdir(path.join(taskDir, 'findings'), { recursive: true });
    await fs.mkdir(path.join(taskDir, 'gate-results'), { recursive: true });
    await this.saveStatus(task.id, {
      taskId: task.id,
      status: task.status,
      branch: task.branch,
      createdAt: task.createdAt.toISOString(),
    });
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<void> {
    const statusPath = path.join(this.basePath, taskId, 'status.json');
    const current = JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    current.status = status;
    current.updatedAt = new Date().toISOString();
    await fs.writeFile(statusPath, JSON.stringify(current, null, 2));
  }

  async savePlan(taskId: string, plan: string): Promise<void> {
    await fs.writeFile(
      path.join(this.basePath, taskId, 'plan.md'),
      plan,
    );
  }

  async saveGateResult(taskId: string, result: GateResult): Promise<void> {
    await fs.writeFile(
      path.join(this.basePath, taskId, 'gate-results', `${result.gate}.json`),
      JSON.stringify({ ...result, timestamp: new Date().toISOString() }, null, 2),
    );
  }

  async getTaskState(taskId: string): Promise<TaskState | null> {
    try {
      const statusPath = path.join(this.basePath, taskId, 'status.json');
      return JSON.parse(await fs.readFile(statusPath, 'utf-8'));
    } catch {
      return null;
    }
  }
}
```

### Step 2: Create Findings Service

Create `src/state/findings.service.ts`:

```typescript
@Injectable()
export class FindingsService {
  private basePath = '.the-dev-team/state';

  async writeFindings(taskId: string, role: string, findings: string): Promise<void> {
    const findingsPath = path.join(this.basePath, taskId, 'findings', `${role}.md`);
    await fs.writeFile(findingsPath, findings);
  }

  async hasFindings(taskId: string): Promise<boolean> {
    const findingsDir = path.join(this.basePath, taskId, 'findings');
    try {
      const files = await fs.readdir(findingsDir);
      for (const file of files) {
        const content = await fs.readFile(path.join(findingsDir, file), 'utf-8');
        if (content.trim().length > 0) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async getFindings(taskId: string): Promise<Finding[]> {
    const findingsDir = path.join(this.basePath, taskId, 'findings');
    const findings: Finding[] = [];

    try {
      const files = await fs.readdir(findingsDir);
      for (const file of files) {
        const content = await fs.readFile(path.join(findingsDir, file), 'utf-8');
        if (content.trim().length > 0) {
          findings.push({
            role: path.basename(file, '.md'),
            content,
          });
        }
      }
    } catch {
      // No findings directory
    }

    return findings;
  }

  async clearFindings(taskId: string, role: string): Promise<void> {
    const findingsPath = path.join(this.basePath, taskId, 'findings', `${role}.md`);
    await fs.writeFile(findingsPath, '');  // Clear but don't delete
  }

  async clearAllFindings(taskId: string): Promise<void> {
    const findingsDir = path.join(this.basePath, taskId, 'findings');
    try {
      const files = await fs.readdir(findingsDir);
      for (const file of files) {
        await fs.writeFile(path.join(findingsDir, file), '');
      }
    } catch {
      // No findings directory
    }
  }
}

interface Finding {
  role: string;
  content: string;
}
```

### Step 3: Define the Communication Protocol

The protocol is simple — roles write markdown files, the orchestrator reads them:

**Reviewer writes findings:**
```markdown
# Review Findings

## Issue 1: SQL Injection Vulnerability
- **Severity:** Critical
- **Location:** `src/features/user-profile/profile.service.ts:45`
- **Description:** User input is concatenated directly into SQL query
- **Fix:** Use parameterized query via TypeORM QueryBuilder

## Issue 2: Missing Null Check
- **Severity:** Medium
- **Location:** `src/features/user-profile/profile.controller.ts:78`
- **Description:** Avatar upload endpoint doesn't validate file type
- **Fix:** Add file type validation before processing
```

**Tester writes findings:**
```markdown
# Test Findings

## Failing Tests
- `profile.service.spec.ts`: TypeError at line 23 — `getProfile` returns undefined when user has no profile
- `profile.controller.spec.ts`: Expected 200 but got 500 for GET /api/profile without auth token

## Missing Coverage
- No test for profile image upload endpoint
- No test for profile deletion
```

**Designer writes findings:**
```markdown
# Design Findings

## Blocking Issues
1. **Mobile viewport:** Profile card overflows horizontally at 375px width
   - Location: ProfileCard component
   - Fix: Add `maxWidth: 100%` and responsive padding

## Advisory Notes
1. Consider larger touch target on the "Edit" button (currently 32x32, should be 44x44)
```

### Step 4: Wire Findings into Execution Loop

In the execution loop (Plan 07), the orchestrator checks for findings after each review/test/design phase:

```typescript
// After reviewer runs
const findings = await this.findingsService.getFindings(task.id);

if (findings.length > 0) {
  // Build a prompt for the bugfixer with all findings
  const findingsText = findings
    .map(f => `## ${f.role} findings:\n${f.content}`)
    .join('\n\n');

  await this.runRole('bugfixer', task, {
    prompt: `Fix the following issues found during review:\n\n${findingsText}\n\nAfter fixing, rebuild and redeploy to verify.`,
    skills: ['execute', 'infrastructure'],
  });

  // Clear findings after bugfixer runs
  await this.findingsService.clearAllFindings(task.id);
}
```

### Step 5: Handle Concurrent Access

Since the orchestrator is single-threaded (Node.js), concurrent access to state files isn't a concern for Phase 1 (single agent). For Phase 3+ (multi-agent), consider:

- File locks via `proper-lockfile` npm package
- Or: each task has its own state directory, so concurrent tasks don't conflict

### Step 6: Add State Cleanup

When a task completes or fails, its state can be archived:

```typescript
async archiveTaskState(taskId: string): Promise<void> {
  const src = path.join(this.basePath, taskId);
  const dest = path.join('.the-dev-team/history/state', taskId);
  await fs.rename(src, dest);
}
```

## Verification

- [ ] Task state directory is created when a task starts
- [ ] Status updates are persisted to `status.json`
- [ ] Architect's plan is saved to `plan.md`
- [ ] Reviewer can write findings to `findings/reviewer.md`
- [ ] `hasFindings()` correctly detects non-empty findings
- [ ] Bugfixer receives findings content in its prompt
- [ ] Findings are cleared after bugfixer runs
- [ ] Gate results are persisted to `gate-results/`
- [ ] State is archived when task completes

## Open Questions

- **Finding format:** Should findings be structured (JSON) or free-form (markdown)? Markdown is more natural for LLM output. JSON is easier to parse programmatically. The current design uses markdown — the bugfixer reads it as context.
- **Finding severity:** Should the orchestrator parse severity from findings to decide whether to escalate immediately (critical) vs attempt fix (medium/low)?
- **State watching:** Should the orchestrator actively watch the findings directory for changes (fs.watch), or just check after each role completes? Checking after completion is simpler and sufficient.
