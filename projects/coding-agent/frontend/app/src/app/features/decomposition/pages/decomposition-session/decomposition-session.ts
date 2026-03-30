import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
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
import {
  DecompositionService,
  DecompositionSession,
  TaskNode,
} from '../../services/decomposition.service';
import { Agent, AgentDocument } from '../../../claude-code-agent/models/agent.model';
import { AgentCardComponent } from '../../../claude-code-agent/components/agent-card/agent-card';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

interface BreadcrumbItem {
  id: string;
  name: string;
  decompType: string;
  taskId?: string;
}

@Component({
  selector: 'app-decomposition-session',
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
  templateUrl: './decomposition-session.html',
  styleUrl: './decomposition-session.scss',
})
export class DecompositionSessionComponent implements OnInit, OnDestroy {
  @ViewChild('agentCard') agentCard!: AgentCardComponent;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);

  // Current plan ID for lock checking
  private currentPlanId = signal<string>('');

  private subscriptions: Subscription[] = [];
  private sessionId: string = '';

  // Session data
  session = signal<DecompositionSession | null>(null);
  agent = signal<Agent | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Source content (plan.md or task.md being decomposed)
  sourceContent = signal<string>('');
  sourceLoading = signal(true);

  // Tasks tree
  tasksTree = signal<TaskNode[]>([]);
  tasksLoading = signal(false);

  // View mode: 'source' or 'tasks'
  viewMode = signal<'source' | 'tasks'>('source');

  // File slide-over state
  viewingDocument = signal<AgentDocument | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  // Track if agent has been started
  agentStarted = signal(false);

  // Breadcrumb for navigation hierarchy
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  ngOnInit(): void {
    // Subscribe to route param changes to handle navigation between sessions
    const paramSub = this.route.paramMap.subscribe((params) => {
      const newSessionId = params.get('sessionId') || '';
      if (!newSessionId) {
        this.router.navigate(['/decomposition']);
        return;
      }

      // Only reload if session ID changed
      if (newSessionId !== this.sessionId) {
        this.sessionId = newSessionId;
        this.resetState();
        this.loadSession();
      }
    });
    this.subscriptions.push(paramSub);

    this.startPolling();
  }

  private resetState(): void {
    this.session.set(null);
    this.agent.set(null);
    this.loading.set(true);
    this.error.set(null);
    this.sourceContent.set('');
    this.sourceLoading.set(true);
    this.tasksTree.set([]);
    this.viewMode.set('source');
    this.agentStarted.set(false);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private loadSession(): void {
    this.loading.set(true);
    this.decompositionService.getSession(this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.currentPlanId.set(session.meta.planId);
        this.agent.set(this.decompositionService.sessionToAgent(session));
        this.buildBreadcrumbs(session);
        this.loading.set(false);
        this.loadSourceContent();
        this.loadTasksTree();
      },
      error: (err) => {
        console.error('Failed to load session:', err);
        this.error.set('Failed to load session');
        this.loading.set(false);
      },
    });
  }

  private buildBreadcrumbs(session: DecompositionSession): void {
    const { planId, planName, parentId, decompType } = session.meta;

    // Helper to format slug as title
    const formatName = (slug: string): string => {
      return slug
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    if (decompType === 'plan-to-projects') {
      // At plan level - just show plan name
      this.breadcrumbs.set([{
        id: planId,
        name: planName,
        decompType: 'plan-to-projects',
      }]);
    } else {
      // For sub-levels, fetch the plan info to get the actual plan name
      this.decompositionService.getPlanInfo(planId).subscribe({
        next: (planInfo) => {
          const crumbs: BreadcrumbItem[] = [];
          const rootPlanName = planInfo?.name || formatName(planId.replace('p-', 'Plan '));

          if (decompType === 'project-to-features') {
            // At project level - show plan > project
            crumbs.push({
              id: planId,
              name: rootPlanName,
              decompType: 'plan-to-projects',
            });
            crumbs.push({
              id: parentId,
              name: planName, // planName is the project name for task sessions
              decompType: 'project-to-features',
              taskId: parentId,
            });
          } else if (decompType === 'feature-to-concerns') {
            // At feature level - show plan > project > feature
            // parentId is like "p-3be341/backend/features/calculator"
            const parts = parentId.split('/');
            const projectSlug = parts[1] || '';

            crumbs.push({
              id: planId,
              name: rootPlanName,
              decompType: 'plan-to-projects',
            });
            crumbs.push({
              id: `${planId}/${projectSlug}`,
              name: formatName(projectSlug),
              decompType: 'project-to-features',
              taskId: `${planId}/${projectSlug}`,
            });
            crumbs.push({
              id: parentId,
              name: planName, // planName is the feature name for task sessions
              decompType: 'feature-to-concerns',
              taskId: parentId,
            });
          }

          this.breadcrumbs.set(crumbs);
        },
        error: () => {
          // Fallback to formatted planId if fetch fails
          this.buildBreadcrumbsFallback(session, formatName);
        },
      });
    }
  }

  private buildBreadcrumbsFallback(session: DecompositionSession, formatName: (s: string) => string): void {
    const crumbs: BreadcrumbItem[] = [];
    const { planId, planName, parentId, decompType } = session.meta;

    if (decompType === 'project-to-features') {
      crumbs.push({
        id: planId,
        name: formatName(planId.replace('p-', 'Plan ')),
        decompType: 'plan-to-projects',
      });
      crumbs.push({
        id: parentId,
        name: planName,
        decompType: 'project-to-features',
        taskId: parentId,
      });
    } else if (decompType === 'feature-to-concerns') {
      const parts = parentId.split('/');
      const projectSlug = parts[1] || '';

      crumbs.push({
        id: planId,
        name: formatName(planId.replace('p-', 'Plan ')),
        decompType: 'plan-to-projects',
      });
      crumbs.push({
        id: `${planId}/${projectSlug}`,
        name: formatName(projectSlug),
        decompType: 'project-to-features',
        taskId: `${planId}/${projectSlug}`,
      });
      crumbs.push({
        id: parentId,
        name: planName,
        decompType: 'feature-to-concerns',
        taskId: parentId,
      });
    }

    this.breadcrumbs.set(crumbs);
  }

  private loadSourceContent(): void {
    const session = this.session();
    if (!session) return;

    // The input file path is in the session meta
    const inputFile = session.meta.inputFile;
    if (!inputFile) {
      this.sourceContent.set('*No input file found*');
      this.sourceLoading.set(false);
      return;
    }

    this.agentService.readDocument(inputFile).subscribe({
      next: (response) => {
        this.sourceContent.set(response.content);
        this.sourceLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load source:', err);
        this.sourceContent.set('*Error loading source*');
        this.sourceLoading.set(false);
      },
    });
  }

  private loadTasksTree(): void {
    const session = this.session();
    if (!session) return;

    this.tasksLoading.set(true);
    // Load tasks from the outputBase directory (where child tasks are created)
    // This ensures we only show tasks relevant to this decomposition
    this.decompositionService.getTasksFromDirectory(session.meta.outputBase).subscribe({
      next: (tasks) => {
        this.tasksTree.set(tasks);
        this.tasksLoading.set(false);
        // Auto-switch to tasks view if tasks exist
        if (tasks.length > 0) {
          this.viewMode.set('tasks');
        }
      },
      error: (err) => {
        console.error('Failed to load tasks tree:', err);
        this.tasksLoading.set(false);
      },
    });
  }

  private startPolling(): void {
    // Poll for updates every 3 seconds
    const pollSub = interval(3000).subscribe(() => {
      this.loadTasksTree();
    });
    this.subscriptions.push(pollSub);
  }

  // Breadcrumb navigation
  goToBrainstorm(): void {
    this.router.navigate(['/brainstorm']);
  }

  navigateToCrumb(crumb: BreadcrumbItem): void {
    if (crumb.decompType === 'plan-to-projects') {
      // Navigate to plan-to-projects session
      this.decompositionService.createSession(crumb.id, 'plan-to-projects').subscribe({
        next: (session) => {
          this.router.navigate(['/decomposition', session.meta.sessionId]);
        },
        error: () => {
          this.router.navigate(['/brainstorm']);
        },
      });
    } else if (crumb.taskId) {
      // Navigate to task session
      this.decompositionService.createTaskSession(crumb.taskId, crumb.decompType).subscribe({
        next: (session) => {
          this.router.navigate(['/decomposition', session.meta.sessionId]);
        },
        error: () => {
          this.router.navigate(['/brainstorm']);
        },
      });
    }
  }

  // Navigation
  goBack(): void {
    const session = this.session();
    if (!session) {
      this.router.navigate(['/brainstorm']);
      return;
    }

    const { decompType, planId, parentId } = session.meta;

    switch (decompType) {
      case 'plan-to-projects':
        // Go back to Brainstorming page
        this.router.navigate(['/brainstorm']);
        break;
      case 'project-to-features':
        // Go back to plan-to-projects session for this plan
        this.decompositionService.createSession(planId, 'plan-to-projects').subscribe({
          next: (parentSession) => {
            this.router.navigate(['/decomposition', parentSession.meta.sessionId]);
          },
          error: () => {
            // Fallback to brainstorm
            this.router.navigate(['/brainstorm']);
          },
        });
        break;
      case 'feature-to-concerns':
        // Go back to project-to-features session
        // parentId contains the full taskId (e.g., "p-3be341/backend/features/calculator")
        // Extract the project part (e.g., "backend") to create project taskId
        const parentParts = parentId.split('/');
        // Format: planId/projectSlug/features/featureSlug - we want planId/projectSlug
        const projectSlug = parentParts[1] || parentId;
        const projectTaskId = `${planId}/${projectSlug}`;
        this.decompositionService.createTaskSession(projectTaskId, 'project-to-features').subscribe({
          next: (parentSession) => {
            this.router.navigate(['/decomposition', parentSession.meta.sessionId]);
          },
          error: () => {
            // Fallback to brainstorm
            this.router.navigate(['/brainstorm']);
          },
        });
        break;
      default:
        this.router.navigate(['/brainstorm']);
    }
  }

  // Start decomposition
  startDecomposition(): void {
    if (!this.agentCard || this.agentStarted()) return;

    // Start the agent with a simple trigger message
    // The prompt files and context are already configured
    this.agentCard.startWithMessage('Begin decomposition');
    this.agentStarted.set(true);
  }

  // Check if we can show the start button
  // Hide if agent already started OR if tasks already exist OR if plan is locked by auto-decomp
  canStart(): boolean {
    if (this.agentStarted()) return false;
    if (this.tasksTree().length > 0) return false;
    return true;
  }

  isPlanLocked(): boolean {
    return false;
  }

  // View mode
  setViewMode(mode: 'source' | 'tasks'): void {
    this.viewMode.set(mode);
  }

  // Agent card events
  onAgentChange(updatedAgent: Agent): void {
    this.agent.set(updatedAgent);
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
          this.documentContent.set(`data:${response.mimeType};base64,${response.content}`);
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

  closeDocumentView(): void {
    this.viewingDocument.set(null);
    this.documentContent.set('');
  }

  // Task actions
  openTask(task: TaskNode): void {
    // Determine file name: concerns use task.md, projects/features use plan.md
    const hasChildren = task.children && task.children.length > 0;
    const fileName = hasChildren ? 'plan.md' : 'task.md';
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
      error: () => {
        // Try the other file type as fallback
        const fallbackFile = `${task.path}/${hasChildren ? 'task.md' : 'plan.md'}`;
        this.agentService.readDocument(fallbackFile).subscribe({
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
      },
    });
  }

  decomposeTask(task: TaskNode): void {
    const session = this.session();
    if (!session) return;

    // Determine the next decomposition type based on current type
    let nextDecompType: string;
    switch (session.meta.decompType) {
      case 'plan-to-projects':
        nextDecompType = 'project-to-features';
        break;
      case 'project-to-features':
        nextDecompType = 'feature-to-concerns';
        break;
      default:
        // Concerns are leaf nodes, no further decomposition
        return;
    }

    // Extract task path relative to .coding-agent-data/backlog/{planId}/tasks/
    // task.path is the full path, we need just the relative part
    const taskPathMatch = task.path.match(/\.backlog\/[^/]+\/tasks\/(.+)/);
    const taskRelativePath = taskPathMatch ? taskPathMatch[1] : task.slug;

    // Create task ID in the expected format: planId/taskPath (with slash separator)
    const taskId = `${session.meta.planId}/${taskRelativePath}`;

    // Create a new decomposition session for this task
    this.decompositionService.createTaskSession(taskId, nextDecompType).subscribe({
      next: (newSession) => {
        this.router.navigate(['/decomposition', newSession.meta.sessionId]);
      },
      error: (err) => {
        console.error('Failed to create decomposition session:', err);
        this.error.set('Failed to start decomposition for this task');
      },
    });
  }

  viewTaskChildren(task: TaskNode): void {
    const session = this.session();
    if (!session) return;

    // Determine the decomposition type for this task's level
    let taskDecompType: string;
    switch (session.meta.decompType) {
      case 'plan-to-projects':
        // This task is a project, its children are features
        taskDecompType = 'project-to-features';
        break;
      case 'project-to-features':
        // This task is a feature, its children are concerns
        taskDecompType = 'feature-to-concerns';
        break;
      default:
        // Concerns are leaf nodes, no children
        return;
    }

    // Extract task path relative to .coding-agent-data/backlog/{planId}/tasks/
    const taskPathMatch = task.path.match(/\.backlog\/[^/]+\/tasks\/(.+)/);
    const taskRelativePath = taskPathMatch ? taskPathMatch[1] : task.slug;

    // Create task ID in the expected format: planId/taskPath (with slash separator)
    const taskId = `${session.meta.planId}/${taskRelativePath}`;

    // Create or get a decomposition session for this task to view its children
    this.decompositionService.createTaskSession(taskId, taskDecompType).subscribe({
      next: (newSession) => {
        this.router.navigate(['/decomposition', newSession.meta.sessionId]);
      },
      error: (err) => {
        console.error('Failed to navigate to task children:', err);
        // Fallback: just switch to tasks view
        this.viewMode.set('tasks');
      },
    });
  }

  // Task tree helpers
  getTaskStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return 'check_circle';
      case 'in-progress':
        return 'pending';
      case 'blocked':
        return 'block';
      default:
        return 'radio_button_unchecked';
    }
  }

  getTaskStatusClass(status: string): string {
    return `status-${status}`;
  }

  get sessionName(): string {
    return this.session()?.meta.planName || 'Decomposition';
  }

  get decompTypeName(): string {
    const type = this.session()?.meta.decompType;
    const names: Record<string, string> = {
      'plan-to-projects': 'Plan to Projects',
      'project-to-features': 'Project to Features',
      'feature-to-concerns': 'Feature to Concerns',
    };
    return names[type || ''] || type || '';
  }

  // Check if this is a feature-to-concerns session (concerns are leaf nodes, no decomp)
  isConcernsSession(): boolean {
    return this.session()?.meta.decompType === 'feature-to-concerns';
  }

  getFileName(path: string): string {
    return path.split('/').pop() || path;
  }
}
