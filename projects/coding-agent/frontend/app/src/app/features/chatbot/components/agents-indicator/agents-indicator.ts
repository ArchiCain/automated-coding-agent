import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SessionManagerService, TrackedSession } from '../../../claude-code-agent/services/session-manager.service';
import { AgentBuilderService } from '../../../agent-builder/services/agent-builder.service';
import { AgentConfig } from '../../../agent-builder/models/agent-config.model';

const PAGE_LABELS: Record<string, string> = {
  '/projects': 'Projects',
  '/brainstorm': 'Brainstorm',
  '/backlog': 'Backlog',
  '/command-center': 'Command Center',
  '/agents': 'Agent Builder',
};

@Component({
  selector: 'app-agents-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatBadgeModule, MatTooltipModule],
  templateUrl: './agents-indicator.html',
  styleUrl: './agents-indicator.scss',
})
export class AgentsIndicatorComponent implements OnInit, OnDestroy {
  readonly sessionManager = inject(SessionManagerService);
  private agentBuilderService = inject(AgentBuilderService);

  panelOpen = signal(false);
  private agentMap = signal<Map<string, AgentConfig>>(new Map());
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  tick = signal(0);

  // Grouped sessions
  runningSessions = computed(() =>
    this.sessionManager.sessions().filter((s) => s.metadata.status === 'active')
  );

  waitingSessions = computed(() =>
    this.sessionManager.sessions().filter((s) => s.metadata.status === 'paused')
  );

  finishedSessions = computed(() =>
    this.sessionManager.sessions().filter(
      (s) => s.metadata.status === 'completed' || s.metadata.status === 'failed'
    )
  );

  hasAnySessions = computed(() => this.sessionManager.sessions().length > 0);

  ngOnInit(): void {
    this.loadAgents();
  }

  ngOnDestroy(): void {
    this.stopTicking();
  }

  private loadAgents(): void {
    this.agentBuilderService.listAgents().subscribe({
      next: (agents) => {
        const map = new Map<string, AgentConfig>();
        agents.forEach((a) => map.set(a.slug, a));
        this.agentMap.set(map);
      },
    });
  }

  togglePanel(): void {
    this.panelOpen.update((v) => !v);
    if (this.panelOpen()) {
      this.loadAgents();
      this.startTicking();
    } else {
      this.stopTicking();
    }
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.stopTicking();
  }

  openSession(session: TrackedSession): void {
    const slug = session.metadata.agentSlug;
    const route = session.metadata.startedFromRoute;
    if (slug && route) {
      this.sessionManager.requestOpenAgentPanel(slug, route);
    }
    this.closePanel();
  }

  getAgentIcon(session: TrackedSession): string {
    const slug = session.metadata.agentSlug;
    if (slug) {
      const agent = this.agentMap().get(slug);
      if (agent?.icon) return agent.icon;
    }
    return 'smart_toy';
  }

  getAgentColor(session: TrackedSession): string {
    const slug = session.metadata.agentSlug;
    if (slug) {
      const agent = this.agentMap().get(slug);
      if (agent?.color) return agent.color;
    }
    return '#7c4dff';
  }

  getPageLabel(session: TrackedSession): string {
    const route = session.metadata.startedFromRoute;
    if (!route) return '';
    for (const [path, label] of Object.entries(PAGE_LABELS)) {
      if (route.startsWith(path)) return label;
    }
    return route;
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'active': return 'Running';
      case 'paused': return 'Idle';
      case 'completed': return 'Done';
      case 'failed': return 'Failed';
      default: return status;
    }
  }

  getElapsedTime(session: TrackedSession): string {
    // tick() dependency forces re-evaluation
    this.tick();
    const start = new Date(session.metadata.startedAt).getTime();
    const end = session.metadata.completedAt
      ? new Date(session.metadata.completedAt).getTime()
      : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  clearCompleted(): void {
    this.sessionManager.clearCompleted();
  }

  private startTicking(): void {
    this.stopTicking();
    this.tickInterval = setInterval(() => this.tick.update((v) => v + 1), 5000);
  }

  private stopTicking(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
