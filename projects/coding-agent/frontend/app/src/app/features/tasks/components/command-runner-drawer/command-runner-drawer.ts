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

export type FilterMode = 'all' | 'running' | 'completed';

@Component({
  selector: 'app-command-runner-drawer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './command-runner-drawer.html',
  styleUrl: './command-runner-drawer.scss',
})
export class CommandRunnerDrawerComponent {
  private taskService = inject(TaskService);

  @ViewChild('outputContainer') outputContainer?: ElementRef<HTMLPreElement>;

  // State
  executions = this.taskService.executions;
  hasDock = this.taskService.hasDock;
  runningCount = this.taskService.runningCount;
  completed = this.taskService.completed;

  // Drawer state
  filterMode = signal<FilterMode>('all');
  selectedId = signal<string | null>(null);
  maximized = signal(false);
  userScrolledUp = signal(false);
  private lastTrackedOutputLength = 0;

  // Filtered executions
  filteredExecutions = computed(() => {
    const mode = this.filterMode();
    const execs = this.executions();
    switch (mode) {
      case 'running':
        return execs.filter((e) => e.status === 'running' || e.status === 'pending');
      case 'completed':
        return execs.filter(
          (e) => e.status === 'completed' || e.status === 'failed' || e.status === 'cancelled',
        );
      default:
        return execs;
    }
  });

  // Selected execution
  selectedExecution = computed(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.executions().find((e) => e.id === id) || null;
  });

  // Output length for auto-scroll tracking
  outputLength = computed(() => {
    const execution = this.selectedExecution();
    return execution?.output?.length ?? 0;
  });

  statusIcon = computed(() => {
    const execution = this.selectedExecution();
    if (!execution) return 'hourglass_empty';
    return this.getStatusIcon(execution.status);
  });

  statusClass = computed(() => {
    const execution = this.selectedExecution();
    if (!execution) return '';
    return this.getStatusClass(execution.status);
  });

  constructor() {
    // Auto-scroll when new output arrives
    effect(() => {
      const currentLength = this.outputLength();
      const execution = this.selectedExecution();

      if (!execution) {
        this.lastTrackedOutputLength = 0;
        this.userScrolledUp.set(false);
        return;
      }

      if (currentLength > this.lastTrackedOutputLength) {
        this.lastTrackedOutputLength = currentLength;
        if (!this.userScrolledUp()) {
          requestAnimationFrame(() => this.scrollToBottom());
        }
      }
    });

    // Reset scroll tracking when selected execution changes
    effect(() => {
      const id = this.selectedId();
      if (id) {
        this.userScrolledUp.set(false);
        this.lastTrackedOutputLength = 0;
        requestAnimationFrame(() => this.scrollToBottom());
      }
    });
  }

  select(executionId: string): void {
    this.selectedId.set(executionId);
    this.userScrolledUp.set(false);
  }

  deselect(): void {
    this.selectedId.set(null);
  }

  setFilter(mode: FilterMode): void {
    this.filterMode.set(mode);
  }

  toggleMaximize(): void {
    this.maximized.update((v) => !v);
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
    if (this.isRunning(execution)) {
      await this.taskService.stop(execution.id);
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

  resumeAutoScroll(): void {
    this.userScrolledUp.set(false);
    this.scrollToBottom();
  }

  formatOutput(output: string[]): string {
    return output.map((line) => this.stripAnsiCodes(line)).join('\n');
  }

  getStatusIcon(status: string): string {
    switch (status) {
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
  }

  getStatusClass(status: string): string {
    switch (status) {
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

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return date.toLocaleDateString();
  }

  isRunning(execution: TaskExecution): boolean {
    return execution.status === 'running' || execution.status === 'pending';
  }

  isComplete(execution: TaskExecution): boolean {
    return (
      execution.status === 'completed' ||
      execution.status === 'failed' ||
      execution.status === 'cancelled'
    );
  }

  private scrollToBottom(): void {
    if (this.outputContainer) {
      const element = this.outputContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private stripAnsiCodes(text: string): string {
    return text
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\[([0-9;]+)?m/g, '');
  }
}
