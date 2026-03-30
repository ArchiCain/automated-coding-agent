import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskService } from '../../services/task.service';
import { TaskExecution } from '../../models/task.model';

@Component({
  selector: 'app-task-dock',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './task-dock.component.html',
  styleUrl: './task-dock.component.scss',
})
export class TaskDockComponent {
  private taskService = inject(TaskService);

  @ViewChild('outputContainer') outputContainer?: ElementRef<HTMLPreElement>;

  // State
  executions = this.taskService.executions;
  expandedId = this.taskService.expandedId;
  expandedExecution = this.taskService.expandedExecution;
  hasDock = this.taskService.hasDock;

  // User scroll tracking - true means user manually scrolled away from bottom
  userScrolledUp = signal(false);

  // Track output length for reliable change detection
  private lastTrackedOutputLength = 0;

  // Computed
  runningCount = this.taskService.runningCount;
  completed = this.taskService.completed;

  // Computed signal that tracks output length
  outputLength = computed(() => {
    const execution = this.expandedExecution();
    return execution?.output?.length ?? 0;
  });

  statusIcon = computed(() => {
    const execution = this.expandedExecution();
    if (!execution) return 'hourglass_empty';

    switch (execution.status) {
      case 'running':
      case 'pending':
        return 'spinner';
      case 'completed':
        return 'check_circle';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'cancel';
      default:
        return 'hourglass_empty';
    }
  });

  statusClass = computed(() => {
    const execution = this.expandedExecution();
    if (!execution) return '';

    switch (execution.status) {
      case 'running':
      case 'pending':
        return 'status-running';
      case 'completed':
        return 'status-completed';
      case 'failed':
        return 'status-failed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  });

  constructor() {
    // Auto-scroll when new output arrives (unless user scrolled up)
    effect(() => {
      const currentLength = this.outputLength();
      const execution = this.expandedExecution();

      // Reset tracking when switching executions
      if (!execution) {
        this.lastTrackedOutputLength = 0;
        this.userScrolledUp.set(false);
        return;
      }

      // Check if there's new output
      if (currentLength > this.lastTrackedOutputLength) {
        this.lastTrackedOutputLength = currentLength;

        // Only auto-scroll if user hasn't manually scrolled up
        if (!this.userScrolledUp()) {
          // Use requestAnimationFrame to ensure DOM has rendered the new content
          requestAnimationFrame(() => {
            this.scrollToBottom();
          });
        }
      }
    });

    // Reset scroll tracking when expanded execution changes
    effect(() => {
      const id = this.expandedId();
      if (id) {
        // New execution expanded - reset scroll state and scroll to bottom
        this.userScrolledUp.set(false);
        this.lastTrackedOutputLength = 0;
        requestAnimationFrame(() => {
          this.scrollToBottom();
        });
      }
    });
  }

  toggle(execution: TaskExecution): void {
    this.taskService.toggle(execution.id);
    this.userScrolledUp.set(false);
  }

  expand(execution: TaskExecution): void {
    this.taskService.expand(execution.id);
    this.userScrolledUp.set(false);
  }

  collapse(): void {
    this.taskService.collapse();
  }

  async stop(execution: TaskExecution, event: Event): Promise<void> {
    event.stopPropagation();
    await this.taskService.stop(execution.id);
  }

  async kill(execution: TaskExecution, event: Event): Promise<void> {
    event.stopPropagation();
    await this.taskService.kill(execution.id);
  }

  async dismiss(execution: TaskExecution, event: Event): Promise<void> {
    event.stopPropagation();
    await this.taskService.dismiss(execution.id);
  }

  /**
   * Close/dismiss an execution - stops it first if running
   */
  async dismissOrStop(execution: TaskExecution, event: Event): Promise<void> {
    event.stopPropagation();
    if (this.isRunning(execution)) {
      // Stop the task first, then dismiss
      await this.taskService.stop(execution.id);
      // Give a moment for the task to stop before dismissing
      setTimeout(async () => {
        await this.taskService.dismiss(execution.id);
      }, 500);
    } else {
      await this.taskService.dismiss(execution.id);
    }
  }

  async clearCompleted(): Promise<void> {
    await this.taskService.clearCompleted();
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const atBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    this.userScrolledUp.set(!atBottom);
  }

  scrollToBottom(): void {
    if (this.outputContainer) {
      const element = this.outputContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  resumeAutoScroll(): void {
    this.userScrolledUp.set(false);
    this.scrollToBottom();
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'running':
        return 'Running';
      case 'pending':
        return 'Pending';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  getRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin} min ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  formatOutput(output: string[]): string {
    return output.map(line => this.stripAnsiCodes(line)).join('\n');
  }

  /**
   * Strip ANSI escape codes from terminal output
   * These codes are used for colors/formatting in terminals but show as garbage in browsers
   */
  private stripAnsiCodes(text: string): string {
    // Match ANSI escape sequences in multiple formats:
    // 1. Full escape: ESC[ followed by parameters and a letter (e.g., \x1b[32m)
    // 2. Bare codes: [0m, [32m, [1;32m etc. without the escape character
    // eslint-disable-next-line no-control-regex
    return text
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')   // Full ANSI sequences with ESC
      .replace(/\[([0-9;]+)?m/g, '');           // Bare color codes: [0m, [32m, [1;32m, etc.
  }

  isRunning(execution: TaskExecution): boolean {
    return execution.status === 'running' || execution.status === 'pending';
  }

  isComplete(execution: TaskExecution): boolean {
    return execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled';
  }
}
