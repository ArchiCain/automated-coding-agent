import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  DecompositionService,
  TaskInfo,
} from '../../services/decomposition.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-feature-to-concerns',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './feature-to-concerns.html',
  styleUrl: './feature-to-concerns.scss',
})
export class FeatureToConcernsComponent implements OnInit {
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);
  private router = inject(Router);

  // Tasks list
  tasks = signal<TaskInfo[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Track which task is being opened (for loading state)
  openingTaskId = signal<string | null>(null);

  // Slide-over state for viewing task files
  viewingTask = signal<TaskInfo | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);

    this.decompositionService.listFeatureTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to load feature tasks:', err);
        this.error.set('Failed to load feature tasks');
        this.loading.set(false);
      },
    });
  }

  openTask(task: TaskInfo): void {
    if (this.openingTaskId()) return;

    this.openingTaskId.set(task.id);

    this.decompositionService.createTaskSession(task.id, 'feature-to-concerns').subscribe({
      next: (session) => {
        this.openingTaskId.set(null);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err: Error) => {
        console.error('Failed to create session:', err);
        this.openingTaskId.set(null);
        this.error.set('Failed to start decomposition');
      },
    });
  }

  viewTaskFile(task: TaskInfo): void {
    this.viewingTask.set(task);
    this.documentLoading.set(true);
    this.documentContent.set('');

    this.agentService.readDocument(task.path).subscribe({
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
    this.viewingTask.set(null);
    this.documentContent.set('');
  }

  isTaskReady(task: TaskInfo): boolean {
    if (task.hasBeenDecomposed) {
      return false;
    }
    return task.status === 'ready';
  }

  toggleTaskReady(task: TaskInfo, ready: boolean): void {
    this.decompositionService.updateTaskReady(task.planId, task.slug, ready).subscribe({
      next: () => {
        const tasks = this.tasks();
        const index = tasks.findIndex(t => t.id === task.id);
        if (index >= 0) {
          tasks[index] = { ...tasks[index], status: ready ? 'ready' : 'pending' };
          this.tasks.set([...tasks]);
        }
      },
      error: (err) => {
        console.error('Failed to update task ready status:', err);
      },
    });
  }

  trackByTaskId(_: number, task: TaskInfo): string {
    return task.id;
  }
}
