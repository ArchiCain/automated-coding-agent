import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TaskService, TaskDefinition } from '../../../tasks';

/**
 * Task bar component for running any available task.
 */
@Component({
  selector: 'app-task-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './task-bar.component.html',
  styleUrl: './task-bar.component.scss',
})
export class TaskBarComponent {
  private taskService = inject(TaskService);

  // All available tasks
  tasks = this.taskService.tasks;

  // Input state
  taskInput = signal('');
  argsInput = signal('');
  selectedTask = signal<TaskDefinition | null>(null);

  // Filtered tasks based on input
  filteredTasks = computed(() => {
    const query = this.taskInput().toLowerCase();
    if (!query) return this.tasks().slice(0, 20); // Show first 20 when empty

    return this.tasks().filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.desc?.toLowerCase().includes(query)
    );
  });

  // Is the selected task currently running?
  isRunning = computed(() => {
    const task = this.selectedTask();
    return task ? this.taskService.isRunning(task.name) : false;
  });

  onTaskInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.taskInput.set(value);
    // Clear selection when typing
    this.selectedTask.set(null);
  }

  onTaskSelected(task: TaskDefinition): void {
    this.taskInput.set(task.name);
    this.selectedTask.set(task);
  }

  displayFn(task: TaskDefinition): string {
    return task?.name || '';
  }

  async runTask(): Promise<void> {
    // Use selected task name, or typed input as task name
    const taskName = this.selectedTask()?.name || this.taskInput().trim();
    if (!taskName) return;

    const argsStr = this.argsInput().trim();
    const args = argsStr ? argsStr.split(' ') : undefined;

    await this.taskService.run(taskName, args);
  }

  clearInput(): void {
    this.taskInput.set('');
    this.argsInput.set('');
    this.selectedTask.set(null);
  }
}
