import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { TaskBarComponent } from '../../components/task-bar/task-bar.component';
import { BranchControlsComponent } from '../../components/branch-controls/branch-controls.component';
import { CommandCenterService, GitStatus } from '../../services/command-center.service';

import {
  DockerControlsBarComponent,
  DockerServicesGridComponent,
  EnvironmentInfoBarComponent,
  computeDockerServices,
  DockerStatusMap,
} from '../../../local-env';

/**
 * Command Center Dashboard - main control page for the base repository.
 * Provides task execution, branch management, and docker environment controls.
 */
@Component({
  selector: 'app-command-center-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    TaskBarComponent,
    BranchControlsComponent,
    DockerControlsBarComponent,
    DockerServicesGridComponent,
    EnvironmentInfoBarComponent,
  ],
  templateUrl: './command-center-dashboard.component.html',
  styleUrl: './command-center-dashboard.component.scss',
})
export class CommandCenterDashboardComponent implements OnInit {
  private commandCenterService = inject(CommandCenterService);

  // Environment ID for docker operations (base repo uses 'local')
  readonly envId = 'local';

  // Docker services (no port offset for command center)
  readonly services = computeDockerServices(0);

  // Docker status
  dockerStatusMap = signal<DockerStatusMap>({});
  dockerLoading = signal(false);

  // Git status for environment info bar
  gitStatus = signal<GitStatus | null>(null);
  currentBranch = signal('');

  ngOnInit(): void {
    this.loadDockerStatus();
    this.loadGitStatus();
  }

  loadGitStatus(): void {
    this.commandCenterService.getGitStatus().subscribe({
      next: (status) => {
        this.gitStatus.set(status);
        this.currentBranch.set(status.branch);
      },
      error: () => {
        // Silently fail - branch controls will show the status anyway
      },
    });
  }

  loadDockerStatus(): void {
    this.dockerLoading.set(true);
    this.commandCenterService.getDockerStatus().subscribe({
      next: (status) => {
        // Convert API response to DockerStatusMap
        const statusMap: DockerStatusMap = {};
        for (const [id, s] of Object.entries(status)) {
          statusMap[id] = {
            state: s.state as 'running' | 'exited' | 'dead' | 'restarting' | 'created' | 'unknown',
            health: s.health as 'healthy' | 'unhealthy' | 'starting' | null,
          };
        }
        this.dockerStatusMap.set(statusMap);
        this.dockerLoading.set(false);
      },
      error: () => {
        this.dockerLoading.set(false);
      },
    });
  }

  onDockerOperationComplete(): void {
    // Refresh docker status after an operation
    setTimeout(() => this.loadDockerStatus(), 1000);
  }
}
