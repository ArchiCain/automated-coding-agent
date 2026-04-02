# 17 — Task Decomposition & Concurrency

## Goal

Implement the architect role's decomposition capability (breaking large features into task trees) and the orchestrator's ability to run multiple agents concurrently with proper isolation and conflict detection.

## Current State

- The coding-agent backend has `decomposition.service.ts` (37KB) — significant existing logic for breaking plans into task trees
- The backlog system (`backlog.service.ts`) manages plan/task state on the filesystem
- Existing data model in `.coding-agent-data/backlog/`: plans (`p-*`) with nested task directories
- `AutoDecompWorker` in `job-queue/` handles background decomposition
- No multi-agent concurrency — tasks run one at a time

## Target State

- Architect role decomposes features into hierarchical task trees
- Task tree format: project → feature → concern → atomic task
- Dependency tracking between tasks
- Orchestrator respects dependency ordering
- Up to N agents working concurrently (configurable, default 4)
- Each agent gets its own worktree, branch, and namespace
- Conflict detection: tasks touching same files are serialized
- Merge conflict handling on PR submission

## Implementation Steps

### Step 1: Define Task Tree Data Model

```typescript
export interface TaskTree {
  id: string;
  title: string;
  description: string;
  source: string;              // Original issue/plan
  rootNode: TaskNode;
}

export interface TaskNode {
  id: string;
  type: 'project' | 'feature' | 'concern' | 'task';
  title: string;
  description: string;
  children: TaskNode[];
  dependencies: string[];      // IDs of sibling nodes that must complete first
  status: TaskNodeStatus;
  assignedAgent?: number;      // Agent slot ID
  estimatedFiles?: string[];   // Files this task is likely to touch
}

export type TaskNodeStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'blocked';
```

Example tree:

```
Feature: User Profile Page
├── Backend (project)
│   ├── Create user profile entity and migration (task) — ready
│   ├── Create profile API endpoints (task) — depends on entity
│   └── Add profile image upload endpoint (task) — depends on API
├── Frontend (project)
│   ├── Create profile page component (task) — depends on backend API
│   ├── Create profile edit form (task) — depends on page component
│   └── Add avatar upload component (task) — depends on edit form
└── E2E (project)
    └── Write Playwright tests for profile flow (task) — depends on all frontend
```

### Step 2: Implement Decomposition Service

Refactor the existing `decomposition.service.ts` to work with the new task tree model:

```typescript
@Injectable()
export class DecompositionService {
  constructor(
    private registry: ProviderRegistryService,
    private skillLoader: SkillLoaderService,
  ) {}

  async decompose(plan: string): Promise<TaskTree> {
    // Use the architect role to analyze the codebase and create a task tree
    const architect = this.registry.getForRole('architect');
    const systemPrompt = await this.skillLoader.buildSystemPrompt('architect', {
      description: plan,
    });

    let output = '';
    for await (const message of architect.execute({
      prompt: this.buildDecompositionPrompt(plan),
      cwd: '/workspace/repo',
      systemPrompt,
      allowedTools: ['Read', 'Grep', 'Glob'],  // Read-only
    })) {
      if (message.type === 'text') output += message.content;
    }

    // Parse the architect's output into a TaskTree
    return this.parseTaskTree(output);
  }

  private buildDecompositionPrompt(plan: string): string {
    return `Analyze the codebase and decompose the following feature into an implementation plan:

${plan}

Output a task tree in this format:
- Each leaf task must be atomic (one agent can complete it independently)
- Specify dependencies between tasks
- Estimate which files each task will create or modify
- Group tasks by project area (backend, frontend, e2e, etc.)
- Order tasks so dependencies are respected

Format your output as a JSON task tree (TaskTree structure).`;
  }

  private parseTaskTree(output: string): TaskTree {
    // Extract JSON from the architect's output
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    throw new Error('Architect did not produce a valid task tree');
  }
}
```

### Step 3: Implement Task Queue with Dependencies

```typescript
@Injectable()
export class TaskQueueService {
  private queue: Task[] = [];

  addTree(tree: TaskTree): void {
    // Flatten the tree into leaf tasks with dependency info
    const leafTasks = this.flattenTree(tree.rootNode);
    this.queue.push(...leafTasks);
    this.updateReadiness();
  }

  getNextReady(): Task | null {
    return this.queue.find(t => t.status === 'queued' && this.areDependenciesMet(t)) ?? null;
  }

  markCompleted(taskId: string): void {
    const task = this.queue.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      this.updateReadiness();
    }
  }

  private areDependenciesMet(task: Task): boolean {
    return task.dependencies.every(depId => {
      const dep = this.queue.find(t => t.id === depId);
      return dep?.status === 'completed';
    });
  }

  private updateReadiness(): void {
    for (const task of this.queue) {
      if (task.status === 'queued' && this.areDependenciesMet(task)) {
        // Task is ready to be assigned
      }
    }
  }

  private flattenTree(node: TaskNode, parentDeps: string[] = []): Task[] {
    if (node.type === 'task') {
      return [{
        id: node.id,
        title: node.title,
        description: node.description,
        dependencies: [...parentDeps, ...node.dependencies],
        status: 'queued',
        estimatedFiles: node.estimatedFiles ?? [],
        // ... other fields
      }];
    }

    const tasks: Task[] = [];
    for (const child of node.children) {
      tasks.push(...this.flattenTree(child, [...parentDeps, ...node.dependencies]));
    }
    return tasks;
  }
}
```

### Step 4: Implement Concurrent Agent Pool

Extend the `AgentPoolService` from Plan 04 to support multiple concurrent agents:

```typescript
@Injectable()
export class AgentPoolService {
  private slots: AgentSlot[];
  private executing = new Map<string, Promise<TaskResult>>();

  constructor(private config: DevTeamConfigService) {
    const maxConcurrent = config.maxConcurrentAgents;
    this.slots = Array.from({ length: maxConcurrent }, (_, i) => ({
      id: i,
      status: 'idle' as const,
    }));
  }

  async processQueue(queue: TaskQueueService): Promise<void> {
    // Continuously assign tasks to idle agents
    while (queue.hasWork()) {
      const idleSlot = this.slots.find(s => s.status === 'idle');
      if (!idleSlot) {
        // All agents busy — wait for one to finish
        await Promise.race(this.executing.values());
        continue;
      }

      const task = queue.getNextReady();
      if (!task) {
        // No ready tasks — wait for a dependency to complete
        if (this.executing.size > 0) {
          await Promise.race(this.executing.values());
        }
        continue;
      }

      // Check for file conflicts
      if (this.hasFileConflict(task, queue)) {
        // Serialize this task — wait until conflicting tasks complete
        continue;
      }

      // Assign and execute
      idleSlot.status = 'active';
      idleSlot.taskId = task.id;
      task.status = 'assigned';

      const promise = this.executionLoop.execute(task)
        .then(result => {
          idleSlot.status = 'idle';
          idleSlot.taskId = undefined;
          queue.markCompleted(task.id);
          this.executing.delete(task.id);
          return result;
        })
        .catch(error => {
          idleSlot.status = 'idle';
          idleSlot.taskId = undefined;
          task.status = 'failed';
          this.executing.delete(task.id);
          throw error;
        });

      this.executing.set(task.id, promise);
    }

    // Wait for all in-flight tasks to complete
    await Promise.all(this.executing.values());
  }

  private hasFileConflict(task: Task, queue: TaskQueueService): boolean {
    // Check if any in-progress task touches the same files
    for (const [activeTaskId] of this.executing) {
      const activeTask = queue.getTask(activeTaskId);
      if (!activeTask) continue;

      const overlap = task.estimatedFiles?.some(f =>
        activeTask.estimatedFiles?.includes(f)
      );
      if (overlap) return true;
    }
    return false;
  }
}
```

### Step 5: Handle Merge Conflicts

When multiple agents work concurrently and submit PRs, merge conflicts can occur:

```typescript
async handleMergeConflict(task: Task): Promise<void> {
  // Rebase the task branch on latest main
  await this.gitService.fetch();
  const rebaseResult = await this.gitService.rebase(task.worktreePath!, 'origin/main');

  if (rebaseResult.hasConflicts) {
    // Run the implementer to resolve conflicts
    await this.runRole('implementer', task, {
      prompt: `The branch has merge conflicts after rebasing on main. Resolve all conflicts, ensuring the task changes are preserved while integrating upstream changes.`,
      skills: ['execute'],
    });

    // Re-run validation after conflict resolution
    await this.buildAndDeploy(task);
    await this.test(task);
  }

  // Force push the rebased branch
  await this.gitService.push(task.branch, { force: true });
}
```

### Step 6: Implement Resource Management

The orchestrator checks cluster resources before spawning new agents:

```typescript
async hasClusterCapacity(): Promise<boolean> {
  const result = await exec('kubectl top nodes --no-headers');
  // Parse CPU and memory usage
  // Return false if usage is above threshold (e.g., 80%)
  const usage = this.parseNodeUsage(result);
  return usage.cpuPercent < 80 && usage.memoryPercent < 80;
}
```

### Step 7: Stale Environment Cleanup

The scheduler periodically cleans up orphaned environments:

```typescript
@Cron('0 * * * *')  // Every hour
async cleanupStaleEnvironments(): Promise<void> {
  await this.taskfile.run('env:cleanup:stale', '24');  // Remove envs older than 24 hours
}
```

## Verification

- [ ] Architect decomposes a feature into a task tree
- [ ] Task tree has correct dependency relationships
- [ ] Leaf tasks are queued in dependency order
- [ ] Multiple agents run concurrently (verify with 2+ tasks)
- [ ] Each agent has its own worktree, branch, and namespace
- [ ] File conflict detection serializes overlapping tasks
- [ ] Merge conflicts are detected and resolved
- [ ] Resource checks prevent over-provisioning
- [ ] Stale environment cleanup runs on schedule

## Open Questions

- **Decomposition quality:** The architect's decomposition depends heavily on the LLM's understanding of the codebase. How to ensure consistent, useful decomposition? The decompose skill document (Plan 06) is critical — it must encode enough domain knowledge.
- **Conflict detection accuracy:** Estimating which files a task will touch is imprecise. The architect guesses based on the task description. False positives (unnecessary serialization) are safe but slow. False negatives (missed conflicts) cause merge issues. Start with conservative estimation.
- **Agent count vs resources:** Running 4 agents means 4 full app stacks + the orchestrator. On an 8GB machine, this is tight. Start with 2 concurrent agents and scale up.
- **Task tree persistence:** Where is the task tree stored? In `.the-dev-team/backlog/` like the existing system? Or in the task state directory? The existing backlog data model is close — refactor it.
