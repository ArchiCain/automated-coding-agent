import {
  Component,
  signal,
  inject,
  effect,
  HostListener,
  ViewChildren,
  QueryList,
  computed,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, filter } from 'rxjs';
import { ChatbotPanelComponent } from '../chatbot-panel/chatbot-panel';
import { SlideOverComponent } from '../../../ui-components/components/slide-over/slide-over';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { AgentBuilderService } from '../../../agent-builder/services/agent-builder.service';
import { AgentConfig } from '../../../agent-builder/models/agent-config.model';
import { SessionManagerService } from '../../../claude-code-agent/services/session-manager.service';
import { ScopedSessionService } from '../../services/scoped-session.service';
import { AgentTestService } from '../../services/agent-test.service';
import { ChatbotScopeContext } from '../../models/chatbot-scope.model';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    ChatbotPanelComponent,
    SlideOverComponent,
  ],
  templateUrl: './chatbot-widget.html',
  styleUrl: './chatbot-widget.scss',
  host: { 'data-chatbot-overlay': '' },
})
export class ChatbotWidgetComponent implements OnDestroy {
  @ViewChildren('agentPanel') agentPanels!: QueryList<ChatbotPanelComponent>;

  private agentService = inject(ClaudeCodeAgentService);
  private agentBuilderService = inject(AgentBuilderService);
  private scopedSession = inject(ScopedSessionService);
  private sessionManager = inject(SessionManagerService);
  private router = inject(Router);
  readonly agentTest = inject(AgentTestService);

  private routeSub: Subscription;

  // All agents loaded from backend
  private allAgents = signal<AgentConfig[]>([]);
  private currentPath = signal('');

  // Agents for the current page (filtered by pages field, ALL agents last/rightmost)
  pageAgents = computed(() => {
    const path = this.currentPath();
    const agents = this.allAgents();
    const matched = agents.filter((agent) => {
      if (agent.pages.includes('ALL')) return true;
      return agent.pages.some((p) => path.startsWith(p));
    });
    // Sort: ALL agents first in array (rightmost in row-reverse), then page-specific
    return matched.sort((a, b) => {
      const aAll = a.pages.includes('ALL') ? 0 : 1;
      const bAll = b.pages.includes('ALL') ? 0 : 1;
      return aAll - bAll;
    });
  });

  // Track which agent panel is open (by slug, null = none)
  openAgentSlug = signal<string | null>(null);

  // Session resumption per agent
  resumedSessionIds = signal<Record<string, string | null>>({});
  resumedTranscripts = signal<Record<string, string[] | null>>({});

  // Agent test panel
  agentTestPanelOpen = signal(false);

  // SlideOver state
  slideOverOpen = signal(false);
  slideOverTitle = signal('');
  slideOverContent = signal('');
  slideOverLoading = signal(false);

  constructor() {
    // Load agents initially
    this.loadAgents();

    // Reload agents and update current path on navigation
    this.routeSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => {
        this.currentPath.set((e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url);
        this.loadAgents();
      });

    // Set initial path
    this.currentPath.set(this.router.url);

    // Auto-open agent test panel when a test is launched
    effect(() => {
      if (this.agentTest.isActive()) {
        this.agentTestPanelOpen.set(true);
      }
    });

    // Handle requests from the agents indicator to open a specific agent panel
    effect(() => {
      const request = this.sessionManager.requestOpenAgent();
      if (!request) return;

      const { slug, route } = request;
      this.sessionManager.clearOpenAgentRequest();

      if (this.router.url !== route) {
        this.router.navigateByUrl(route).then(() => {
          setTimeout(() => this.openAgentSlug.set(slug), 100);
        });
      } else {
        this.openAgentSlug.set(slug);
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey && event.key === '/') {
      event.preventDefault();
      // Toggle the first agent on the page (rightmost bubble)
      const agents = this.pageAgents();
      if (agents.length > 0) {
        const last = agents[agents.length - 1];
        this.toggleAgentPanel(last.slug);
      }
    }
  }

  private loadAgents(): void {
    this.agentBuilderService.listAgents().subscribe({
      next: (agents) => this.allAgents.set(agents),
      error: () => this.allAgents.set([]),
    });
  }

  getScopeForAgent(agent: AgentConfig): ChatbotScopeContext {
    return {
      scopeKey: `agent-${agent.slug}`,
      scopeLabel: agent.name,
      instructionsFile: '.coding-agent-data/agents/' + agent.slug + '/instructions.md',
      knowledgeFiles: agent.knowledgeFiles,
      cwd: agent.cwd,
      provider: agent.provider,
      defaultModel: agent.defaultModel,
      agentSlug: agent.slug,
      agentIcon: agent.icon,
      agentColor: agent.color,
    };
  }

  toggleAgentPanel(slug: string): void {
    if (this.openAgentSlug() === slug) {
      this.openAgentSlug.set(null);
    } else {
      this.openAgentSlug.set(slug);
      this.tryResumeAgentSession(slug);
    }
  }

  onAgentMinimize(): void {
    this.openAgentSlug.set(null);
  }

  onAgentSessionCreated(slug: string, sessionId: string): void {
    this.scopedSession.registerSession(`agent-${slug}`, sessionId);
  }

  // --- Agent test ---
  toggleAgentTestPanel(): void {
    this.agentTestPanelOpen.update((v) => !v);
  }

  onAgentTestMinimize(): void {
    this.agentTestPanelOpen.set(false);
  }

  onAgentTestSessionCreated(sessionId: string): void {
    const scope = this.agentTest.testScope();
    if (scope) {
      this.scopedSession.registerSession(scope.scopeKey, sessionId);
    }
  }

  dismissAgentTest(): void {
    this.agentTestPanelOpen.set(false);
    this.agentTest.dismiss();
  }

  // --- Document viewer ---
  onViewDocument(path: string): void {
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

  getResumedSessionId(slug: string): string | null {
    return this.resumedSessionIds()[slug] ?? null;
  }

  getResumedTranscript(slug: string): string[] | null {
    return this.resumedTranscripts()[slug] ?? null;
  }

  onAgentNewSession(slug: string): void {
    const scopeKey = `agent-${slug}`;
    this.scopedSession.clearSession(scopeKey);
    this.clearResumedSession(slug);
  }

  private tryResumeAgentSession(slug: string): void {
    const scopeKey = `agent-${slug}`;
    const existingSessionId = this.scopedSession.getSessionForScope(scopeKey);

    if (!existingSessionId) {
      this.clearResumedSession(slug);
      return;
    }

    // Tier 1: Check SessionManagerService in-memory transcript (instant, no HTTP)
    const tracked = this.sessionManager.getSession(existingSessionId);
    if (tracked && tracked.output.length > 0) {
      this.resumedSessionIds.update((m) => ({ ...m, [slug]: existingSessionId }));
      this.resumedTranscripts.update((m) => ({ ...m, [slug]: tracked.output }));
      return;
    }

    // Tier 2: Try backend in-memory session
    this.scopedSession.resumeSession(scopeKey).subscribe({
      next: (result) => {
        if (result && result.transcript.length > 0) {
          this.resumedSessionIds.update((m) => ({ ...m, [slug]: result.sessionId }));
          this.resumedTranscripts.update((m) => ({ ...m, [slug]: result.transcript }));
          return;
        }

        // Tier 3: Fall back to disk-persisted transcript
        this.agentBuilderService.getAgentSessionTranscript(slug, existingSessionId).subscribe({
          next: (diskResult) => {
            if (diskResult.transcript.length > 0) {
              this.resumedSessionIds.update((m) => ({ ...m, [slug]: existingSessionId }));
              this.resumedTranscripts.update((m) => ({ ...m, [slug]: diskResult.transcript }));
            } else {
              this.clearResumedSession(slug);
            }
          },
          error: () => this.clearResumedSession(slug),
        });
      },
      error: () => this.clearResumedSession(slug),
    });
  }

  private clearResumedSession(slug: string): void {
    this.resumedSessionIds.update((m) => ({ ...m, [slug]: null }));
    this.resumedTranscripts.update((m) => ({ ...m, [slug]: null }));
  }

  trackBySlug(_: number, agent: AgentConfig): string {
    return agent.slug;
  }
}
