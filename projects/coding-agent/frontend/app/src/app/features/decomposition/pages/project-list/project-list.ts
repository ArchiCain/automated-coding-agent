import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BacklogService } from '../../../backlog/services/backlog.service';
import { ProjectTask, TaskStatus } from '../../../backlog/models/plan.model';
import { DecompositionService } from '../../services/decomposition.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class ProjectListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);

  // Route params
  planId = signal<string>('');

  // Projects list
  projects = signal<ProjectTask[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Track which project is being opened (for loading state)
  openingProjectId = signal<string | null>(null);

  // Slide-over state for viewing task files
  viewingProject = signal<ProjectTask | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  // Reset state
  resettingProjectId = signal<string | null>(null);

  ngOnInit(): void {
    this.planId.set(this.route.snapshot.paramMap.get('planId') || '');
    if (!this.planId()) {
      this.router.navigate(['/brainstorm']);
      return;
    }
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.error.set(null);

    this.backlogService.getProjectTasks(this.planId()).subscribe({
      next: (response) => {
        this.projects.set(response.projects);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to load projects:', err);
        this.error.set('Failed to load projects');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/brainstorm']);
  }

  decomposeProject(project: ProjectTask): void {
    if (this.openingProjectId()) return;

    this.openingProjectId.set(project.path);

    // Create a task session for project-to-features decomposition
    // The task ID format expected by the backend is: planId/projectPath
    const taskId = `${this.planId()}/${project.path}`;
    this.decompositionService.createTaskSession(taskId, 'project-to-features').subscribe({
      next: (session) => {
        this.openingProjectId.set(null);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err: Error) => {
        console.error('Failed to create session:', err);
        this.openingProjectId.set(null);
        this.error.set('Failed to start decomposition');
      },
    });
  }

  viewTasks(project: ProjectTask): void {
    // Navigate to the feature listing for this project
    this.router.navigate(['/decomposition/plan', this.planId(), 'project', project.path, 'features']);
  }

  viewTaskFile(project: ProjectTask): void {
    this.viewingProject.set(project);
    this.documentLoading.set(true);
    this.documentContent.set('');

    // Read the plan.md file for this project
    const taskPath = `.coding-agent-data/backlog/${this.planId()}/tasks/${project.path}/plan.md`;
    this.agentService.readDocument(taskPath).subscribe({
      next: (response) => {
        this.documentContent.set(response.content);
        this.documentLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load task file:', err);
        this.documentContent.set('Error loading task file');
        this.documentLoading.set(false);
      },
    });
  }

  closeDocumentView(): void {
    this.viewingProject.set(null);
    this.documentContent.set('');
  }

  isProjectReady(project: ProjectTask): boolean {
    if (project.hasChildren) {
      return false;
    }
    return project.status === 'ready';
  }

  toggleProjectReady(project: ProjectTask, ready: boolean): void {
    const status: TaskStatus = ready ? 'ready' : 'not_ready';
    this.backlogService.updateTaskStatus(this.planId(), project.path, status).subscribe({
      next: () => {
        const projects = this.projects();
        const index = projects.findIndex((p) => p.path === project.path);
        if (index >= 0) {
          projects[index] = { ...projects[index], status };
          this.projects.set([...projects]);
        }
      },
      error: (err) => {
        console.error('Failed to update project ready status:', err);
      },
    });
  }

  resetProject(project: ProjectTask): void {
    if (this.resettingProjectId()) return;

    // Confirm before resetting
    if (!confirm(`Reset "${project.name}"? This will delete all features and concerns under this project.`)) {
      return;
    }

    this.resettingProjectId.set(project.path);

    this.backlogService.resetProjectDecomposition(this.planId(), project.path).subscribe({
      next: () => {
        this.resettingProjectId.set(null);
        // Reload to get updated state
        this.loadProjects();
      },
      error: (err) => {
        console.error('Failed to reset project:', err);
        this.resettingProjectId.set(null);
        this.error.set('Failed to reset project');
      },
    });
  }

  trackByPath(_: number, project: ProjectTask): string {
    return project.path;
  }
}
