import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BacklogService } from '../../services/backlog.service';
import { ProjectTask } from '../../models/plan.model';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-backlog-project-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    SlideOverComponent,
  ],
  templateUrl: './project-list.html',
  styleUrl: './project-list.scss',
})
export class BacklogProjectListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
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

  ngOnInit(): void {
    this.planId.set(this.route.snapshot.paramMap.get('planId') || '');
    if (!this.planId()) {
      this.router.navigate(['/backlog']);
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
    this.router.navigate(['/backlog']);
  }

  executeProject(project: ProjectTask): void {
    if (this.openingProjectId() || project.hasChildren) return;

    this.openingProjectId.set(project.path);

    // Create an execution session for this project
    this.backlogService.createExecutionSession(this.planId(), project.path).subscribe({
      next: (session) => {
        this.openingProjectId.set(null);
        this.router.navigate(['/backlog', session.meta.sessionId]);
      },
      error: (err: Error) => {
        console.error('Failed to create execution session:', err);
        this.openingProjectId.set(null);
        this.error.set('Failed to start execution');
      },
    });
  }

  viewTasks(project: ProjectTask): void {
    // Navigate to the feature listing for this project
    this.router.navigate(['/backlog/plan', this.planId(), 'project', project.path, 'features']);
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

  trackByPath(_: number, project: ProjectTask): string {
    return project.path;
  }
}
