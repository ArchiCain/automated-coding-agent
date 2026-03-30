import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { AgentState, AgentDocument, AGENT_TYPES } from '../core/base-agent';

/**
 * Decomposition session metadata
 */
export interface DecompositionSessionMeta {
  sessionId: string;
  planId: string;
  planName: string;
  planPath: string;
  inputFile: string;
  outputBase: string;
  parentId: string;
  decompType: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Decomposition session with full state
 */
export interface DecompositionSession {
  agent: AgentState;
  meta: DecompositionSessionMeta;
}

/**
 * Cached session data
 */
interface CachedDecompositionSession {
  state: AgentState;
  meta: DecompositionSessionMeta;
}

/**
 * Plan info for decomposition
 */
export interface PlanInfo {
  id: string;
  name: string;
  path: string;
  status: string;
  hasBeenDecomposed: boolean;
  taskCount: number;
}

/**
 * Task node in the task tree
 */
export interface TaskNode {
  slug: string;
  name: string;
  status: string;
  path: string;
  depth: number;
  children: TaskNode[];
}

/**
 * Existing task info for prompt injection
 */
export interface ExistingTask {
  name: string;
  path: string;
  status: string;
}

/**
 * Task info for listing in decomposition pages
 */
export interface TaskInfo {
  id: string;           // Full path identifier (e.g., "p-abc123/backend" or "p-abc123/backend/features/auth")
  planId: string;       // Parent plan ID
  slug: string;         // Task slug (e.g., "backend" or "auth")
  name: string;         // Human-readable name from task.md
  path: string;         // Absolute path to task.md
  taskPath: string;     // Absolute path to task directory
  status: string;       // Task status
  hasBeenDecomposed: boolean;
  childCount: number;   // Number of child tasks
}

/**
 * Task status types
 */
export type TaskStatus = 'not_ready' | 'ready' | 'executing' | 'completed' | 'failed';

/**
 * Project task item for listing
 */
export interface ProjectTaskItem {
  name: string;
  path: string;
  status: TaskStatus;
  hasChildren: boolean;
  childCount?: number;
  featuresCount?: number;
}

/**
 * Feature task item for listing
 */
export interface FeatureTaskItem {
  name: string;
  path: string;
  status: TaskStatus;
  hasChildren: boolean;
  childCount?: number;
  concernsCount?: number;
}

/**
 * Concern task item for listing
 */
export interface ConcernTaskItem {
  name: string;
  path: string;
  status: TaskStatus;
  hasChildren: boolean;
  dependsOn?: string[];
}

/**
 * Task status file structure
 */
export interface TaskStatusFile {
  status: TaskStatus;
  updatedAt?: string;
  error?: string;
}

/**
 * Reset result
 */
export interface ResetResult {
  success: boolean;
  deletedCount: number;
}

// Constants (previously on DecompositionAgent)
const PROMPT_FILE = '.agent-prompts/decomposition.md';
const DECOMP_TYPES: Record<string, string> = {
  'plan-to-projects': '.agent-prompts/decomp-plan-to-projects.md',
  'project-to-features': '.agent-prompts/decomp-project-to-features.md',
  'feature-to-concerns': '.agent-prompts/decomp-feature-to-concerns.md',
};
const CONTEXT_FILES = [
  'docs/backlog-structure.md',
  'docs/feature-architecture.md',
  'projects/README.md',
];
const DECOMP_TYPE_NAMES: Record<string, string> = {
  'plan-to-projects': 'Plan to Projects',
  'project-to-features': 'Project to Features',
  'feature-to-concerns': 'Feature to Concerns',
};

@Injectable()
export class DecompositionService {
  private readonly logger = new Logger(DecompositionService.name);
  private readonly backlogDir: string;
  private readonly repoRoot: string;

  // Cache of active decomposition sessions by sessionId (ephemeral, in-memory only)
  private sessions: Map<string, CachedDecompositionSession> = new Map();

  constructor() {
    // Navigate up from dist directory to repo root
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
    this.backlogDir = path.join(this.repoRoot, '.coding-agent-data', 'backlog');
  }

  /**
   * Generate a new decomposition session ID
   */
  private generateSessionId(): string {
    const hex = randomBytes(3).toString('hex');
    return `d-${hex}`;
  }

  /**
   * Build documents list for a decomposition session
   */
  private buildDocuments(decompType: string, inputFile: string): AgentDocument[] {
    const docs: AgentDocument[] = [
      {
        id: 'decomposition-prompt',
        name: 'decomposition.md',
        path: path.join(this.repoRoot, PROMPT_FILE),
        type: 'prompt',
      },
    ];

    // Add extra instructions for this decomposition type
    const extraInstructionsFile = DECOMP_TYPES[decompType];
    if (extraInstructionsFile) {
      docs.push({
        id: 'extra-instructions',
        name: path.basename(extraInstructionsFile),
        path: path.join(this.repoRoot, extraInstructionsFile),
        type: 'context',
      });
    }

    // Add context files
    CONTEXT_FILES.forEach((file, index) => {
      docs.push({
        id: `context-${index}`,
        name: path.basename(file),
        path: path.join(this.repoRoot, file),
        type: 'context',
      });
    });

    // Add the input file
    docs.push({
      id: 'input-file',
      name: path.basename(inputFile),
      path: inputFile,
      type: 'context',
    });

    return docs;
  }

  /**
   * Build a cached decomposition session
   */
  private buildCachedSession(
    sessionId: string,
    planId: string,
    planName: string,
    planPath: string,
    inputFile: string,
    outputBase: string,
    parentId: string,
    decompType: string,
  ): CachedDecompositionSession {
    const now = new Date().toISOString();
    const typeName = DECOMP_TYPE_NAMES[decompType] || decompType;

    const state: AgentState = {
      id: 'decomposition-agent',
      name: typeName,
      description: 'Breaks down plans and tasks into smaller, executable units',
      icon: 'account_tree',
      type: AGENT_TYPES.decomposition,
      status: 'idle',
      documents: this.buildDocuments(decompType, inputFile),
    };

    const meta: DecompositionSessionMeta = {
      sessionId,
      planId,
      planName,
      planPath,
      inputFile,
      outputBase,
      parentId,
      decompType,
      createdAt: now,
      updatedAt: now,
    };

    return { state, meta };
  }

  /**
   * List all plans available for decomposition
   */
  async listPlans(): Promise<PlanInfo[]> {
    const plans: PlanInfo[] = [];

    try {
      const entries = await fs.readdir(this.backlogDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('p-')) {
          const planId = entry.name;
          const planPath = path.join(this.backlogDir, planId);

          try {
            // Read state.json
            const stateContent = await fs.readFile(
              path.join(planPath, 'state.json'),
              'utf-8',
            );
            const state = JSON.parse(stateContent);

            // Read status.json if it exists
            let status = 'draft';
            try {
              const statusContent = await fs.readFile(
                path.join(planPath, 'status.json'),
                'utf-8',
              );
              const statusData = JSON.parse(statusContent);
              status = statusData.status || 'draft';
            } catch {
              // status.json doesn't exist yet
            }

            // Check if tasks directory exists and count tasks
            let taskCount = 0;
            let hasBeenDecomposed = false;
            const tasksDir = path.join(planPath, 'tasks');
            try {
              const taskEntries = await fs.readdir(tasksDir, { withFileTypes: true });
              hasBeenDecomposed = taskEntries.some(e => e.isDirectory());
              taskCount = taskEntries.filter(e => e.isDirectory()).length;
            } catch {
              // tasks directory doesn't exist
            }

            plans.push({
              id: planId,
              name: state.name || 'Untitled',
              path: path.join(planPath, 'plan.md'),
              status,
              hasBeenDecomposed,
              taskCount,
            });
          } catch (err) {
            this.logger.warn(`Failed to read plan ${planId}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        this.logger.error(`Failed to list plans: ${err.message}`);
      }
    }

    // Sort by name
    plans.sort((a, b) => a.name.localeCompare(b.name));
    return plans;
  }

  /**
   * Get a specific plan's info
   */
  async getPlanInfo(planId: string): Promise<PlanInfo | null> {
    const plans = await this.listPlans();
    return plans.find(p => p.id === planId) || null;
  }

  /**
   * Update a plan's ready status
   */
  async updatePlanReady(planId: string, ready: boolean): Promise<void> {
    const planPath = path.join(this.backlogDir, planId);
    const statusPath = path.join(planPath, 'status.json');

    let statusData: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(statusPath, 'utf-8');
      statusData = JSON.parse(content);
    } catch {
      // status.json doesn't exist yet, create new
    }

    statusData.status = ready ? 'ready' : 'draft';
    statusData.updatedAt = new Date().toISOString();

    await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2));
    this.logger.log(`Updated plan ${planId} ready status to ${ready}`);
  }

  /**
   * Update a task's ready status
   */
  async updateTaskReady(planId: string, taskSlug: string, ready: boolean): Promise<void> {
    const taskPath = path.join(this.backlogDir, planId, 'tasks', taskSlug);
    const statusPath = path.join(taskPath, 'status.json');

    let statusData: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(statusPath, 'utf-8');
      statusData = JSON.parse(content);
    } catch {
      // status.json doesn't exist yet, create new
    }

    statusData.status = ready ? 'ready' : 'pending';
    statusData.updatedAt = new Date().toISOString();

    await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2));
    this.logger.log(`Updated task ${taskSlug} ready status to ${ready}`);
  }

  /**
   * Create a new decomposition session (ephemeral, in-memory only)
   */
  async createSession(
    planId: string,
    decompType: string,
  ): Promise<DecompositionSession> {
    const sessionId = this.generateSessionId();
    const planPath = path.join(this.backlogDir, planId);

    this.logger.log(`Creating decomposition session ${sessionId} for plan ${planId} (${decompType})`);

    // Read plan state
    const stateContent = await fs.readFile(
      path.join(planPath, 'state.json'),
      'utf-8',
    );
    const state = JSON.parse(stateContent);

    // Determine input file and output base
    const inputFile = path.join(planPath, 'plan.md');
    const outputBase = path.join(planPath, 'tasks');

    // Ensure tasks directory exists
    await fs.mkdir(outputBase, { recursive: true });

    // Build and cache the session
    const cached = this.buildCachedSession(
      sessionId,
      planId,
      state.name,
      planPath,
      inputFile,
      outputBase,
      planId, // parent is the plan itself for first-level decomposition
      decompType,
    );
    this.sessions.set(sessionId, cached);

    return {
      agent: cached.state,
      meta: cached.meta,
    };
  }

  /**
   * Get a decomposition session (in-memory only)
   */
  getSession(sessionId: string): DecompositionSession | null {
    const cached = this.sessions.get(sessionId);
    if (!cached) {
      return null;
    }

    return {
      agent: cached.state,
      meta: { ...cached.meta, updatedAt: new Date().toISOString() },
    };
  }

  /**
   * Get existing tasks for a plan, formatted for prompt injection
   */
  async getExistingTasks(planId: string): Promise<ExistingTask[]> {
    const tasksDir = path.join(this.backlogDir, planId, 'tasks');
    const tasks: ExistingTask[] = [];

    const readTaskDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const taskPath = path.join(dir, entry.name);
            const planMdPath = path.join(taskPath, 'plan.md');
            const taskMdPath = path.join(taskPath, 'task.md');
            const statusPath = path.join(taskPath, 'status.json');

            try {
              // Read plan.md or task.md to get the name
              let content: string;
              try {
                content = await fs.readFile(planMdPath, 'utf-8');
              } catch {
                content = await fs.readFile(taskMdPath, 'utf-8');
              }
              const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
              const name = nameMatch ? nameMatch[1] : entry.name;

              // Read status
              let status = 'pending';
              try {
                const statusContent = await fs.readFile(statusPath, 'utf-8');
                const statusData = JSON.parse(statusContent);
                status = statusData.status || 'pending';
              } catch {
                // No status file
              }

              tasks.push({
                name,
                path: taskPath,
                status,
              });

              // Recursively read children
              await readTaskDir(taskPath);
            } catch {
              // Neither plan.md nor task.md exists in this directory
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }
    };

    await readTaskDir(tasksDir);
    return tasks;
  }

  /**
   * Get available decomposition types
   */
  getDecompTypes(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'plan-to-projects',
        name: 'Plan to Projects',
        description: 'Break a plan into project-level tasks (backend, frontend, etc.)',
      },
      {
        id: 'project-to-features',
        name: 'Project to Features',
        description: 'Break a project into feature-level tasks',
      },
      {
        id: 'feature-to-concerns',
        name: 'Feature to Concerns',
        description: 'Break a feature into atomic implementation tasks',
      },
    ];
  }

  /**
   * Get the tasks tree for a plan
   */
  async getTasksTree(planId: string): Promise<TaskNode[]> {
    const tasksDir = path.join(this.backlogDir, planId, 'tasks');
    return this.getTasksFromDirectory(tasksDir);
  }

  /**
   * Get the tasks tree from a specific directory (outputBase)
   */
  async getTasksFromDirectory(tasksDir: string): Promise<TaskNode[]> {
    const readTaskDir = async (dir: string, depth = 0): Promise<TaskNode[]> => {
      const tasks: TaskNode[] = [];

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory()) {
            const taskPath = path.join(dir, entry.name);
            const planMdPath = path.join(taskPath, 'plan.md');
            const taskMdPath = path.join(taskPath, 'task.md');
            const statusPath = path.join(taskPath, 'status.json');

            try {
              // Read plan.md or task.md to get the name
              let content: string;
              try {
                content = await fs.readFile(planMdPath, 'utf-8');
              } catch {
                content = await fs.readFile(taskMdPath, 'utf-8');
              }
              const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
              const name = nameMatch ? nameMatch[1] : entry.name;

              // Read status
              let status = 'pending';
              try {
                const statusContent = await fs.readFile(statusPath, 'utf-8');
                const statusData = JSON.parse(statusContent);
                status = statusData.status || 'pending';
              } catch {
                // No status file
              }

              // Check for children in structured subdirectories (features/ or concerns/)
              let children: TaskNode[] = [];
              const featuresDir = path.join(taskPath, 'features');
              const concernsDir = path.join(taskPath, 'concerns');

              try {
                await fs.access(featuresDir);
                children = await readTaskDir(featuresDir, depth + 1);
              } catch {
                // No features directory, try concerns
                try {
                  await fs.access(concernsDir);
                  children = await readTaskDir(concernsDir, depth + 1);
                } catch {
                  // No structured children
                }
              }

              tasks.push({
                slug: entry.name,
                name,
                status,
                path: taskPath,
                depth,
                children,
              });
            } catch {
              // task.md doesn't exist in this directory
            }
          }
        }
      } catch {
        // Directory doesn't exist
      }

      return tasks;
    };

    return readTaskDir(tasksDir);
  }

  /**
   * List all project-level tasks across all plans
   * These are the top-level tasks under tasks/ (e.g., backend, frontend)
   */
  async listProjectTasks(): Promise<TaskInfo[]> {
    const tasks: TaskInfo[] = [];

    try {
      // Get all plan directories
      const planEntries = await fs.readdir(this.backlogDir, { withFileTypes: true });

      for (const planEntry of planEntries) {
        if (planEntry.isDirectory() && planEntry.name.startsWith('p-')) {
          const planId = planEntry.name;
          const tasksDir = path.join(this.backlogDir, planId, 'tasks');

          try {
            const taskEntries = await fs.readdir(tasksDir, { withFileTypes: true });

            for (const taskEntry of taskEntries) {
              if (taskEntry.isDirectory()) {
                const taskPath = path.join(tasksDir, taskEntry.name);
                const planMdPath = path.join(taskPath, 'plan.md');
                const taskMdPath = path.join(taskPath, 'task.md');
                const statusPath = path.join(taskPath, 'status.json');
                const featuresDir = path.join(taskPath, 'features');

                try {
                  // Read plan.md (preferred) or task.md (legacy) to get the name
                  let content: string;
                  try {
                    content = await fs.readFile(planMdPath, 'utf-8');
                  } catch {
                    content = await fs.readFile(taskMdPath, 'utf-8');
                  }
                  const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
                  const name = nameMatch ? nameMatch[1] : taskEntry.name;

                  // Read status
                  let status = 'pending';
                  try {
                    const statusContent = await fs.readFile(statusPath, 'utf-8');
                    const statusData = JSON.parse(statusContent);
                    status = statusData.status || 'pending';
                  } catch {
                    // No status file
                  }

                  // Check for features (children)
                  let childCount = 0;
                  let hasBeenDecomposed = false;
                  try {
                    const featureEntries = await fs.readdir(featuresDir, { withFileTypes: true });
                    childCount = featureEntries.filter(e => e.isDirectory()).length;
                    hasBeenDecomposed = childCount > 0;
                  } catch {
                    // features directory doesn't exist
                  }

                  tasks.push({
                    id: `${planId}/${taskEntry.name}`,
                    planId,
                    slug: taskEntry.name,
                    name,
                    path: planMdPath,
                    taskPath,
                    status,
                    hasBeenDecomposed,
                    childCount,
                  });
                } catch {
                  // Neither plan.md nor task.md exists
                }
              }
            }
          } catch {
            // tasks directory doesn't exist for this plan
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to list project tasks: ${err.message}`);
    }

    // Sort by plan ID then name
    tasks.sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      return a.name.localeCompare(b.name);
    });

    return tasks;
  }

  /**
   * List all feature-level tasks across all plans
   * These are tasks under tasks/{project}/features/
   */
  async listFeatureTasks(): Promise<TaskInfo[]> {
    const tasks: TaskInfo[] = [];

    try {
      // Get all plan directories
      const planEntries = await fs.readdir(this.backlogDir, { withFileTypes: true });

      for (const planEntry of planEntries) {
        if (planEntry.isDirectory() && planEntry.name.startsWith('p-')) {
          const planId = planEntry.name;
          const tasksDir = path.join(this.backlogDir, planId, 'tasks');

          try {
            // Get all project directories
            const projectEntries = await fs.readdir(tasksDir, { withFileTypes: true });

            for (const projectEntry of projectEntries) {
              if (projectEntry.isDirectory()) {
                const featuresDir = path.join(tasksDir, projectEntry.name, 'features');

                try {
                  const featureEntries = await fs.readdir(featuresDir, { withFileTypes: true });

                  for (const featureEntry of featureEntries) {
                    if (featureEntry.isDirectory()) {
                      const taskPath = path.join(featuresDir, featureEntry.name);
                      const planMdPath = path.join(taskPath, 'plan.md');
                      const taskMdPath = path.join(taskPath, 'task.md');
                      const statusPath = path.join(taskPath, 'status.json');
                      const concernsDir = path.join(taskPath, 'concerns');

                      try {
                        // Read plan.md (preferred) or task.md (legacy) to get the name
                        let content: string;
                        try {
                          content = await fs.readFile(planMdPath, 'utf-8');
                        } catch {
                          content = await fs.readFile(taskMdPath, 'utf-8');
                        }
                        const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
                        const name = nameMatch ? nameMatch[1] : featureEntry.name;

                        // Read status
                        let status = 'pending';
                        try {
                          const statusContent = await fs.readFile(statusPath, 'utf-8');
                          const statusData = JSON.parse(statusContent);
                          status = statusData.status || 'pending';
                        } catch {
                          // No status file
                        }

                        // Check for concerns (children)
                        let childCount = 0;
                        let hasBeenDecomposed = false;
                        try {
                          const concernEntries = await fs.readdir(concernsDir, { withFileTypes: true });
                          childCount = concernEntries.filter(e => e.isDirectory()).length;
                          hasBeenDecomposed = childCount > 0;
                        } catch {
                          // concerns directory doesn't exist
                        }

                        tasks.push({
                          id: `${planId}/${projectEntry.name}/features/${featureEntry.name}`,
                          planId,
                          slug: featureEntry.name,
                          name,
                          path: planMdPath,
                          taskPath,
                          status,
                          hasBeenDecomposed,
                          childCount,
                        });
                      } catch {
                        // Neither plan.md nor task.md exists
                      }
                    }
                  }
                } catch {
                  // features directory doesn't exist
                }
              }
            }
          } catch {
            // tasks directory doesn't exist
          }
        }
      }
    } catch (err) {
      this.logger.error(`Failed to list feature tasks: ${err.message}`);
    }

    // Sort by plan ID then name
    tasks.sort((a, b) => {
      if (a.planId !== b.planId) return a.planId.localeCompare(b.planId);
      return a.name.localeCompare(b.name);
    });

    return tasks;
  }

  /**
   * Create a decomposition session for a task (project or feature)
   */
  async createSessionForTask(
    taskId: string,
    decompType: string,
  ): Promise<DecompositionSession> {
    const sessionId = this.generateSessionId();

    // Parse taskId to get components (e.g., "p-abc123/backend" or "p-abc123/backend/features/auth")
    const parts = taskId.split('/');
    const planId = parts[0];
    const planPath = path.join(this.backlogDir, planId);

    // Build the task path
    let taskPath: string;
    let outputBase: string;

    if (decompType === 'project-to-features') {
      // taskId is like "p-abc123/backend"
      const projectSlug = parts[1];
      taskPath = path.join(planPath, 'tasks', projectSlug);
      outputBase = path.join(taskPath, 'features');
    } else if (decompType === 'feature-to-concerns') {
      // taskId is like "p-abc123/backend/features/auth"
      const projectSlug = parts[1];
      const featureSlug = parts[3];
      taskPath = path.join(planPath, 'tasks', projectSlug, 'features', featureSlug);
      outputBase = path.join(taskPath, 'concerns');
    } else {
      throw new Error(`Invalid decomp type for task: ${decompType}`);
    }

    // Use plan.md for projects/features, task.md for concerns
    const isPlanLevel = decompType === 'project-to-features';
    let inputFile = path.join(taskPath, isPlanLevel ? 'plan.md' : 'task.md');

    // Read plan.md/task.md to get the name (fall back to the other if not found)
    let taskName = 'Task';
    try {
      const content = await fs.readFile(inputFile, 'utf-8');
      const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
      taskName = nameMatch ? nameMatch[1] : parts[parts.length - 1];
    } catch {
      // Try the other file type as fallback (legacy support)
      const fallbackFile = path.join(taskPath, isPlanLevel ? 'task.md' : 'plan.md');
      try {
        const content = await fs.readFile(fallbackFile, 'utf-8');
        const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
        taskName = nameMatch ? nameMatch[1] : parts[parts.length - 1];
        inputFile = fallbackFile;
      } catch {
        taskName = parts[parts.length - 1];
      }
    }

    this.logger.log(`Creating ${decompType} session ${sessionId} for task ${taskId}`);

    // Ensure output directory exists
    await fs.mkdir(outputBase, { recursive: true });

    // Build and cache the session
    const cached = this.buildCachedSession(
      sessionId,
      planId,
      taskName,
      planPath,
      inputFile,
      outputBase,
      taskId,
      decompType,
    );
    this.sessions.set(sessionId, cached);

    return {
      agent: cached.state,
      meta: cached.meta,
    };
  }

  // ============================================
  // Task CRUD methods (for decomposition pages)
  // ============================================

  /**
   * Get project tasks for a specific plan
   */
  async getProjectTasksForPlan(planId: string): Promise<ProjectTaskItem[]> {
    const projects: ProjectTaskItem[] = [];
    const tasksDir = path.join(this.backlogDir, planId, 'tasks');

    try {
      const entries = await fs.readdir(tasksDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const projectPath = path.join(tasksDir, entry.name);
          const planMdPath = path.join(projectPath, 'plan.md');
          const taskMdPath = path.join(projectPath, 'task.md');
          const statusPath = path.join(projectPath, 'status.json');
          const featuresDir = path.join(projectPath, 'features');

          try {
            // Read plan.md (preferred) or task.md (legacy) to get the name
            let content: string;
            try {
              content = await fs.readFile(planMdPath, 'utf-8');
            } catch {
              content = await fs.readFile(taskMdPath, 'utf-8');
            }
            const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
            const name = nameMatch ? nameMatch[1] : entry.name;

            // Read status
            let status: TaskStatus = 'not_ready';
            try {
              const statusContent = await fs.readFile(statusPath, 'utf-8');
              const statusData = JSON.parse(statusContent);
              status = statusData.status || 'not_ready';
            } catch {
              // No status file
            }

            // Check for features
            let featuresCount = 0;
            let hasChildren = false;
            try {
              const featureEntries = await fs.readdir(featuresDir, { withFileTypes: true });
              featuresCount = featureEntries.filter(e => e.isDirectory()).length;
              hasChildren = featuresCount > 0;
            } catch {
              // features directory doesn't exist
            }

            projects.push({
              name,
              path: entry.name,
              status,
              hasChildren,
              childCount: featuresCount,
              featuresCount,
            });
          } catch {
            // Neither plan.md nor task.md exists
          }
        }
      }
    } catch {
      // tasks directory doesn't exist
    }

    return projects;
  }

  /**
   * Get feature tasks for a specific project within a plan
   */
  async getFeatureTasksForProject(planId: string, projectPath: string): Promise<FeatureTaskItem[]> {
    const features: FeatureTaskItem[] = [];
    const featuresDir = path.join(this.backlogDir, planId, 'tasks', projectPath, 'features');

    try {
      const entries = await fs.readdir(featuresDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const featurePath = path.join(featuresDir, entry.name);
          const planMdPath = path.join(featurePath, 'plan.md');
          const taskMdPath = path.join(featurePath, 'task.md');
          const statusPath = path.join(featurePath, 'status.json');
          const concernsDir = path.join(featurePath, 'concerns');

          try {
            // Read plan.md (preferred) or task.md (legacy) to get the name
            let content: string;
            try {
              content = await fs.readFile(planMdPath, 'utf-8');
            } catch {
              content = await fs.readFile(taskMdPath, 'utf-8');
            }
            const nameMatch = content.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
            const name = nameMatch ? nameMatch[1] : entry.name;

            // Read status
            let status: TaskStatus = 'not_ready';
            try {
              const statusContent = await fs.readFile(statusPath, 'utf-8');
              const statusData = JSON.parse(statusContent);
              status = statusData.status || 'not_ready';
            } catch {
              // No status file
            }

            // Check for concerns
            let concernsCount = 0;
            let hasChildren = false;
            try {
              const concernEntries = await fs.readdir(concernsDir, { withFileTypes: true });
              concernsCount = concernEntries.filter(e => e.isDirectory()).length;
              hasChildren = concernsCount > 0;
            } catch {
              // concerns directory doesn't exist
            }

            features.push({
              name,
              path: `${projectPath}/features/${entry.name}`,
              status,
              hasChildren,
              childCount: concernsCount,
              concernsCount,
            });
          } catch {
            // task.md doesn't exist
          }
        }
      }
    } catch {
      // features directory doesn't exist
    }

    return features;
  }

  /**
   * Get concern tasks for a specific feature within a project
   */
  async getConcernTasksForFeature(
    planId: string,
    projectPath: string,
    featureName: string,
  ): Promise<ConcernTaskItem[]> {
    const concerns: ConcernTaskItem[] = [];
    const concernsDir = path.join(
      this.backlogDir,
      planId,
      'tasks',
      projectPath,
      'features',
      featureName,
      'concerns',
    );

    try {
      const entries = await fs.readdir(concernsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const concernPath = path.join(concernsDir, entry.name);
          const taskMdPath = path.join(concernPath, 'task.md');
          const statusPath = path.join(concernPath, 'status.json');

          try {
            // Read task.md to get the name (concerns are always task.md)
            const taskContent = await fs.readFile(taskMdPath, 'utf-8');
            const nameMatch = taskContent.match(/^#\s+(?:(?:Plan|Task):\s+)?(.+)$/m);
            const name = nameMatch ? nameMatch[1] : entry.name;

            // Read status and dependencies
            let status: TaskStatus = 'not_ready';
            let dependsOn: string[] = [];
            try {
              const statusContent = await fs.readFile(statusPath, 'utf-8');
              const statusData = JSON.parse(statusContent);
              status = statusData.status || 'not_ready';
              dependsOn = statusData.dependsOn || [];
            } catch {
              // No status file
            }

            concerns.push({
              name,
              path: `${projectPath}/features/${featureName}/concerns/${entry.name}`,
              status,
              hasChildren: false,
              dependsOn,
            });
          } catch {
            // task.md doesn't exist
          }
        }
      }
    } catch {
      // concerns directory doesn't exist
    }

    return concerns;
  }

  /**
   * Update a task's status by its path
   */
  async updateTaskStatusByPath(
    planId: string,
    taskPath: string,
    status: TaskStatus,
  ): Promise<TaskStatusFile> {
    const fullTaskPath = path.join(this.backlogDir, planId, 'tasks', taskPath);
    const statusFilePath = path.join(fullTaskPath, 'status.json');

    const statusData: TaskStatusFile = {
      status,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(statusFilePath, JSON.stringify(statusData, null, 2));
    this.logger.log(`Updated task ${taskPath} status to ${status}`);

    return statusData;
  }

  /**
   * Reset project decomposition (delete all features under a project)
   */
  async resetProjectDecomposition(planId: string, projectPath: string): Promise<ResetResult> {
    const featuresDir = path.join(this.backlogDir, planId, 'tasks', projectPath, 'features');

    let deletedCount = 0;

    try {
      const entries = await fs.readdir(featuresDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await fs.rm(path.join(featuresDir, entry.name), { recursive: true });
          deletedCount++;
        }
      }
    } catch {
      // features directory doesn't exist
    }

    this.logger.log(`Reset project ${projectPath}: deleted ${deletedCount} features`);

    return { success: true, deletedCount };
  }

  /**
   * Reset feature decomposition (delete all concerns under a feature)
   */
  async resetFeatureDecomposition(
    planId: string,
    projectPath: string,
    featureName: string,
  ): Promise<ResetResult> {
    const concernsDir = path.join(
      this.backlogDir,
      planId,
      'tasks',
      projectPath,
      'features',
      featureName,
      'concerns',
    );

    let deletedCount = 0;

    try {
      const entries = await fs.readdir(concernsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await fs.rm(path.join(concernsDir, entry.name), { recursive: true });
          deletedCount++;
        }
      }
    } catch {
      // concerns directory doesn't exist
    }

    this.logger.log(`Reset feature ${featureName}: deleted ${deletedCount} concerns`);

    return { success: true, deletedCount };
  }
}
