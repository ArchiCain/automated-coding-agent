import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ProjectsService } from '../../services/projects.service';
import { RepoProject, ProjectFeature } from '../../models/project.model';

import { BreadcrumbComponent, BreadcrumbItem } from '../../components/breadcrumb/breadcrumb';
import { ChatbotScopeResolverService } from '../../../chatbot/services/chatbot-scope-resolver.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { DockerControlsBarComponent, DockerStatusMap } from '../../../local-env';
import { CommandCenterService } from '../../../command-center/services/command-center.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BreadcrumbComponent,
    DockerControlsBarComponent,
    SlideOverComponent,
  ],
  templateUrl: './project-detail.html',
  styleUrl: './project-detail.scss',
})
export class ProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectsService = inject(ProjectsService);
  private scopeResolver = inject(ChatbotScopeResolverService);
  private agentService = inject(ClaudeCodeAgentService);
  private commandCenterService = inject(CommandCenterService);

  project = signal<RepoProject | null>(null);
  features = signal<ProjectFeature[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  breadcrumbs = signal<BreadcrumbItem[]>([]);

  // Docker
  dockerStatusMap = signal<DockerStatusMap>({});

  // README slide-over
  readmeOpen = signal(false);
  readmeTitle = signal('');
  readmeContent = signal('');

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId')!;
    this.loadProject(projectId);
    this.loadDockerStatus();
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

  getStatusDotClass(): string {
    const p = this.project();
    if (!p || !p.hasDocker) return 'status-na';
    const status = this.dockerStatusMap()[p.id];
    if (!status) return 'status-unknown';
    if (status.state === 'running') return 'status-running';
    if (status.state === 'exited') return 'status-stopped';
    return 'status-unknown';
  }

  openReadme(): void {
    const p = this.project();
    if (!p?.readmePath) return;

    this.readmeTitle.set(`${p.name} — README`);
    this.readmeContent.set('Loading...');
    this.readmeOpen.set(true);

    this.agentService.readDocument(p.readmePath).subscribe({
      next: (res) => this.readmeContent.set(res.content),
      error: () => this.readmeContent.set('Failed to load README.'),
    });
  }

  openFeatureReadme(feature: ProjectFeature, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    if (!feature.hasReadme) return;

    const readmePath = `${feature.path}/README.md`;
    this.readmeTitle.set(`${feature.name} — README`);
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

  private loadProject(projectId: string): void {
    this.loading.set(true);

    this.projectsService.getProject(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.breadcrumbs.set([
          { label: 'Projects', route: '/projects' },
          { label: project.name, route: `/projects/${projectId}` },
        ]);

        // Set chatbot scope for this project
        this.scopeResolver.overrideScope({
          scopeKey: `projects:${projectId}`,
          scopeLabel: `${project.name} Project`,
          instructionsFile: '.agent-prompts/project-features.md',
          knowledgeFiles: ['docs/feature-architecture.md', `${project.path}/README.md`],
        });

        this.loadFeatures(projectId);
      },
      error: (err) => {
        this.error.set('Failed to load project');
        this.loading.set(false);
      },
    });
  }

  private loadFeatures(projectId: string): void {
    this.projectsService.listFeatures(projectId).subscribe({
      next: (features) => {
        this.features.set(features);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

}
