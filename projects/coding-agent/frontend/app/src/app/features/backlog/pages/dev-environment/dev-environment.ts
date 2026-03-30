import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { DecompositionService } from '../../../decomposition/services/decomposition.service';
import {
  BacklogService,
  EnvironmentState,
  ServiceStatus,
} from '../../services/backlog.service';
import { SlideOverComponent } from '../../../ui-components';
import { TaskService } from '../../../tasks';
import {
  EnvironmentInfoBarComponent,
  DockerControlsBarComponent,
  DockerServicesGridComponent,
  DockerService,
  DockerStatusMap,
} from '../../../local-env';
import { environment } from '../../../../../environments/environment';

interface EnvironmentStep {
  id: string;
  label: string;
  description: string;
  icon: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  detail: string;
}

/** UI model for a single docker service card */
interface ServiceCard {
  name: string;
  icon: string;
  port: number;
  state: string; // docker state: running, exited, etc.
  status: string; // docker status detail
  healthy: boolean | null; // null = not checked
  healthChecking: boolean;
  stopping: boolean;
  starting: boolean;
  restarting: boolean;
  rebuilding: boolean;
}

const SERVICE_ICONS: Record<string, string> = {
  backend: 'api',
  frontend: 'web',
  database: 'storage',
  keycloak: 'lock',
};

@Component({
  selector: 'app-dev-environment',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    SlideOverComponent,
    EnvironmentInfoBarComponent,
    DockerControlsBarComponent,
    DockerServicesGridComponent,
  ],
  templateUrl: './dev-environment.html',
  styleUrl: './dev-environment.scss',
})
export class DevEnvironmentComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private agentService = inject(ClaudeCodeAgentService);
  private decompositionService = inject(DecompositionService);
  private backlogService = inject(BacklogService);
  private taskService = inject(TaskService);

  planId = signal<string>('');
  planName = signal<string>('');
  planLoading = signal(true);

  // Slide-over state
  slideOverOpen = signal(false);
  slideOverTitle = signal('');
  slideOverContent = signal('');
  slideOverLoading = signal(false);
  slideOverRaw = signal(false);
  slideOverPosition = signal<'right' | 'bottom'>('right');

  // Environment setup state
  settingUp = signal(false);
  environmentError = signal(false);
  tearingDown = signal(false);

  // Environment info from backend
  environmentState = signal<EnvironmentState | null>(null);

  // Service cards
  services = signal<ServiceCard[]>([]);

  // Global operations
  allStopping = signal(false);
  allStarting = signal(false);
  allRestarting = signal(false);

  steps = signal<EnvironmentStep[]>([
    {
      id: 'worktree',
      label: 'Worktree + Branch',
      description: 'Create a git worktree and feature branch for isolated development',
      icon: 'account_tree',
      status: 'pending',
      detail: '',
    },
    {
      id: 'docker',
      label: 'Docker Environment',
      description: 'Start the application in Docker with dedicated ports',
      icon: 'dns',
      status: 'pending',
      detail: '',
    },
  ]);

  /** True when environment exists (ready or stopped) */
  environmentExists = computed(() => {
    const s = this.environmentState();
    return s != null && (s.status === 'ready' || s.status === 'stopped');
  });

  environmentReady = computed(() => {
    const s = this.environmentState();
    return s != null && s.status === 'ready';
  });

  environmentStopped = computed(() => {
    const s = this.environmentState();
    return s != null && s.status === 'stopped';
  });

  /** Task prefix for worktree environment operations */
  taskPrefix = computed(() => `env:${this.planId()}`);

  /** Branch name from environment state */
  branch = computed(() => this.environmentState()?.branch || '');

  /** Worktree path from environment state */
  worktreePath = computed(() => this.environmentState()?.worktreePath || '');

  /** Docker services derived from environment state for shared grid component */
  dockerServices = computed<DockerService[]>(() => {
    const env = this.environmentState();
    if (!env) return [];

    const SERVICE_ICONS: Record<string, string> = {
      backend: 'api',
      frontend: 'web',
      database: 'storage',
      keycloak: 'lock',
    };

    const knownNames = ['database', 'backend', 'keycloak', 'frontend'];
    const portMap: Record<string, number> = {
      backend: env.ports.backend,
      frontend: env.ports.frontend,
      database: env.ports.database,
      keycloak: env.ports.keycloak,
    };

    return knownNames.map((name) => ({
      id: name,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      icon: SERVICE_ICONS[name] || 'dns',
      basePort: portMap[name] || 0,
      port: portMap[name] || 0,
    }));
  });

  /** Docker status map derived from services signal for shared grid component */
  dockerStatusMap = computed<DockerStatusMap>(() => {
    const svcs = this.services();
    const map: DockerStatusMap = {};
    for (const svc of svcs) {
      // Parse health from status text (e.g., "Up 17 hours (healthy)")
      const healthMatch = svc.status?.match(/\((healthy|unhealthy|starting)\)/i);
      const parsedHealth = healthMatch ? healthMatch[1].toLowerCase() as 'healthy' | 'unhealthy' | 'starting' : null;

      // Strip health info from status text for uptime display
      const uptime = svc.status?.replace(/\s*\([^)]*\)\s*$/, '') || undefined;

      // Use explicit healthy flag if set, otherwise fall back to parsed health
      let health: 'healthy' | 'unhealthy' | 'starting' | null = null;
      if (svc.healthy === true) health = 'healthy';
      else if (svc.healthy === false) health = 'unhealthy';
      else if (parsedHealth) health = parsedHealth;

      map[svc.name] = {
        state: this.mapState(svc.state),
        health,
        uptime,
      };
    }
    return map;
  });

  /** Map string state to typed state */
  private mapState(state: string): 'running' | 'exited' | 'dead' | 'restarting' | 'created' | 'unknown' {
    switch (state) {
      case 'running':
      case 'exited':
      case 'dead':
      case 'restarting':
      case 'created':
        return state;
      default:
        return 'unknown';
    }
  }

  private pollSubscription?: Subscription;
  private servicesPollSubscription?: Subscription;
  private envSocket?: Socket;
  private activeStreamKey?: string;

  ngOnInit(): void {
    const planId = this.route.snapshot.paramMap.get('planId') || '';
    this.planId.set(planId);
    this.loadPlanInfo(planId);
    this.checkExistingEnvironment(planId);
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
    this.servicesPollSubscription?.unsubscribe();
    this.disconnectLogStream();
  }

  private loadPlanInfo(planId: string): void {
    this.planLoading.set(true);
    this.decompositionService.getPlanInfo(planId).subscribe({
      next: (plan) => {
        this.planName.set(plan.name);
        this.planLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load plan info:', err);
        this.planName.set(planId);
        this.planLoading.set(false);
      },
    });
  }

  private checkExistingEnvironment(planId: string): void {
    this.backlogService.getEnvironmentStatus(planId).subscribe({
      next: (env) => {
        this.environmentState.set(env);
        this.updateSteps(env);
        if (env.status === 'setting_up') {
          this.settingUp.set(true);
          this.startSetupPolling();
        } else if (env.status === 'ready' || env.status === 'stopped') {
          this.loadServiceStatuses();
          this.startServicePolling();
        }
      },
      error: () => {
        // No existing environment
      },
    });
  }

  // ── Setup flow ──

  setupEnvironment(): void {
    this.settingUp.set(true);
    this.environmentError.set(false);

    this.backlogService.setupEnvironment(this.planId()).subscribe({
      next: (env) => {
        this.environmentState.set(env);
        this.updateSteps(env);
        this.startSetupPolling();
      },
      error: (err) => {
        console.error('Failed to start environment setup:', err);
        this.settingUp.set(false);
        this.environmentError.set(true);
      },
    });
  }

  private startSetupPolling(): void {
    this.pollSubscription?.unsubscribe();

    this.pollSubscription = interval(3000)
      .pipe(
        switchMap(() => this.backlogService.getEnvironmentStatus(this.planId())),
        takeWhile((env) => env.status === 'setting_up', true),
      )
      .subscribe({
        next: (env) => {
          this.environmentState.set(env);
          this.updateSteps(env);
          if (env.status === 'ready') {
            this.settingUp.set(false);
            this.loadServiceStatuses();
            this.startServicePolling();
          }
          if (env.status === 'error') {
            this.settingUp.set(false);
            this.environmentError.set(true);
          }
        },
        error: (err) => {
          console.error('Polling error:', err);
          this.settingUp.set(false);
          this.environmentError.set(true);
        },
      });
  }

  private updateSteps(env: EnvironmentState): void {
    this.steps.set([
      {
        id: 'worktree',
        label: 'Worktree + Branch',
        description: 'Create a git worktree and feature branch for isolated development',
        icon: 'account_tree',
        status: env.steps.worktree.status,
        detail: env.steps.worktree.detail,
      },
      {
        id: 'docker',
        label: 'Docker Environment',
        description: 'Start the application in Docker with dedicated ports',
        icon: 'dns',
        status: env.steps.docker.status,
        detail: env.steps.docker.detail,
      },
    ]);
  }

  getStatusIcon(step: EnvironmentStep): string {
    switch (step.status) {
      case 'completed': return 'check_circle';
      case 'in_progress': return 'hourglass_top';
      case 'error': return 'error';
      default: return 'radio_button_unchecked';
    }
  }

  getStatusClass(step: EnvironmentStep): string {
    return step.status;
  }

  // ── Service cards ──

  private loadServiceStatuses(): void {
    const env = this.environmentState();
    if (!env) return;

    this.backlogService.getServiceStatuses(this.planId()).subscribe({
      next: (statuses) => {
        this.mergeServiceStatuses(statuses, env);
      },
      error: () => {
        // Build default cards from known ports
        this.buildDefaultCards(env);
      },
    });
  }

  private mergeServiceStatuses(statuses: ServiceStatus[], env: EnvironmentState): void {
    const portMap: Record<string, number> = {
      backend: env.ports.backend,
      frontend: env.ports.frontend,
      database: env.ports.database,
      keycloak: env.ports.keycloak,
    };
    const existing = this.services();
    const knownNames = ['database', 'backend', 'keycloak', 'frontend'];

    const cards: ServiceCard[] = knownNames.map((name) => {
      const status = statuses.find((s) => s.name === name);
      const prev = existing.find((s) => s.name === name);
      return {
        name,
        icon: SERVICE_ICONS[name] || 'dns',
        port: portMap[name] || 0,
        state: status?.state || 'unknown',
        status: status?.status || '',
        healthy: prev?.healthy ?? null,
        healthChecking: prev?.healthChecking ?? false,
        stopping: prev?.stopping ?? false,
        starting: prev?.starting ?? false,
        restarting: prev?.restarting ?? false,
        rebuilding: prev?.rebuilding ?? false,
      };
    });

    this.services.set(cards);
  }

  private buildDefaultCards(env: EnvironmentState): void {
    const portMap: Record<string, number> = {
      backend: env.ports.backend,
      frontend: env.ports.frontend,
      database: env.ports.database,
      keycloak: env.ports.keycloak,
    };
    const knownNames = ['database', 'backend', 'keycloak', 'frontend'];
    this.services.set(
      knownNames.map((name) => ({
        name,
        icon: SERVICE_ICONS[name] || 'dns',
        port: portMap[name] || 0,
        state: 'unknown',
        status: '',
        healthy: null,
        healthChecking: false,
        stopping: false,
        starting: false,
        restarting: false,
        rebuilding: false,
      })),
    );
  }

  private startServicePolling(): void {
    this.servicesPollSubscription?.unsubscribe();
    this.servicesPollSubscription = interval(10000).subscribe(() => {
      if (this.environmentExists()) {
        this.loadServiceStatuses();
      }
    });
  }

  isServiceRunning(svc: ServiceCard): boolean {
    return svc.state === 'running';
  }

  isServiceBusy(svc: ServiceCard): boolean {
    return svc.stopping || svc.starting || svc.restarting || svc.rebuilding;
  }

  // ── Per-service actions ──

  private updateService(name: string, patch: Partial<ServiceCard>): void {
    this.services.update((svcs) =>
      svcs.map((s) => (s.name === name ? { ...s, ...patch } : s)),
    );
  }

  stopService(svc: ServiceCard): void {
    this.updateService(svc.name, { stopping: true });
    this.backlogService.stopService(this.planId(), svc.name).subscribe({
      next: () => {
        this.updateService(svc.name, { stopping: false, state: 'exited', healthy: null });
        this.loadServiceStatuses();
      },
      error: () => this.updateService(svc.name, { stopping: false }),
    });
  }

  startService(svc: ServiceCard): void {
    this.updateService(svc.name, { starting: true });
    this.backlogService.startService(this.planId(), svc.name).subscribe({
      next: () => {
        this.updateService(svc.name, { starting: false, state: 'running', healthy: null });
        this.loadServiceStatuses();
      },
      error: () => this.updateService(svc.name, { starting: false }),
    });
  }

  restartService(svc: ServiceCard): void {
    this.updateService(svc.name, { restarting: true });
    this.backlogService.restartService(this.planId(), svc.name).subscribe({
      next: () => {
        this.updateService(svc.name, { restarting: false, healthy: null });
        this.loadServiceStatuses();
      },
      error: () => this.updateService(svc.name, { restarting: false }),
    });
  }

  rebuildService(svc: ServiceCard): void {
    this.updateService(svc.name, { rebuilding: true });
    this.backlogService.rebuildService(this.planId(), svc.name).subscribe({
      next: () => {
        this.updateService(svc.name, { rebuilding: false, healthy: null });
        this.loadServiceStatuses();
      },
      error: () => this.updateService(svc.name, { rebuilding: false }),
    });
  }

  checkHealth(svc: ServiceCard): void {
    this.updateService(svc.name, { healthChecking: true });
    this.backlogService.healthCheckService(this.planId(), svc.name).subscribe({
      next: (result) => {
        this.updateService(svc.name, { healthChecking: false, healthy: result.healthy });
      },
      error: () => {
        this.updateService(svc.name, { healthChecking: false, healthy: false });
      },
    });
  }

  viewServiceLogs(svc: ServiceCard): void {
    this.slideOverTitle.set(`${svc.name} logs`);
    this.slideOverRaw.set(true);
    this.slideOverPosition.set('bottom');
    this.slideOverLoading.set(false);
    this.slideOverContent.set('');
    this.slideOverOpen.set(true);
    this.startLogStream(svc.name);
  }

  /** Handle logs requested from shared DockerServicesGridComponent */
  handleLogsRequested(service: DockerService): void {
    this.slideOverTitle.set(`${service.name} logs`);
    this.slideOverRaw.set(true);
    this.slideOverPosition.set('bottom');
    this.slideOverLoading.set(false);
    this.slideOverContent.set('');
    this.slideOverOpen.set(true);
    this.startLogStream(service.id);
  }

  /** Refresh service statuses after an operation completes */
  refreshStatus(): void {
    this.loadServiceStatuses();
  }

  // ── Global actions ──

  stopAllServices(): void {
    this.allStopping.set(true);
    this.backlogService.stopEnvironment(this.planId()).subscribe({
      next: (env) => {
        this.allStopping.set(false);
        this.environmentState.set(env);
        this.loadServiceStatuses();
      },
      error: () => this.allStopping.set(false),
    });
  }

  startAllServices(): void {
    this.allStarting.set(true);
    this.backlogService.startEnvironment(this.planId()).subscribe({
      next: (env) => {
        this.allStarting.set(false);
        this.environmentState.set(env);
        this.loadServiceStatuses();
      },
      error: () => this.allStarting.set(false),
    });
  }

  purgeAndRestartAll(): void {
    this.allRestarting.set(true);
    this.backlogService.purgeAndRestartEnvironment(this.planId()).subscribe({
      next: (env) => {
        this.allRestarting.set(false);
        this.environmentState.set(env);
        this.loadServiceStatuses();
      },
      error: () => this.allRestarting.set(false),
    });
  }

  checkAllHealth(): void {
    for (const svc of this.services()) {
      this.checkHealth(svc);
    }
  }

  viewAllLogs(): void {
    this.slideOverTitle.set('All service logs');
    this.slideOverRaw.set(true);
    this.slideOverPosition.set('bottom');
    this.slideOverLoading.set(false);
    this.slideOverContent.set('');
    this.slideOverOpen.set(true);
    this.startLogStream();
  }

  // ── Slide-over / Plan viewer ──

  viewPlanFile(): void {
    this.slideOverTitle.set(this.planName() + ' - plan.md');
    this.slideOverRaw.set(false);
    this.slideOverPosition.set('right');
    this.slideOverLoading.set(true);
    this.slideOverContent.set('');
    this.slideOverOpen.set(true);

    const planPath = `.coding-agent-data/backlog/${this.planId()}/plan.md`;
    this.agentService.readDocument(planPath).subscribe({
      next: (response) => {
        this.slideOverContent.set(response.content);
        this.slideOverLoading.set(false);
      },
      error: () => {
        this.slideOverContent.set('Error loading plan file');
        this.slideOverLoading.set(false);
      },
    });
  }

  closeSlideOver(): void {
    this.slideOverOpen.set(false);
    this.slideOverContent.set('');
    this.disconnectLogStream();
  }

  // ── Log streaming via WebSocket ──

  private startLogStream(service?: string): void {
    this.disconnectLogStream();

    const socket = io(`${environment.wsUrl}/environment`, {
      transports: ['websocket'],
    });
    this.envSocket = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:logs', {
        planId: this.planId(),
        service,
      });
    });

    socket.on('logs:subscribed', (data: { streamKey: string }) => {
      this.activeStreamKey = data.streamKey;
    });

    socket.on('logs:line', (data: { line: string }) => {
      this.slideOverContent.update((prev) => prev + data.line + '\n');
    });

    socket.on('logs:error', (data: { message: string }) => {
      this.slideOverContent.update(
        (prev) => prev + `\n[Error: ${data.message}]\n`,
      );
    });

    socket.on('logs:end', () => {
      this.slideOverContent.update(
        (prev) => prev + '\n[Stream ended]\n',
      );
    });
  }

  private disconnectLogStream(): void {
    if (this.envSocket) {
      if (this.activeStreamKey) {
        this.envSocket.emit('unsubscribe:logs', {
          streamKey: this.activeStreamKey,
        });
        this.activeStreamKey = undefined;
      }
      this.envSocket.disconnect();
      this.envSocket = undefined;
    }
  }

  // ── Environment lifecycle ──

  teardownEnvironment(): void {
    this.tearingDown.set(true);
    this.servicesPollSubscription?.unsubscribe();
    this.backlogService.teardownEnvironment(this.planId()).subscribe({
      next: () => {
        this.tearingDown.set(false);
        this.environmentState.set(null);
        this.environmentError.set(false);
        this.settingUp.set(false);
        this.services.set([]);
        this.slideOverOpen.set(false);
        this.steps.set([
          {
            id: 'worktree',
            label: 'Worktree + Branch',
            description: 'Create a git worktree and feature branch for isolated development',
            icon: 'account_tree',
            status: 'pending',
            detail: '',
          },
          {
            id: 'docker',
            label: 'Docker Environment',
            description: 'Start the application in Docker with dedicated ports',
            icon: 'dns',
            status: 'pending',
            detail: '',
          },
        ]);
      },
      error: (err) => {
        console.error('Teardown failed:', err);
        this.tearingDown.set(false);
      },
    });
  }

  startExecution(): void {
    this.router.navigate(['/backlog/plan', this.planId(), 'projects']);
  }

  goBack(): void {
    this.router.navigate(['/backlog']);
  }
}
