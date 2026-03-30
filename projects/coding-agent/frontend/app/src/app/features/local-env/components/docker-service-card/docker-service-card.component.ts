import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TaskService } from '../../../tasks';
import {
  DockerService,
  DockerContainerStatus,
  DockerServiceActionEvent,
} from '../../models/docker-service.model';

type ServiceState = 'running' | 'stopped' | 'error' | 'starting' | 'unknown';

/**
 * Card component for displaying a single Docker service.
 *
 * @example
 * <!-- Basic usage -->
 * <app-docker-service-card
 *   [service]="dockerService"
 *   [status]="serviceStatus"
 *   [envId]="'local'"
 * />
 *
 * @example
 * <!-- With custom task prefix for worktree -->
 * <app-docker-service-card
 *   [service]="dockerService"
 *   [status]="serviceStatus"
 *   [envId]="planId"
 *   [taskPrefix]="'env:' + planId"
 * />
 */
@Component({
  selector: 'app-docker-service-card',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './docker-service-card.component.html',
  styleUrl: './docker-service-card.component.scss',
})
export class DockerServiceCardComponent {
  private taskService = inject(TaskService);

  /**
   * The service to display
   */
  service = input.required<DockerService>();

  /**
   * Current container status
   */
  status = input<DockerContainerStatus | undefined>();

  /**
   * Environment identifier
   */
  envId = input.required<string>();

  /**
   * Optional task prefix to override default task naming.
   * When set, tasks are named `{taskPrefix}:{serviceId}:start`, etc.
   */
  taskPrefix = input<string>();

  /**
   * Emitted when an action is triggered
   */
  onAction = output<DockerServiceActionEvent>();

  /**
   * Emitted when logs are requested
   */
  onLogsRequested = output<DockerService>();

  // Computed state
  state = computed<ServiceState>(() => {
    const status = this.status();
    if (!status) return 'unknown';

    switch (status.state) {
      case 'running':
        if (status.health === 'unhealthy') return 'error';
        if (status.health === 'starting') return 'starting';
        return 'running';
      case 'exited':
      case 'dead':
        return 'stopped';
      case 'restarting':
      case 'created':
        return 'starting';
      default:
        return 'unknown';
    }
  });

  stateClass = computed(() => `state-${this.state()}`);

  isRunningState = computed(() => {
    const state = this.state();
    // Include 'error' because unhealthy containers are still running and can be stopped
    return state === 'running' || state === 'starting' || state === 'error';
  });

  stateLabel = computed(() => {
    const state = this.state();
    switch (state) {
      case 'running':
        return 'Running';
      case 'stopped':
        return 'Stopped';
      case 'error':
        return 'Unhealthy';
      case 'starting':
        return 'Starting';
      default:
        return 'Unknown';
    }
  });

  /**
   * Health status for icon display
   */
  healthStatus = computed<'healthy' | 'unhealthy' | null>(() => {
    const s = this.status();
    if (!s || s.state !== 'running') return null;
    if (s.health === 'healthy') return 'healthy';
    if (s.health === 'unhealthy') return 'unhealthy';
    return null;
  });

  /** Get the task name prefix for this service */
  private serviceTaskPrefix = computed(() => {
    const prefix = this.taskPrefix();
    const svc = this.service();
    if (prefix) {
      return `${prefix}:${svc.id}`;
    }
    return svc.taskPrefix ?? `${svc.id}:local`;
  });

  // Task-based computed states
  isStarting = computed(() => {
    return this.taskService.isRunning(`${this.serviceTaskPrefix()}:start`);
  });

  isStopping = computed(() => {
    return this.taskService.isRunning(`${this.serviceTaskPrefix()}:stop`);
  });

  isRestarting = computed(() => {
    return this.taskService.isRunning(`${this.serviceTaskPrefix()}:restart`);
  });

  anyActionRunning = computed(
    () => this.isStarting() || this.isStopping() || this.isRestarting()
  );

  async start(): Promise<void> {
    const svc = this.service();
    await this.taskService.run(`${this.serviceTaskPrefix()}:start`);
    this.onAction.emit({ action: 'start', service: svc });
  }

  async stop(): Promise<void> {
    const svc = this.service();
    await this.taskService.run(`${this.serviceTaskPrefix()}:stop`);
    this.onAction.emit({ action: 'stop', service: svc });
  }

  async buildAndRestart(): Promise<void> {
    const svc = this.service();
    await this.taskService.run(`${this.serviceTaskPrefix()}:restart`);
    this.onAction.emit({ action: 'restart', service: svc });
  }

  viewLogs(): void {
    this.taskService.run(`${this.serviceTaskPrefix()}:logs`);
    this.onLogsRequested.emit(this.service());
  }

  openInBrowser(): void {
    const svc = this.service();
    if (svc.browserUrl) {
      window.open(svc.browserUrl, '_blank');
      this.onAction.emit({ action: 'open', service: svc });
    }
  }
}
