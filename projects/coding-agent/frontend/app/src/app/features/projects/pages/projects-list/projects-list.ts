import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ProjectsService } from '../../services/projects.service';
import { RepoProject } from '../../models/project.model';
import { TaskBarComponent, BranchControlsComponent } from '../../../command-center';
import {
  DockerControlsBarComponent,
  DockerStatusMap,
} from '../../../local-env';
import { CommandCenterService } from '../../../command-center/services/command-center.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatProgressSpinnerModule,
    TaskBarComponent,
    BranchControlsComponent,
    DockerControlsBarComponent,
    SlideOverComponent,
  ],
  templateUrl: './projects-list.html',
  styleUrl: './projects-list.scss',
})
export class ProjectsListComponent implements OnInit {
  private projectsService = inject(ProjectsService);
  private commandCenterService = inject(CommandCenterService);
  private agentService = inject(ClaudeCodeAgentService);

  projects = signal<RepoProject[]>([]);
  loading = signal(true);

  sortedProjects = computed(() =>
    [...this.projects()].sort((a, b) => {
      if (a.hasDocker === b.hasDocker) return 0;
      return a.hasDocker ? -1 : 1;
    })
  );

  // Docker
  readonly envId = 'local';
  dockerStatusMap = signal<DockerStatusMap>({});

  ngOnInit(): void {
    this.loadProjects();
    this.loadDockerStatus();
  }

  loadProjects(): void {
    this.loading.set(true);
    this.projectsService.listProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  loadDockerStatus(): void {
    this.commandCenterService.getDockerStatus().subscribe({
      next: (status) => {
        const statusMap: DockerStatusMap = {};
        for (const [id, s] of Object.entries(status)) {
          statusMap[id] = {
            state: s.state as any,
            health: s.health as any,
          };
        }
        this.dockerStatusMap.set(statusMap);
      },
    });
  }

  onDockerOperationComplete(): void {
    setTimeout(() => this.loadDockerStatus(), 1000);
  }

  // README slide-over
  readmeOpen = signal(false);
  readmeTitle = signal('');
  readmeContent = signal('');

  openReadme(project: RepoProject, event: Event): void {
    event.stopPropagation();
    const readmePath = project.readmePath;
    if (!readmePath) return;

    this.readmeTitle.set(`${project.name} — README`);
    this.readmeContent.set('Loading...');
    this.readmeOpen.set(true);

    this.agentService.readDocument(readmePath).subscribe({
      next: (res) => this.readmeContent.set(res.content),
      error: () => this.readmeContent.set('Failed to load README.'),
    });
  }

  closeReadme(): void {
    this.readmeOpen.set(false);
  }

  getStatusDotClass(project: RepoProject): string {
    if (!project.hasDocker) return 'status-na';
    const status = this.dockerStatusMap()[project.id];
    if (!status) return 'status-unknown';
    if (status.state === 'running') return 'status-running';
    if (status.state === 'exited') return 'status-stopped';
    return 'status-unknown';
  }

}
