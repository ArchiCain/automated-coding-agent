# Git Manager Specification

The Git Manager handles all git operations for plan execution, including worktree management, branch creation, atomic commits, and conflict resolution.

## Core Responsibility

> Provide isolated execution environments via git worktrees, manage feature branches, create atomic commits per task, and handle merge operations.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       GIT MANAGER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ WORKTREE MANAGER │  │  BRANCH MANAGER  │  │COMMIT MANAGER │  │
│  │                  │  │                  │  │               │  │
│  │ • Create/remove  │  │ • Create branch  │  │ • Stage files │  │
│  │ • List active    │  │ • Switch branch  │  │ • Commit      │  │
│  │ • Health check   │  │ • Track remote   │  │ • Amend       │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ CONFLICT HANDLER │  │   DIFF ANALYZER  │  │ REMOTE SYNC   │  │
│  │                  │  │                  │  │               │  │
│  │ • Detect         │  │ • File changes   │  │ • Push        │  │
│  │ • Auto-resolve   │  │ • Line counts    │  │ • Fetch       │  │
│  │ • Flag for human │  │ • Change summary │  │ • PR creation │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Git Worktree Strategy

### Why Worktrees?

Worktrees provide isolated working directories that share the same git repository:

```
main-repo/                    ← Original repository
├── .git/                     ← Shared git database
├── src/
└── ...

.rtslabs/worktrees/           ← Worktree root (outside repo or gitignored)
├── p-abc123/                 ← Plan abc123's worktree
│   ├── src/
│   └── ...
└── p-def456/                 ← Plan def456's worktree
    ├── src/
    └── ...
```

**Benefits:**
- Plans execute in isolation (no interference)
- Multiple plans can run in parallel
- Main repo stays clean during execution
- Easy cleanup (just remove directory)
- Shares object database (space efficient)

### Worktree Lifecycle

```
┌─────────┐   createWorktree()   ┌──────────┐
│  NONE   │─────────────────────▶│  ACTIVE  │
└─────────┘                      └────┬─────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              [executing]       [completed]        [failed]
                    │                 │                 │
                    ▼                 ▼                 ▼
              ┌──────────┐     ┌──────────┐     ┌──────────┐
              │  ACTIVE  │     │  STALE   │     │  STALE   │
              │ (in use) │     │ (can rm) │     │ (can rm) │
              └──────────┘     └────┬─────┘     └────┬─────┘
                                    │                │
                              removeWorktree()  removeWorktree()
                                    │                │
                                    ▼                ▼
                              ┌──────────┐     ┌──────────┐
                              │ REMOVED  │     │ REMOVED  │
                              └──────────┘     └──────────┘
```

---

## Core Components

### 1. Worktree Manager

Handles creation, listing, and removal of git worktrees.

```typescript
interface WorktreeManager {
  // Configuration
  worktreeRoot: string;  // Where worktrees are created
  mainRepoPath: string;  // Path to main repository

  // Operations
  create(planId: string, baseBranch?: string): Promise<WorktreeInfo>;
  remove(planId: string, force?: boolean): Promise<void>;
  list(): Promise<WorktreeInfo[]>;
  get(planId: string): Promise<WorktreeInfo | null>;
  exists(planId: string): Promise<boolean>;

  // Health
  checkHealth(planId: string): Promise<WorktreeHealth>;
  cleanStale(olderThanDays: number): Promise<string[]>;
}

interface WorktreeInfo {
  planId: string;
  path: string;           // Absolute path to worktree
  branch: string;         // Associated branch name
  baseBranch: string;     // Branch it was created from
  createdAt: Date;
  lastAccessedAt: Date;
  status: 'active' | 'stale' | 'error';
  commitCount: number;    // Commits since base
}

interface WorktreeHealth {
  valid: boolean;
  issues: {
    type: 'missing_directory' | 'corrupted' | 'locked' | 'uncommitted_changes';
    message: string;
  }[];
}
```

**Implementation:**

```typescript
class WorktreeManagerImpl implements WorktreeManager {
  async create(planId: string, baseBranch = 'main'): Promise<WorktreeInfo> {
    const branchName = this.generateBranchName(planId);
    const worktreePath = path.join(this.worktreeRoot, planId);

    // Ensure worktree root exists
    await fs.mkdir(this.worktreeRoot, { recursive: true });

    // Create worktree with new branch
    await this.git.worktree.add({
      path: worktreePath,
      branch: branchName,
      startPoint: baseBranch
    });

    // Record metadata
    const info: WorktreeInfo = {
      planId,
      path: worktreePath,
      branch: branchName,
      baseBranch,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      status: 'active',
      commitCount: 0
    };

    await this.saveWorktreeMetadata(planId, info);
    return info;
  }

  async remove(planId: string, force = false): Promise<void> {
    const info = await this.get(planId);
    if (!info) {
      throw new Error(`Worktree for plan ${planId} not found`);
    }

    // Check for uncommitted changes
    if (!force) {
      const status = await this.git.status({ cwd: info.path });
      if (status.modified.length > 0 || status.staged.length > 0) {
        throw new Error('Worktree has uncommitted changes. Use force=true to remove anyway.');
      }
    }

    // Remove worktree
    await this.git.worktree.remove({ path: info.path, force });

    // Optionally delete the branch
    // (keeping it preserves the commits)

    await this.deleteWorktreeMetadata(planId);
  }

  async cleanStale(olderThanDays: number): Promise<string[]> {
    const worktrees = await this.list();
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    const removed: string[] = [];

    for (const wt of worktrees) {
      if (wt.status === 'stale' && wt.lastAccessedAt.getTime() < cutoff) {
        await this.remove(wt.planId, true);
        removed.push(wt.planId);
      }
    }

    return removed;
  }

  private generateBranchName(planId: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    return `plan/${planId}/${timestamp}`;
  }
}
```

---

### 2. Branch Manager

Handles branch creation, tracking, and management.

```typescript
interface BranchManager {
  // Creation
  create(name: string, startPoint?: string): Promise<BranchInfo>;
  createFromPlan(planId: string, baseBranch?: string): Promise<BranchInfo>;

  // Information
  current(worktreePath: string): Promise<string>;
  exists(name: string): Promise<boolean>;
  list(pattern?: string): Promise<BranchInfo[]>;

  // Operations
  checkout(worktreePath: string, branch: string): Promise<void>;
  delete(name: string, force?: boolean): Promise<void>;

  // Remote
  setUpstream(local: string, remote: string): Promise<void>;
  push(branch: string, remote?: string): Promise<PushResult>;
}

interface BranchInfo {
  name: string;
  isRemote: boolean;
  upstream?: string;
  lastCommit: {
    hash: string;
    message: string;
    date: Date;
    author: string;
  };
  aheadBehind?: {
    ahead: number;
    behind: number;
  };
}

interface PushResult {
  success: boolean;
  remote: string;
  branch: string;
  newCommits: number;
  url?: string;  // If PR URL is generated
}
```

**Branch Naming Convention:**

```
plan/{plan-id}/{date}

Examples:
  plan/p-abc123/2024-01-15
  plan/p-def456/2024-01-16
```

---

### 3. Commit Manager

Handles staging, committing, and commit message formatting.

```typescript
interface CommitManager {
  // Staging
  stage(worktreePath: string, files: string[]): Promise<void>;
  stageAll(worktreePath: string): Promise<void>;
  unstage(worktreePath: string, files: string[]): Promise<void>;

  // Status
  status(worktreePath: string): Promise<GitStatus>;
  diff(worktreePath: string, options?: DiffOptions): Promise<DiffResult>;

  // Committing
  commit(worktreePath: string, options: CommitOptions): Promise<CommitResult>;
  commitTask(worktreePath: string, task: Task, files: string[]): Promise<CommitResult>;

  // History
  log(worktreePath: string, options?: LogOptions): Promise<CommitInfo[]>;
  show(worktreePath: string, commitHash: string): Promise<CommitDetail>;
}

interface GitStatus {
  branch: string;
  staged: FileChange[];
  modified: FileChange[];
  untracked: string[];
  deleted: string[];
  conflicts: string[];
  clean: boolean;
}

interface FileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;  // For renames
}

interface CommitOptions {
  message: string;
  body?: string;
  author?: string;
  allowEmpty?: boolean;
}

interface CommitResult {
  hash: string;
  branch: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

interface DiffOptions {
  staged?: boolean;
  files?: string[];
  base?: string;  // Compare against specific commit/branch
}

interface DiffResult {
  files: FileDiff[];
  totalInsertions: number;
  totalDeletions: number;
  raw: string;  // Raw diff output
}

interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  insertions: number;
  deletions: number;
  hunks: DiffHunk[];
}
```

**Task Commit Implementation:**

```typescript
class CommitManagerImpl implements CommitManager {
  async commitTask(
    worktreePath: string,
    task: Task,
    files: string[]
  ): Promise<CommitResult> {
    // Stage specified files
    await this.stage(worktreePath, files);

    // Generate commit message
    const message = this.formatTaskCommitMessage(task);

    // Commit
    return this.commit(worktreePath, { message });
  }

  private formatTaskCommitMessage(task: Task): string {
    const header = `[${task.id}] ${task.title}`;

    const body = `
Acceptance criteria:
${this.formatAcceptanceCriteria(task.acceptance_criteria)}

Files changed:
${task.files_affected.map(f => `- ${f}`).join('\n')}

Plan: ${task.plan_id}
Task: ${task.id}
`.trim();

    return `${header}\n\n${body}`;
  }

  private formatAcceptanceCriteria(criteria: string): string {
    // Convert criteria to checkboxes (all checked since task completed)
    return criteria
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[\s]*[-*][\s]*/, '- [x] '))
      .join('\n');
  }
}
```

**Commit Message Format:**

```
[t-abc123] Create user authentication service

Acceptance criteria:
- [x] AuthService class with login/logout methods
- [x] JWT token generation and validation
- [x] Password hashing with bcrypt
- [x] Unit tests for all methods

Files changed:
- src/auth/auth.service.ts
- src/auth/auth.service.spec.ts
- src/auth/jwt.strategy.ts

Plan: p-xyz789
Task: t-abc123
```

---

### 4. Conflict Handler

Detects and manages merge conflicts.

```typescript
interface ConflictHandler {
  // Detection
  hasConflicts(worktreePath: string): Promise<boolean>;
  getConflicts(worktreePath: string): Promise<ConflictInfo[]>;

  // Resolution
  resolveWithOurs(worktreePath: string, files: string[]): Promise<void>;
  resolveWithTheirs(worktreePath: string, files: string[]): Promise<void>;
  markResolved(worktreePath: string, files: string[]): Promise<void>;

  // Prevention
  checkForPotentialConflicts(
    worktreePath: string,
    targetBranch: string
  ): Promise<PotentialConflict[]>;

  // Abort
  abortMerge(worktreePath: string): Promise<void>;
}

interface ConflictInfo {
  file: string;
  type: 'content' | 'delete-modify' | 'add-add' | 'rename';
  oursVersion: string;
  theirsVersion: string;
  baseVersion?: string;
  conflictMarkers?: {
    start: number;
    middle: number;
    end: number;
  }[];
}

interface PotentialConflict {
  file: string;
  risk: 'high' | 'medium' | 'low';
  reason: string;
  ourChanges: string;
  theirChanges: string;
}
```

**Conflict Detection Before Merge:**

```typescript
async function checkForPotentialConflicts(
  worktreePath: string,
  targetBranch: string
): Promise<PotentialConflict[]> {
  const conflicts: PotentialConflict[] = [];

  // Get files changed in our branch
  const ourFiles = await git.diff({
    cwd: worktreePath,
    nameOnly: true,
    base: targetBranch
  });

  // Get files changed in target since we diverged
  const mergeBase = await git.mergeBase(worktreePath, 'HEAD', targetBranch);
  const theirFiles = await git.diff({
    cwd: worktreePath,
    nameOnly: true,
    base: mergeBase,
    head: targetBranch
  });

  // Find overlapping files
  const overlapping = ourFiles.filter(f => theirFiles.includes(f));

  for (const file of overlapping) {
    const ourDiff = await git.diff({ cwd: worktreePath, files: [file], base: mergeBase });
    const theirDiff = await git.diff({
      cwd: worktreePath,
      files: [file],
      base: mergeBase,
      head: targetBranch
    });

    // Analyze if changes overlap
    const risk = analyzeConflictRisk(ourDiff, theirDiff);

    if (risk !== 'none') {
      conflicts.push({
        file,
        risk,
        reason: `Both branches modified ${file}`,
        ourChanges: ourDiff,
        theirChanges: theirDiff
      });
    }
  }

  return conflicts;
}
```

---

### 5. Diff Analyzer

Provides detailed analysis of changes.

```typescript
interface DiffAnalyzer {
  // Analysis
  analyze(worktreePath: string, options?: AnalyzeOptions): Promise<ChangeAnalysis>;
  summarize(worktreePath: string, base?: string): Promise<ChangeSummary>;

  // Per-file
  getFileDiff(worktreePath: string, file: string, base?: string): Promise<FileDiff>;

  // Statistics
  getStats(worktreePath: string, base?: string): Promise<DiffStats>;
}

interface AnalyzeOptions {
  base?: string;
  includeContent?: boolean;
  categorize?: boolean;
}

interface ChangeAnalysis {
  files: {
    path: string;
    category: 'source' | 'test' | 'config' | 'docs' | 'other';
    type: 'added' | 'modified' | 'deleted' | 'renamed';
    language?: string;
    insertions: number;
    deletions: number;
    complexity?: 'trivial' | 'simple' | 'moderate' | 'complex';
  }[];
  summary: {
    totalFiles: number;
    byCategory: Record<string, number>;
    byType: Record<string, number>;
    totalInsertions: number;
    totalDeletions: number;
  };
}

interface ChangeSummary {
  description: string;  // Human-readable summary
  highlights: string[];  // Key changes
  concerns: string[];    // Potential issues
}

interface DiffStats {
  commits: number;
  filesChanged: number;
  insertions: number;
  deletions: number;
  authors: string[];
}
```

**Change Summary Generation:**

```typescript
async function generateChangeSummary(
  worktreePath: string,
  base: string
): Promise<ChangeSummary> {
  const analysis = await this.analyze(worktreePath, { base, categorize: true });

  // Build description
  const description = [
    `${analysis.summary.totalFiles} files changed`,
    `(+${analysis.summary.totalInsertions}/-${analysis.summary.totalDeletions})`,
  ].join(' ');

  // Identify highlights
  const highlights: string[] = [];
  if (analysis.summary.byCategory.source > 0) {
    highlights.push(`${analysis.summary.byCategory.source} source files modified`);
  }
  if (analysis.summary.byCategory.test > 0) {
    highlights.push(`${analysis.summary.byCategory.test} test files added/modified`);
  }
  if (analysis.summary.byType.added > 0) {
    highlights.push(`${analysis.summary.byType.added} new files created`);
  }

  // Identify concerns
  const concerns: string[] = [];
  if (analysis.summary.byCategory.test === 0 && analysis.summary.byCategory.source > 0) {
    concerns.push('No test files modified - consider adding tests');
  }
  const complexFiles = analysis.files.filter(f => f.complexity === 'complex');
  if (complexFiles.length > 0) {
    concerns.push(`${complexFiles.length} files with complex changes - review carefully`);
  }

  return { description, highlights, concerns };
}
```

---

### 6. Remote Sync

Handles interaction with remote repositories.

```typescript
interface RemoteSync {
  // Fetch
  fetch(worktreePath: string, remote?: string): Promise<FetchResult>;
  fetchAll(worktreePath: string): Promise<FetchResult>;

  // Push
  push(worktreePath: string, options?: PushOptions): Promise<PushResult>;

  // Pull Request
  createPullRequest(options: PROptions): Promise<PRResult>;
  getPullRequestStatus(prNumber: number): Promise<PRStatus>;

  // Remote management
  getRemotes(worktreePath: string): Promise<RemoteInfo[]>;
  addRemote(worktreePath: string, name: string, url: string): Promise<void>;
}

interface PushOptions {
  remote?: string;
  branch?: string;
  setUpstream?: boolean;
  force?: boolean;
  tags?: boolean;
}

interface PROptions {
  title: string;
  body: string;
  head: string;      // Source branch
  base: string;      // Target branch
  draft?: boolean;
  reviewers?: string[];
  labels?: string[];
}

interface PRResult {
  number: number;
  url: string;
  state: 'open' | 'closed' | 'merged';
  mergeable?: boolean;
}

interface PRStatus {
  number: number;
  state: 'open' | 'closed' | 'merged';
  mergeable: boolean;
  reviews: {
    user: string;
    state: 'approved' | 'changes_requested' | 'pending';
  }[];
  checks: {
    name: string;
    status: 'success' | 'failure' | 'pending';
  }[];
}
```

**Pull Request Creation:**

```typescript
async function createPullRequest(options: PROptions): Promise<PRResult> {
  // Use GitHub CLI (gh) for PR creation
  const result = await exec('gh', [
    'pr', 'create',
    '--title', options.title,
    '--body', options.body,
    '--head', options.head,
    '--base', options.base,
    ...(options.draft ? ['--draft'] : []),
    ...(options.reviewers?.flatMap(r => ['--reviewer', r]) || []),
    ...(options.labels?.flatMap(l => ['--label', l]) || [])
  ]);

  // Parse PR URL from output
  const prUrl = result.stdout.trim();
  const prNumber = parseInt(prUrl.split('/').pop()!, 10);

  return {
    number: prNumber,
    url: prUrl,
    state: 'open',
    mergeable: undefined  // Unknown until checks run
  };
}
```

---

## Workflows

### Plan Execution Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLAN STARTS EXECUTION                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. CREATE WORKTREE                            │
│  ─────────────────────────────────────────────────────────────  │
│  git worktree add .rtslabs/worktrees/p-abc123 -b plan/p-abc123  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    2. EXECUTE TASKS                              │
│  ─────────────────────────────────────────────────────────────  │
│  For each completed task:                                       │
│    • Stage changed files                                        │
│    • Create commit with task metadata                           │
│    • Update task status                                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    3. PLAN COMPLETES                             │
│  ─────────────────────────────────────────────────────────────  │
│  • All tasks committed                                          │
│  • Branch has full history                                      │
│  • Ready for human review                                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    4. HUMAN REVIEW                               │
│  ─────────────────────────────────────────────────────────────  │
│  Human can:                                                     │
│    • Review commits in worktree                                 │
│    • Push branch to remote                                      │
│    • Create PR                                                  │
│    • Merge to main                                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    5. CLEANUP (manual)                           │
│  ─────────────────────────────────────────────────────────────  │
│  • Remove worktree when no longer needed                        │
│  • Optionally delete branch                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Merge to Main Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MERGE REQUEST                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    1. CHECK CONFLICTS                            │
│  ─────────────────────────────────────────────────────────────  │
│  • Fetch latest main                                            │
│  • Check for potential conflicts                                │
│  • Report risk level                                            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
        [No conflicts]               [Conflicts detected]
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   FAST-FORWARD MERGE    │     │   CONFLICT RESOLUTION   │
│   or MERGE COMMIT       │     │   ─────────────────────  │
│                         │     │   • Flag for human       │
│   git merge plan/xxx    │     │   • Provide conflict     │
│                         │     │     details              │
└─────────────────────────┘     └─────────────────────────┘
```

---

## Worktree Location Strategy

### Option 1: Inside Repository (gitignored)

```
project/
├── .git/
├── .gitignore          ← Contains: .rtslabs/worktrees/
├── .rtslabs/
│   ├── worktrees/      ← Worktrees here (gitignored)
│   │   └── p-abc123/
│   └── plans/
└── src/
```

**Pros:** Everything in one place
**Cons:** Clutters project directory, must ensure gitignored

### Option 2: Outside Repository

```
~/.rtslabs/worktrees/
└── project-name/
    └── p-abc123/

project/
├── .git/
├── .rtslabs/
│   └── plans/
└── src/
```

**Pros:** Clean project directory
**Cons:** Harder to find, need config for location

### Recommendation: Configurable

```json
// .rtslabs/config.json
{
  "git": {
    "worktree_location": "inside",  // or "outside" or absolute path
    "worktree_path": ".rtslabs/worktrees",  // relative if inside
    "default_base_branch": "main",
    "branch_prefix": "plan/"
  }
}
```

---

## Error Handling

### Worktree Errors

```typescript
type WorktreeError =
  | { type: 'already_exists'; planId: string; path: string }
  | { type: 'creation_failed'; planId: string; reason: string }
  | { type: 'not_found'; planId: string }
  | { type: 'removal_failed'; planId: string; reason: string }
  | { type: 'corrupted'; planId: string; issues: string[] }
  | { type: 'locked'; planId: string; lockedBy: string };

async function handleWorktreeError(error: WorktreeError): Promise<void> {
  switch (error.type) {
    case 'already_exists':
      // Check if it's usable or needs cleanup
      const health = await worktreeManager.checkHealth(error.planId);
      if (!health.valid) {
        await worktreeManager.remove(error.planId, true);
        // Retry creation
      }
      break;

    case 'corrupted':
      // Force remove and recreate
      await worktreeManager.remove(error.planId, true);
      break;

    case 'locked':
      // Wait and retry, or notify user
      await sleep(5000);
      break;
  }
}
```

### Commit Errors

```typescript
type CommitError =
  | { type: 'nothing_to_commit'; worktree: string }
  | { type: 'unresolved_conflicts'; files: string[] }
  | { type: 'pre_commit_hook_failed'; output: string }
  | { type: 'message_rejected'; reason: string };

async function handleCommitError(
  error: CommitError,
  task: Task,
  worktreePath: string
): Promise<CommitResult | null> {
  switch (error.type) {
    case 'nothing_to_commit':
      // Task made no changes - might be okay
      return {
        hash: 'none',
        branch: await branchManager.current(worktreePath),
        message: 'No changes',
        filesChanged: 0,
        insertions: 0,
        deletions: 0
      };

    case 'pre_commit_hook_failed':
      // Attempt to fix and retry
      // (e.g., run formatter, fix linting)
      await runAutoFixes(worktreePath);
      return await commitManager.commitTask(worktreePath, task, task.files_affected);

    case 'unresolved_conflicts':
      // Cannot auto-resolve, flag for human
      throw new Error(`Unresolved conflicts in: ${error.files.join(', ')}`);
  }
}
```

---

## Integration Points

### With Execution Engine
- Creates worktree before execution starts
- Provides worktree path to workers
- Commits after each task completion
- Reports git status for monitoring

### With Verification System
- Provides diff information for review
- Supplies commit history for final review
- Supports rollback if verification fails

### With Web UI
- Shows branch/commit status
- Displays diff visualizations
- Enables merge operations
- Lists active worktrees

### With Memory System
- Records successful git patterns
- Tracks common conflict resolutions

---

## Configuration

```json
// .rtslabs/config.json
{
  "git": {
    "worktree_location": "inside",
    "worktree_path": ".rtslabs/worktrees",
    "default_base_branch": "main",
    "branch_prefix": "plan/",
    "commit_message_format": "conventional",
    "auto_stage_all": false,
    "sign_commits": false,
    "push_on_complete": false,
    "create_pr_on_complete": false,
    "pr_template": null,
    "cleanup_after_days": 7
  }
}
```

---

## CLI Commands

For manual worktree management:

```bash
# List all worktrees
rtslabs worktree list

# Create worktree for plan
rtslabs worktree create p-abc123

# Remove worktree
rtslabs worktree remove p-abc123

# Clean stale worktrees
rtslabs worktree clean --older-than 7d

# Check worktree health
rtslabs worktree health p-abc123

# Push plan branch to remote
rtslabs git push p-abc123

# Create PR for plan
rtslabs git pr p-abc123 --title "Add user auth" --base main
```

---

## Metrics

```typescript
interface GitMetrics {
  plan_id: string;

  // Worktree
  worktree_created_at: Date;
  worktree_size_mb: number;

  // Commits
  total_commits: number;
  commits_by_task: Record<string, string>;  // taskId -> commitHash

  // Changes
  total_files_changed: number;
  total_insertions: number;
  total_deletions: number;
  files_by_category: Record<string, number>;

  // Conflicts
  conflicts_encountered: number;
  conflicts_auto_resolved: number;
  conflicts_manual_resolved: number;

  // Performance
  avg_commit_time_ms: number;
  total_git_operations: number;
}
```
