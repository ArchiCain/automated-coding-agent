import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BacklogService } from '../../../backlog/services/backlog.service';
import { ConcernTask, TaskStatus } from '../../../backlog/models/plan.model';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-concern-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './concern-list.html',
  styleUrl: './concern-list.scss',
})
export class ConcernListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
  private agentService = inject(ClaudeCodeAgentService);

  // Route params
  planId = signal<string>('');
  projectSlug = signal<string>('');
  featureSlug = signal<string>('');

  // Concerns list
  concerns = signal<ConcernTask[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Slide-over state for viewing task files
  viewingConcern = signal<ConcernTask | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  ngOnInit(): void {
    this.planId.set(this.route.snapshot.paramMap.get('planId') || '');
    this.projectSlug.set(this.route.snapshot.paramMap.get('projectSlug') || '');
    this.featureSlug.set(this.route.snapshot.paramMap.get('featureSlug') || '');

    if (!this.planId() || !this.projectSlug() || !this.featureSlug()) {
      this.router.navigate(['/brainstorm']);
      return;
    }
    this.loadConcerns();
  }

  loadConcerns(): void {
    this.loading.set(true);
    this.error.set(null);

    this.backlogService.getConcernTasks(this.planId(), this.projectSlug(), this.featureSlug()).subscribe({
      next: (response) => {
        this.concerns.set(response.concerns);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to load concerns:', err);
        this.error.set('Failed to load concerns');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    // Go back to the feature listing for this project
    this.router.navigate(['/decomposition/plan', this.planId(), 'project', this.projectSlug(), 'features']);
  }

  viewTaskFile(concern: ConcernTask): void {
    this.viewingConcern.set(concern);
    this.documentLoading.set(true);
    this.documentContent.set('');

    // Read the task.md file for this concern
    const taskPath = `.coding-agent-data/backlog/${this.planId()}/tasks/${concern.path}/task.md`;
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
    this.viewingConcern.set(null);
    this.documentContent.set('');
  }

  isConcernReady(concern: ConcernTask): boolean {
    return concern.status === 'ready';
  }

  toggleConcernReady(concern: ConcernTask, ready: boolean): void {
    const status: TaskStatus = ready ? 'ready' : 'not_ready';
    this.backlogService.updateTaskStatus(this.planId(), concern.path, status).subscribe({
      next: () => {
        const concerns = this.concerns();
        const index = concerns.findIndex((c) => c.path === concern.path);
        if (index >= 0) {
          concerns[index] = { ...concerns[index], status };
          this.concerns.set([...concerns]);
        }
      },
      error: (err) => {
        console.error('Failed to update concern ready status:', err);
      },
    });
  }

  trackByPath(_: number, concern: ConcernTask): string {
    return concern.path;
  }
}
