import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ProjectsService } from '../../services/projects.service';
import { RepoProject, ProjectFeature, FeatureConcern } from '../../models/project.model';
import { BreadcrumbComponent, BreadcrumbItem } from '../../components/breadcrumb/breadcrumb';
import { ChatbotScopeResolverService } from '../../../chatbot/services/chatbot-scope-resolver.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

export interface FileTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: FileTreeNode[];
  concern?: FeatureConcern;
  expanded: boolean;
}

@Component({
  selector: 'app-feature-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    BreadcrumbComponent,
    SlideOverComponent,
  ],
  templateUrl: './feature-detail.html',
  styleUrl: './feature-detail.scss',
})
export class FeatureDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectsService = inject(ProjectsService);
  private scopeResolver = inject(ChatbotScopeResolverService);
  private agentService = inject(ClaudeCodeAgentService);

  project = signal<RepoProject | null>(null);
  feature = signal<ProjectFeature | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  breadcrumbs = signal<BreadcrumbItem[]>([]);

  // File tree
  fileTree = computed<FileTreeNode[]>(() => {
    const feat = this.feature();
    if (!feat) return [];
    return this.buildFileTree(feat.concerns);
  });

  // Slide-over state
  selectedFile = signal<{ name: string; path: string } | null>(null);
  fileContent = signal('');
  fileLoading = signal(false);
  fileLanguage = signal('');

  // Track expanded folders
  expandedFolders = signal<Set<string>>(new Set());

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId')!;
    const featureId = this.route.snapshot.paramMap.get('featureId')!;
    this.loadData(projectId, featureId);
  }

  toggleFolder(node: FileTreeNode): void {
    const expanded = new Set(this.expandedFolders());
    if (expanded.has(node.path)) {
      expanded.delete(node.path);
    } else {
      expanded.add(node.path);
    }
    this.expandedFolders.set(expanded);
  }

  isFolderExpanded(node: FileTreeNode): boolean {
    return this.expandedFolders().has(node.path);
  }

  openFile(concern: FeatureConcern): void {
    const feat = this.feature();
    if (!feat) return;

    const fullPath = `${feat.path}/${concern.fileName}`;
    this.selectedFile.set({ name: concern.fileName, path: fullPath });
    this.fileLoading.set(true);
    this.fileContent.set('');
    this.fileLanguage.set(this.getLanguageFromFileName(concern.fileName));

    this.agentService.readDocument(fullPath).subscribe({
      next: (response) => {
        this.fileContent.set(response.content);
        this.fileLoading.set(false);
      },
      error: () => {
        this.fileContent.set('// Error loading file');
        this.fileLoading.set(false);
      },
    });
  }

  openReadme(): void {
    const feat = this.feature();
    if (!feat?.hasReadme) return;

    const readmePath = `${feat.path}/README.md`;
    this.selectedFile.set({ name: 'README.md', path: readmePath });
    this.fileLoading.set(true);
    this.fileContent.set('');
    this.fileLanguage.set('');  // Markdown rendering

    this.agentService.readDocument(readmePath).subscribe({
      next: (res) => {
        this.fileContent.set(res.content);
        this.fileLoading.set(false);
      },
      error: () => {
        this.fileContent.set('Failed to load README.');
        this.fileLoading.set(false);
      },
    });
  }

  closeFile(): void {
    this.selectedFile.set(null);
    this.fileContent.set('');
  }

  private loadData(projectId: string, featureId: string): void {
    this.loading.set(true);

    this.projectsService.getProject(projectId).subscribe({
      next: (project) => {
        this.project.set(project);

        this.projectsService.getFeature(projectId, featureId).subscribe({
          next: (feature) => {
            this.feature.set(feature);
            this.loading.set(false);

            // Expand all folders by default
            const allFolders = new Set<string>();
            this.collectFolderPaths(this.buildFileTree(feature.concerns), allFolders);
            this.expandedFolders.set(allFolders);

            this.breadcrumbs.set([
              { label: 'Projects', route: '/projects' },
              { label: project.name, route: `/projects/${projectId}` },
              { label: feature.name, route: `/projects/${projectId}/features/${featureId}` },
            ]);

            this.scopeResolver.overrideScope({
              scopeKey: `projects:${projectId}:features:${featureId}`,
              scopeLabel: `${feature.name} Feature`,
              instructionsFile: '.agent-prompts/feature-concerns.md',
              knowledgeFiles: feature.hasReadme ? [`${feature.path}/README.md`] : [],
            });
          },
          error: () => {
            this.error.set('Failed to load feature');
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.error.set('Failed to load project');
        this.loading.set(false);
      },
    });
  }

  private buildFileTree(concerns: FeatureConcern[]): FileTreeNode[] {
    const root: FileTreeNode[] = [];

    for (const concern of concerns) {
      const parts = concern.fileName.split('/');
      let currentLevel = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const pathSoFar = parts.slice(0, i + 1).join('/');

        let existing = currentLevel.find((n) => n.name === part && n.isFolder === !isFile);

        if (!existing) {
          existing = {
            name: part,
            path: pathSoFar,
            isFolder: !isFile,
            children: [],
            concern: isFile ? concern : undefined,
            expanded: false,
          };
          currentLevel.push(existing);
        }

        if (!isFile) {
          currentLevel = existing.children;
        }
      }
    }

    this.sortTree(root);
    return root;
  }

  private sortTree(nodes: FileTreeNode[]): void {
    nodes.sort((a, b) => {
      // Folders first
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length > 0) {
        this.sortTree(node.children);
      }
    }
  }

  private collectFolderPaths(nodes: FileTreeNode[], paths: Set<string>): void {
    for (const node of nodes) {
      if (node.isFolder) {
        paths.add(node.path);
        this.collectFolderPaths(node.children, paths);
      }
    }
  }

  private getLanguageFromFileName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'typescript';
      case 'js': return 'javascript';
      case 'html': return 'markup';
      case 'scss': return 'scss';
      case 'css': return 'css';
      case 'json': return 'json';
      case 'yml':
      case 'yaml': return 'yaml';
      case 'sh':
      case 'bash': return 'bash';
      case 'md': return '';  // Use markdown renderer for .md files
      default: return 'typescript';  // Default to TS for this codebase
    }
  }
}
