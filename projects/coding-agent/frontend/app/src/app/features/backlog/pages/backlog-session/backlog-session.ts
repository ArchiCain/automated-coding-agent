import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval } from 'rxjs';
import { MarkdownComponent } from 'ngx-markdown';
import { BacklogService } from '../../services/backlog.service';
import {
  Agent,
  AgentDocument,
  AGENT_TYPES,
} from '../../../claude-code-agent/models/agent.model';
import { AgentCardComponent } from '../../../claude-code-agent/components/agent-card/agent-card';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { DecompositionService } from '../../../decomposition/services/decomposition.service';
import { SlideOverComponent } from '../../../ui-components';

interface TaskNode {
  name: string;
  slug: string;
  path: string;
  hasChildren: boolean;
  childCount: number;
  status?: string;
  depth: number;
  dependsOn?: string[];
  tier?: number;
}

interface TierGroup {
  tier: number;
  tasks: TaskNode[];
}

interface BreadcrumbItem {
  id: string;
  name: string;
  level: 'backlog' | 'plan' | 'project' | 'feature';
  path?: string;
}

type ActiveAgentType = 'execution' | 'review';

@Component({
  selector: 'app-backlog-session',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MarkdownComponent,
    AgentCardComponent,
    SlideOverComponent,
  ],
  templateUrl: './backlog-session.html',
  styleUrl: './backlog-session.scss',
})
export class BacklogSessionComponent implements OnInit, OnDestroy {
  @ViewChild('agentCard') agentCard!: AgentCardComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
  private agentService = inject(ClaudeCodeAgentService);
  private decompositionService = inject(DecompositionService);

  private subscriptions: Subscription[] = [];

  // Route params
  planId = signal<string>('');
  projectSlug = signal<string>('');
  featureSlug = signal<string>('');

  planName = signal<string>('');
  projectName = signal<string>('');
  featureName = signal<string>('');

  // Current level being viewed
  currentLevel = signal<'projects' | 'features' | 'concerns'>('projects');

  // Session data
  loading = signal(true);
  error = signal<string | null>(null);

  // Source content (task.md of current level)
  sourceContent = signal<string>('');
  sourceLoading = signal(true);
  sourceName = signal<string>('');

  // Tasks list (children)
  tasks = signal<TaskNode[]>([]);
  tasksLoading = signal(false);

  // Computed tier grouping for concerns
  taskTiers = computed<TierGroup[]>(() => {
    const tasks = this.tasks();
    if (this.currentLevel() !== 'concerns' || tasks.length === 0) return [];
    const tierMap = new Map<number, TaskNode[]>();
    for (const task of tasks) {
      const tier = task.tier ?? 0;
      if (!tierMap.has(tier)) tierMap.set(tier, []);
      tierMap.get(tier)!.push(task);
    }
    return Array.from(tierMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([tier, tasks]) => ({ tier, tasks }));
  });

  // View mode: 'source' or 'tasks'
  viewMode = signal<'source' | 'tasks'>('source');

  // File slide-over state
  viewingDocument = signal<AgentDocument | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  // Agent panel state
  agentPanelOpen = signal(false);
  activeAgentType = signal<ActiveAgentType | null>(null);
  activeAgent = signal<Agent | null>(null);
  activeTaskForAgent = signal<TaskNode | null>(null);
  agentStarted = signal(false);

  // Breadcrumb for navigation hierarchy
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  ngOnInit(): void {
    // Subscribe to route param changes
    const paramSub = this.route.paramMap.subscribe((params) => {
      this.planId.set(params.get('planId') || '');
      this.projectSlug.set(params.get('projectSlug') || '');
      this.featureSlug.set(params.get('featureSlug') || '');

      if (!this.planId()) {
        this.router.navigate(['/backlog']);
        return;
      }

      this.determineLevel();
      this.resetState();
      this.loadSession();
    });
    this.subscriptions.push(paramSub);

    this.startPolling();
  }

  private determineLevel(): void {
    if (this.featureSlug()) {
      this.currentLevel.set('concerns');
    } else if (this.projectSlug()) {
      this.currentLevel.set('features');
    } else {
      this.currentLevel.set('projects');
    }
  }

  private resetState(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sourceContent.set('');
    this.sourceLoading.set(true);
    this.tasks.set([]);
    this.viewMode.set('source');
    this.projectName.set('');
    this.featureName.set('');
    this.closeAgentPanel();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadSession(): void {
    this.loading.set(true);
    this.loadPlanName();
    this.loadParentNames();
    this.buildBreadcrumbs();
    this.loadSourceContent();
    this.loadTasks();
    this.loading.set(false);
  }

  private loadPlanName(): void {
    this.decompositionService.getPlanInfo(this.planId()).subscribe({
      next: (plan) => {
        this.planName.set(plan.name);
        this.buildBreadcrumbs(); // rebuild with real name
      },
      error: () => {
        this.planName.set(this.formatName(this.planId()));
      },
    });
  }

  private loadParentNames(): void {
    const level = this.currentLevel();
    const planId = this.planId();

    // At features or concerns level, we need the project name
    if ((level === 'features' || level === 'concerns') && this.projectSlug()) {
      this.backlogService.getProjectTasks(planId).subscribe({
        next: (response) => {
          const project = response.projects.find((p) => p.path === this.projectSlug());
          if (project) {
            this.projectName.set(project.name);
            this.buildBreadcrumbs();
          }
        },
      });
    }

    // At concerns level, we also need the feature name
    if (level === 'concerns' && this.projectSlug() && this.featureSlug()) {
      this.backlogService.getFeatureTasks(planId, this.projectSlug()).subscribe({
        next: (response) => {
          const feature = response.features.find((f) => {
            const slug = f.path.split('/').pop();
            return slug === this.featureSlug();
          });
          if (feature) {
            this.featureName.set(feature.name);
            this.buildBreadcrumbs();
          }
        },
      });
    }
  }

  private getCurrentTaskPath(): string {
    const level = this.currentLevel();
    const planId = this.planId();

    if (level === 'concerns' && this.featureSlug()) {
      return `.coding-agent-data/backlog/${planId}/tasks/${this.projectSlug()}/features/${this.featureSlug()}/plan.md`;
    } else if (level === 'features' && this.projectSlug()) {
      return `.coding-agent-data/backlog/${planId}/tasks/${this.projectSlug()}/plan.md`;
    } else {
      return `.coding-agent-data/backlog/${planId}/plan.md`;
    }
  }

  private buildBreadcrumbs(): void {
    const crumbs: BreadcrumbItem[] = [];
    const level = this.currentLevel();

    // Always start with Backlog
    crumbs.push({
      id: 'backlog',
      name: 'Backlog',
      level: 'backlog',
    });

    // Plan name → navigates to environment
    crumbs.push({
      id: this.planId(),
      name: this.planName() || this.formatName(this.planId()),
      level: 'plan',
      path: this.planId(),
    });

    if (level === 'projects') {
      // Projects is the current (last) crumb
      crumbs.push({
        id: 'projects',
        name: 'Projects',
        level: 'project',
      });
    } else if (level === 'features') {
      // Projects is clickable, project name is current
      crumbs.push({
        id: 'projects',
        name: 'Projects',
        level: 'project',
      });
      crumbs.push({
        id: this.projectSlug(),
        name: this.projectName() || this.formatName(this.projectSlug()),
        level: 'feature', // last crumb, non-clickable
      });
    } else if (level === 'concerns') {
      // Projects + project name clickable, feature name is current
      crumbs.push({
        id: 'projects',
        name: 'Projects',
        level: 'project',
      });
      crumbs.push({
        id: this.projectSlug(),
        name: this.projectName() || this.formatName(this.projectSlug()),
        level: 'feature',
        path: `${this.planId()}/${this.projectSlug()}`,
      });
      crumbs.push({
        id: this.featureSlug(),
        name: this.featureName() || this.formatName(this.featureSlug()),
        level: 'feature', // last crumb, non-clickable
      });
    }

    this.breadcrumbs.set(crumbs);
  }

  private formatName(slug: string): string {
    // Remove plan prefix if present
    const cleanSlug = slug.replace(/^p-[a-f0-9]+$/, 'Plan');
    return cleanSlug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private loadSourceContent(): void {
    const taskPath = this.getCurrentTaskPath();
    this.sourceName.set(taskPath.split('/').pop() || 'task.md');

    this.sourceLoading.set(true);
    this.agentService.readDocument(taskPath).subscribe({
      next: (response) => {
        this.sourceContent.set(response.content);
        this.sourceLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load source:', err);
        this.sourceContent.set('*Error loading source content*');
        this.sourceLoading.set(false);
      },
    });
  }

  private loadTasks(): void {
    this.tasksLoading.set(true);
    const level = this.currentLevel();
    const planId = this.planId();

    if (level === 'projects') {
      this.backlogService.getProjectTasks(planId).subscribe({
        next: (response) => {
          this.tasks.set(
            response.projects.map((p) => ({
              name: p.name,
              slug: p.path,
              path: `.coding-agent-data/backlog/${planId}/tasks/${p.path}`,
              hasChildren: p.hasChildren,
              childCount: p.featuresCount || 0,
              status: p.status,
              depth: 0,
            }))
          );
          this.tasksLoading.set(false);
          if (response.projects.length > 0) {
            this.viewMode.set('tasks');
          }
        },
        error: (err) => {
          console.error('Failed to load projects:', err);
          this.tasksLoading.set(false);
        },
      });
    } else if (level === 'features') {
      this.backlogService.getFeatureTasks(planId, this.projectSlug()).subscribe({
        next: (response) => {
          this.tasks.set(
            response.features.map((f) => ({
              name: f.name,
              slug: f.path,
              path: `.coding-agent-data/backlog/${planId}/tasks/${f.path}`,
              hasChildren: f.hasChildren,
              childCount: f.concernsCount || 0,
              status: f.status,
              depth: 0,
            }))
          );
          this.tasksLoading.set(false);
          if (response.features.length > 0) {
            this.viewMode.set('tasks');
          }
        },
        error: (err) => {
          console.error('Failed to load features:', err);
          this.tasksLoading.set(false);
        },
      });
    } else if (level === 'concerns') {
      this.backlogService
        .getConcernTasks(planId, this.projectSlug(), this.featureSlug())
        .subscribe({
          next: (response) => {
            const mapped = response.concerns.map((c) => ({
              name: c.name,
              slug: c.path,
              path: `.coding-agent-data/backlog/${planId}/tasks/${c.path}`,
              hasChildren: false,
              childCount: 0,
              status: c.status,
              depth: 0,
              dependsOn: c.dependsOn || [],
            }));
            this.tasks.set(this.sortByDependencyTier(mapped));
            this.tasksLoading.set(false);
            if (response.concerns.length > 0) {
              this.viewMode.set('tasks');
            }
          },
          error: (err) => {
            console.error('Failed to load concerns:', err);
            this.tasksLoading.set(false);
          },
        });
    }
  }

  private sortByDependencyTier(tasks: TaskNode[]): TaskNode[] {
    const slugMap = new Map<string, TaskNode>();
    for (const t of tasks) {
      const slug = t.path.split('/').pop() || t.slug;
      slugMap.set(slug, t);
    }

    const tierCache = new Map<string, number>();
    const getTier = (task: TaskNode, visited: Set<string>): number => {
      const slug = task.path.split('/').pop() || task.slug;
      if (tierCache.has(slug)) return tierCache.get(slug)!;
      if (visited.has(slug)) return 0; // cycle guard
      visited.add(slug);
      if (!task.dependsOn?.length) {
        tierCache.set(slug, 0);
        return 0;
      }
      const maxDepTier = Math.max(
        ...task.dependsOn.map(dep => {
          const depTask = slugMap.get(dep);
          return depTask ? getTier(depTask, visited) : 0;
        })
      );
      const tier = maxDepTier + 1;
      tierCache.set(slug, tier);
      return tier;
    };

    for (const t of tasks) {
      getTier(t, new Set());
    }

    // Assign tier to each task
    for (const t of tasks) {
      const slug = t.path.split('/').pop() || t.slug;
      t.tier = tierCache.get(slug) || 0;
    }

    return [...tasks].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0));
  }

  private startPolling(): void {
    const pollSub = interval(5000).subscribe(() => {
      if (!this.loading()) {
        this.loadTasks();
      }
    });
    this.subscriptions.push(pollSub);
  }

  // Navigation
  goToBacklog(): void {
    this.router.navigate(['/backlog']);
  }

  navigateToCrumb(crumb: BreadcrumbItem): void {
    if (crumb.level === 'backlog') {
      this.router.navigate(['/backlog']);
    } else if (crumb.level === 'plan') {
      this.router.navigate(['/backlog/plan', this.planId(), 'environment']);
    } else if (crumb.level === 'project') {
      // Go to the projects list
      this.router.navigate(['/backlog/plan', this.planId(), 'projects']);
    } else if (crumb.level === 'feature' && crumb.path) {
      // Go to the features list of the project
      const parts = crumb.path.split('/');
      this.router.navigate([
        '/backlog/plan',
        parts[0],
        'project',
        parts[1],
        'features',
      ]);
    }
    // Last crumb is current level, no navigation needed
  }

  goBack(): void {
    const level = this.currentLevel();
    if (level === 'concerns') {
      this.router.navigate([
        '/backlog/plan',
        this.planId(),
        'project',
        this.projectSlug(),
        'features',
      ]);
    } else if (level === 'features') {
      this.router.navigate(['/backlog/plan', this.planId(), 'projects']);
    } else {
      this.router.navigate(['/backlog']);
    }
  }

  // View mode
  setViewMode(mode: 'source' | 'tasks'): void {
    this.viewMode.set(mode);
  }

  // Task actions
  viewTask(task: TaskNode): void {
    const level = this.currentLevel();
    if (level === 'projects') {
      this.router.navigate([
        '/backlog/plan',
        this.planId(),
        'project',
        task.slug,
        'features',
      ]);
    } else if (level === 'features') {
      const featureSlug = task.slug.split('/').pop() || task.slug;
      this.router.navigate([
        '/backlog/plan',
        this.planId(),
        'project',
        this.projectSlug(),
        'feature',
        featureSlug,
        'concerns',
      ]);
    }
  }

  // Agent panel methods
  openExecutionAgent(task: TaskNode): void {
    this.activeTaskForAgent.set(task);
    this.activeAgentType.set('execution');
    this.agentStarted.set(false);

    const agentType = AGENT_TYPES['execution'];
    const taskMdPath = `${task.path}/task.md`;

    const agent: Agent = {
      id: `exec-${Date.now()}`,
      name: 'Execution Agent',
      description: 'Implements tasks from the backlog',
      icon: agentType.icon,
      type: agentType,
      status: 'idle',
      documents: [],
      config: {
        cwd: '.',
        model: 'claude-opus-4-5-20251101',
        contextFiles: [taskMdPath],
        attachments: [],
      },
    };

    this.activeAgent.set(agent);
    this.agentPanelOpen.set(true);
  }

  openReviewAgent(task: TaskNode): void {
    this.activeTaskForAgent.set(task);
    this.activeAgentType.set('review');
    this.agentStarted.set(false);

    const agentType = AGENT_TYPES['review'];
    const taskMdPath = `${task.path}/task.md`;

    const agent: Agent = {
      id: `review-${Date.now()}`,
      name: 'Review Agent',
      description: 'Reviews completed task implementations',
      icon: agentType.icon,
      type: agentType,
      status: 'idle',
      documents: [],
      config: {
        cwd: '.',
        model: 'claude-opus-4-5-20251101',
        contextFiles: [taskMdPath],
        attachments: [],
      },
    };

    this.activeAgent.set(agent);
    this.agentPanelOpen.set(true);
  }

  closeAgentPanel(): void {
    this.agentPanelOpen.set(false);
    this.activeAgent.set(null);
    this.activeAgentType.set(null);
    this.activeTaskForAgent.set(null);
    this.agentStarted.set(false);
  }

  isExecutionEnabled(task: TaskNode): boolean {
    if (!task.dependsOn?.length) return true;
    const allTasks = this.tasks();
    return task.dependsOn.every(depSlug => {
      const dep = allTasks.find(t => t.path.split('/').pop() === depSlug);
      return dep && (dep.status === 'completed' || dep.status === 'review_passed');
    });
  }

  getBlockingDeps(task: TaskNode): string[] {
    if (!task.dependsOn?.length) return [];
    const allTasks = this.tasks();
    return task.dependsOn.filter(depSlug => {
      const dep = allTasks.find(t => t.path.split('/').pop() === depSlug);
      return !dep || (dep.status !== 'completed' && dep.status !== 'review_passed');
    });
  }

  isReviewerEnabled(task: TaskNode): boolean {
    return task.status === 'completed' || task.status === 'review_passed' || task.status === 'review_failed';
  }

  openTaskFile(task: TaskNode): void {
    const isConcern = this.currentLevel() === 'concerns';
    const fileName = isConcern ? 'task.md' : 'plan.md';
    const filePath = `${task.path}/${fileName}`;
    this.viewingDocument.set({
      id: `task-${task.slug}`,
      name: `${task.name} (${fileName})`,
      path: filePath,
      type: 'context',
    });
    this.documentLoading.set(true);
    this.documentContent.set('');

    this.agentService.readDocument(filePath).subscribe({
      next: (response) => {
        this.documentContent.set(response.content);
        this.documentLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load task:', err);
        this.documentContent.set('Error loading task');
        this.documentLoading.set(false);
      },
    });
  }

  closeDocumentView(): void {
    this.viewingDocument.set(null);
    this.documentContent.set('');
  }

  // Agent card events
  onAgentChange(updatedAgent: Agent): void {
    this.activeAgent.set(updatedAgent);
  }

  onSessionStarted(agentSessionId: string): void {
    this.agentStarted.set(true);
    console.log('Agent session started:', agentSessionId);
  }

  onViewDocument(doc: AgentDocument): void {
    this.viewingDocument.set(doc);
    this.documentLoading.set(true);
    this.documentContent.set('');

    this.agentService.readDocument(doc.path).subscribe({
      next: (response) => {
        if (response.isImage) {
          this.documentContent.set(
            `data:${response.mimeType};base64,${response.content}`
          );
        } else {
          this.documentContent.set(response.content);
        }
        this.documentLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load document:', err);
        this.documentContent.set('Error loading document');
        this.documentLoading.set(false);
      },
    });
  }

  // Check if this is the leaf level (concerns)
  isLeafLevel(): boolean {
    return this.currentLevel() === 'concerns';
  }

  // Get current level display name
  get levelName(): string {
    const names = {
      projects: 'Projects',
      features: 'Features',
      concerns: 'Concerns',
    };
    return names[this.currentLevel()];
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}
