import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MarkdownComponent } from 'ngx-markdown';
import { AgentBuilderService } from '../../services/agent-builder.service';
import {
  CreateAgentConfigDto,
  FileEntry,
  AVAILABLE_MODELS,
  AVAILABLE_PROVIDERS,
  AVAILABLE_PAGES,
  AVAILABLE_ICONS,
} from '../../models/agent-config.model';
import { ChatbotPanelComponent } from '../../../chatbot/components/chatbot-panel/chatbot-panel';
import { ChatbotScopeContext } from '../../../chatbot/models/chatbot-scope.model';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components/components/slide-over/slide-over';

@Component({
  selector: 'app-agent-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MarkdownComponent,
    ChatbotPanelComponent,
    SlideOverComponent,
  ],
  templateUrl: './agent-editor.html',
  styleUrl: './agent-editor.scss',
})
export class AgentEditorComponent implements OnInit {
  private service = inject(AgentBuilderService);
  private agentService = inject(ClaudeCodeAgentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly models = AVAILABLE_MODELS;
  readonly providers = AVAILABLE_PROVIDERS;
  readonly availablePages = AVAILABLE_PAGES;
  readonly availableIcons = AVAILABLE_ICONS;

  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  agentId = signal<string | null>(null);
  agentSlug = signal<string | null>(null);

  // Form fields
  name = signal('');
  description = signal('');
  instructions = signal('');
  knowledgeFiles = signal<string[]>([]);
  cwd = signal('.');
  defaultModel = signal(AVAILABLE_MODELS[2].id); // Sonnet default
  provider = signal<'claude-code' | 'opencode'>('claude-code');
  icon = signal('smart_toy');
  color = signal('#7c4dff');
  pages = signal<string[]>([]);

  // Instructions mode: 'manual' = edit textarea, 'agent' = preview + agent helper
  instructionsMode = signal<'manual' | 'agent'>('manual');

  // Instructions agent scope — includes target agent's instructions as knowledge
  instructionsAgentScope = computed<ChatbotScopeContext>(() => {
    const slug = this.agentSlug();
    const targetPath = slug ? `.coding-agent-data/agents/${slug}/instructions.md` : '';
    return {
      scopeKey: 'instructions-writer',
      scopeLabel: 'Instructions Writer',
      instructionsFile: '.coding-agent-data/agents/instructions-writer/instructions.md',
      knowledgeFiles: targetPath ? [targetPath] : [],
      cwd: '.',
      readOnly: false,
      provider: 'claude-code',
      defaultModel: 'claude-opus-4-6',
      agentSlug: 'instructions-writer',
      agentIcon: 'edit_note',
      agentColor: '#7c4dff',
    };
  });

  // Context prepended to the first message so the agent knows where to write
  instructionsMessageContext = computed(() => {
    const slug = this.agentSlug();
    if (!slug) return null;
    return `[Output File]\nPath: .coding-agent-data/agents/${slug}/instructions.md\n\nWrite the agent instructions to the exact file path above.`;
  });

  // Slide-over document viewer
  slideOverOpen = signal(false);
  slideOverTitle = signal('');
  slideOverContent = signal('');
  slideOverLoading = signal(false);

  // Knowledge file browser
  fileBrowserOpen = signal(false);
  fileBrowserEntries = signal<FileEntry[]>([]);
  fileBrowserPath = signal('.');
  fileBrowserLoading = signal(false);

  // Working dir browser
  cwdBrowserOpen = signal(false);
  cwdBrowserEntries = signal<FileEntry[]>([]);
  cwdBrowserPath = signal('.');
  cwdBrowserLoading = signal(false);

  // Icon picker
  iconDropdownOpen = signal(false);
  iconSearch = signal('');
  filteredIcons = computed(() => {
    const search = this.iconSearch().toLowerCase();
    if (!search) return this.availableIcons;
    return this.availableIcons.filter(
      (ic) => ic.label.toLowerCase().includes(search) || ic.id.toLowerCase().includes(search),
    );
  });

  // Pages dropdown
  pagesDropdownOpen = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.agentId.set(id);
      this.loadAgent(id);
    }
  }

  private loadAgent(id: string): void {
    this.loading.set(true);
    this.service.getAgent(id).subscribe({
      next: (agent) => {
        this.name.set(agent.name);
        this.description.set(agent.description);
        this.knowledgeFiles.set(agent.knowledgeFiles);
        this.cwd.set(agent.cwd);
        this.defaultModel.set(agent.defaultModel);
        this.provider.set(agent.provider);
        this.icon.set(agent.icon || 'smart_toy');
        this.color.set(agent.color || '#7c4dff');
        this.pages.set(agent.pages || []);
        this.agentSlug.set(agent.slug);

        // Load instructions from disk
        this.service.readAgentInstructions(agent.slug).subscribe({
          next: (content) => {
            this.instructions.set(content);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/agents']);
      },
    });
  }

  save(): void {
    if (!this.name()) return;

    this.saving.set(true);
    const dto: CreateAgentConfigDto = {
      name: this.name(),
      description: this.description(),
      knowledgeFiles: this.knowledgeFiles(),
      cwd: this.cwd(),
      defaultModel: this.defaultModel(),
      provider: this.provider(),
      icon: this.icon(),
      color: this.color(),
      pages: this.pages(),
    };

    const obs = this.isEdit()
      ? this.service.updateAgent(this.agentId()!, dto)
      : this.service.createAgent(dto);

    obs.subscribe({
      next: (agent) => {
        // Save instructions to disk
        this.service.writeAgentInstructions(agent.slug, this.instructions()).subscribe({
          next: () => {
            this.saving.set(false);
            this.router.navigate(['/agents']);
          },
          error: () => {
            this.saving.set(false);
            this.router.navigate(['/agents']);
          },
        });
      },
      error: () => this.saving.set(false),
    });
  }

  cancel(): void {
    this.router.navigate(['/agents']);
  }

  // --- Instructions mode ---
  setInstructionsMode(mode: 'manual' | 'agent'): void {
    this.instructionsMode.set(mode);
  }

  onViewKnowledgeFile(path: string): void {
    this.openDocumentDrawer(path);
  }

  onInstructionsAgentViewDocument(path: string): void {
    this.openDocumentDrawer(path);
  }

  private openDocumentDrawer(path: string): void {
    this.slideOverTitle.set(path.split('/').pop() || path);
    this.slideOverContent.set('');
    this.slideOverLoading.set(true);
    this.slideOverOpen.set(true);

    this.agentService.readDocument(path).subscribe({
      next: (result) => {
        this.slideOverContent.set(result.content);
        this.slideOverLoading.set(false);
      },
      error: () => {
        this.slideOverContent.set('Failed to load document.');
        this.slideOverLoading.set(false);
      },
    });
  }

  onSlideOverClosed(): void {
    this.slideOverOpen.set(false);
  }

  onInstructionsTurnComplete(): void {
    const slug = this.agentSlug();
    if (!slug) return;
    this.service.readAgentInstructions(slug).subscribe({
      next: (content) => this.instructions.set(content),
    });
  }

  // --- Knowledge file browser ---
  toggleFileBrowser(): void {
    const isOpen = this.fileBrowserOpen();
    if (!isOpen) {
      this.browseFiles();
    }
    this.fileBrowserOpen.set(!isOpen);
  }

  browseFiles(dirPath?: string): void {
    this.fileBrowserLoading.set(true);
    this.service.browse(dirPath).subscribe({
      next: (result) => {
        this.fileBrowserEntries.set(result.entries);
        this.fileBrowserPath.set(result.currentPath);
        this.fileBrowserLoading.set(false);
      },
      error: () => this.fileBrowserLoading.set(false),
    });
  }

  onFileBrowserClick(entry: FileEntry): void {
    if (entry.type === 'directory') {
      this.browseFiles(entry.path);
    } else {
      this.toggleKnowledgeFile(entry.path);
    }
  }

  fileBrowserUp(): void {
    const current = this.fileBrowserPath();
    if (current === '.') return;
    const parent = current.split('/').slice(0, -1).join('/') || '.';
    this.browseFiles(parent === '.' ? undefined : parent);
  }

  toggleKnowledgeFile(filePath: string): void {
    const current = [...this.knowledgeFiles()];
    const index = current.indexOf(filePath);
    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(filePath);
    }
    this.knowledgeFiles.set(current);
  }

  removeKnowledgeFile(filePath: string): void {
    this.knowledgeFiles.set(this.knowledgeFiles().filter((f) => f !== filePath));
  }

  isFileSelected(filePath: string): boolean {
    return this.knowledgeFiles().includes(filePath);
  }

  getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  getFileIcon(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return 'code';
      case 'js': return 'javascript';
      case 'html': return 'web';
      case 'scss':
      case 'css': return 'palette';
      case 'json': return 'data_object';
      case 'md': return 'article';
      case 'yml':
      case 'yaml': return 'settings';
      default: return 'description';
    }
  }

  // --- Working dir browser ---
  toggleCwdBrowser(): void {
    const isOpen = this.cwdBrowserOpen();
    if (!isOpen) {
      this.browseCwdDirs();
    }
    this.cwdBrowserOpen.set(!isOpen);
  }

  browseCwdDirs(dirPath?: string): void {
    this.cwdBrowserLoading.set(true);
    this.service.browse(dirPath).subscribe({
      next: (result) => {
        this.cwdBrowserEntries.set(result.entries.filter((e) => e.type === 'directory'));
        this.cwdBrowserPath.set(result.currentPath);
        this.cwdBrowserLoading.set(false);
      },
      error: () => this.cwdBrowserLoading.set(false),
    });
  }

  onCwdEntryClick(entry: FileEntry): void {
    this.browseCwdDirs(entry.path);
  }

  cwdBrowserUp(): void {
    const current = this.cwdBrowserPath();
    if (current === '.') return;
    const parent = current.split('/').slice(0, -1).join('/') || '.';
    this.browseCwdDirs(parent === '.' ? undefined : parent);
  }

  selectCwd(path: string): void {
    this.cwd.set(path);
    this.cwdBrowserOpen.set(false);
  }

  // --- Icon picker ---
  toggleIconDropdown(): void {
    const opening = !this.iconDropdownOpen();
    this.iconDropdownOpen.set(opening);
    if (!opening) {
      this.iconSearch.set('');
    }
  }

  selectIcon(iconId: string): void {
    this.icon.set(iconId);
    this.iconDropdownOpen.set(false);
    this.iconSearch.set('');
  }

  getIconLabel(iconId: string): string {
    return this.availableIcons.find((ic) => ic.id === iconId)?.label || iconId;
  }

  // --- Pages multi-select ---
  togglePagesDropdown(): void {
    this.pagesDropdownOpen.update((v) => !v);
  }

  togglePage(pagePath: string): void {
    const current = this.pages();
    if (pagePath === 'ALL') {
      this.pages.set(current.includes('ALL') ? [] : ['ALL']);
    } else {
      const withoutAll = current.filter((p) => p !== 'ALL');
      if (withoutAll.includes(pagePath)) {
        this.pages.set(withoutAll.filter((p) => p !== pagePath));
      } else {
        this.pages.set([...withoutAll, pagePath]);
      }
    }
  }

  isPageSelected(pagePath: string): boolean {
    const current = this.pages();
    if (current.includes('ALL')) return true;
    return current.includes(pagePath);
  }

  get pagesLabel(): string {
    const current = this.pages();
    if (current.length === 0) return 'No pages selected';
    if (current.includes('ALL')) return 'All Pages';
    const labels = current
      .map((p) => this.availablePages.find((ap) => ap.path === p)?.label)
      .filter(Boolean);
    return labels.join(', ');
  }
}
