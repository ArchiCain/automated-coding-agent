import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DockerServiceCardComponent } from '../docker-service-card/docker-service-card.component';
import {
  DockerService,
  DockerStatusMap,
  DockerServiceActionEvent,
} from '../../models/docker-service.model';

/**
 * Grid component for displaying multiple Docker service cards.
 *
 * @example
 * <app-docker-services-grid
 *   [services]="dockerServices"
 *   [statusMap]="statusMap()"
 *   [envId]="'local'"
 *   (onLogsRequested)="showLogs($event)"
 * />
 */
@Component({
  selector: 'app-docker-services-grid',
  standalone: true,
  imports: [CommonModule, DockerServiceCardComponent],
  templateUrl: './docker-services-grid.component.html',
  styleUrl: './docker-services-grid.component.scss',
})
export class DockerServicesGridComponent {
  /**
   * List of services to display
   */
  services = input.required<DockerService[]>();

  /**
   * Map of service ID to container status
   */
  statusMap = input.required<DockerStatusMap>();

  /**
   * Environment identifier
   */
  envId = input.required<string>();

  /**
   * Optional task prefix to override default task naming for all cards.
   * Passed through to each DockerServiceCardComponent.
   */
  taskPrefix = input<string>();

  /**
   * Emitted when an operation completes
   */
  onOperationComplete = output<void>();

  /**
   * Emitted when logs are requested for a service
   */
  onLogsRequested = output<DockerService>();

  /**
   * Handle action from a service card
   */
  handleAction(event: DockerServiceActionEvent): void {
    // Could emit a general action event if needed
  }

  /**
   * Handle logs requested from a service card
   */
  handleLogsRequested(service: DockerService): void {
    this.onLogsRequested.emit(service);
  }

  /**
   * Get status for a specific service
   */
  getStatus(serviceId: string) {
    return this.statusMap()[serviceId];
  }
}
