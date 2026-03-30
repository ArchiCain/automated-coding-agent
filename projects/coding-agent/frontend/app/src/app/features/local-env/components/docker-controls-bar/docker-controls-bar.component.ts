import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskService } from '../../../tasks';

/**
 * Reusable Docker controls bar component.
 * Provides buttons for common Docker operations that run as tasks.
 *
 * @example
 * <!-- Basic usage for local environment -->
 * <app-docker-controls-bar
 *   [envId]="'local'"
 *   (onOperationComplete)="refreshStatus()"
 * />
 *
 * @example
 * <!-- With custom task prefix for worktree -->
 * <app-docker-controls-bar
 *   [envId]="planId"
 *   [taskPrefix]="'env:' + planId"
 *   [showTearDown]="true"
 *   (onTearDown)="handleTearDown()"
 * />
 */
@Component({
  selector: 'app-docker-controls-bar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './docker-controls-bar.component.html',
  styleUrl: './docker-controls-bar.component.scss',
})
export class DockerControlsBarComponent {
  private taskService = inject(TaskService);

  /**
   * Environment identifier (e.g., 'local' or planId)
   */
  envId = input.required<string>();

  /**
   * Whether to show compact mode (icons only)
   */
  compact = input<boolean>(false);

  /**
   * Whether to show inline mode (no container background/shadow)
   */
  inline = input<boolean>(false);

  /**
   * Optional task prefix to override default task naming.
   * When set, tasks are named `{taskPrefix}:stop`, `{taskPrefix}:start`, etc.
   * When not set, tasks are named `stop-{envId}`, `start-{envId}`, etc.
   */
  taskPrefix = input<string>();

  /**
   * Whether to show the Tear Down button (for worktree environments)
   */
  showTearDown = input<boolean>(false);

  /**
   * Emitted when an operation completes (for refreshing status)
   */
  onOperationComplete = output<void>();

  /**
   * Emitted when an operation errors
   */
  onOperationError = output<string>();

  /**
   * Emitted when tear down is requested (parent handles the actual teardown)
   */
  onTearDown = output<void>();

  /**
   * Get the task name for an action based on prefix configuration
   */
  private getTaskName(action: string): string {
    const prefix = this.taskPrefix();
    if (prefix) {
      return `${prefix}:${action}`;
    }
    return `${action}-${this.envId()}`;
  }

  // Task names (computed for reactivity)
  private stopTaskName = computed(() => this.getTaskName('stop'));
  private startTaskName = computed(() => this.getTaskName('start'));
  private buildRestartTaskName = computed(() =>
    this.taskPrefix() ? this.getTaskName('purge-restart') : `purge-and-restart-${this.envId()}`
  );
  private purgeTaskName = computed(() => this.getTaskName('purge'));
  private teardownTaskName = computed(() => this.getTaskName('teardown'));

  // Computed states for button disabled
  stopping = computed(() => this.taskService.isRunning(this.stopTaskName()));
  starting = computed(() => this.taskService.isRunning(this.startTaskName()));
  building = computed(() => this.taskService.isRunning(this.buildRestartTaskName()));
  purging = computed(() => this.taskService.isRunning(this.purgeTaskName()));
  tearingDown = computed(() => this.taskService.isRunning(this.teardownTaskName()));

  anyRunning = computed(
    () =>
      this.stopping() ||
      this.starting() ||
      this.building() ||
      this.purging() ||
      this.tearingDown()
  );

  async stopAll(): Promise<void> {
    try {
      await this.taskService.run(this.stopTaskName());
      this.onOperationComplete.emit();
    } catch (error) {
      this.onOperationError.emit('Failed to stop services');
    }
  }

  async startAll(): Promise<void> {
    try {
      await this.taskService.run(this.startTaskName());
      this.onOperationComplete.emit();
    } catch (error) {
      this.onOperationError.emit('Failed to start services');
    }
  }

  async buildRestart(): Promise<void> {
    try {
      await this.taskService.run(this.buildRestartTaskName());
      this.onOperationComplete.emit();
    } catch (error) {
      this.onOperationError.emit('Failed to build and restart');
    }
  }

  async purge(): Promise<void> {
    try {
      await this.taskService.run(this.purgeTaskName());
      this.onOperationComplete.emit();
    } catch (error) {
      this.onOperationError.emit('Failed to purge');
    }
  }

  async tearDown(): Promise<void> {
    try {
      await this.taskService.run(this.teardownTaskName());
      this.onTearDown.emit();
    } catch (error) {
      this.onOperationError.emit('Failed to tear down environment');
    }
  }
}
