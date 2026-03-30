import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec as execCallback, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { EventEmitter2 } from '@nestjs/event-emitter';

const exec = promisify(execCallback);

/**
 * Minimal env for subprocesses — prevents the parent shell's env vars
 * (e.g. COMPOSE_PROJECT_NAME, BACKEND_PORT) from overriding values
 * that Task loads from the worktree's .env via dotenv.
 */
const CLEAN_ENV: Record<string, string> = {
  PATH: process.env.PATH || '',
  HOME: process.env.HOME || '',
  USER: process.env.USER || '',
};

export interface EnvironmentStepState {
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  detail: string;
}

export interface EnvironmentState {
  index: number;
  worktreePath: string;
  branch: string;
  ports: {
    backend: number;
    frontend: number;
    database: number;
    keycloak: number;
  };
  composeProjectName: string;
  steps: {
    worktree: EnvironmentStepState;
    docker: EnvironmentStepState;
  };
  status: 'setting_up' | 'ready' | 'stopped' | 'error' | 'torn_down';
}

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);
  private readonly repoRoot: string;
  private readonly backlogDir: string;

  /** Active log-streaming child processes keyed by `planId:service` */
  private readonly logStreams = new Map<string, ChildProcess>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
    this.backlogDir = path.join(this.repoRoot, '.coding-agent-data', 'backlog');
  }

  /**
   * Derive a preferred index from the plan ID hex
   */
  private calculatePreferredIndex(planId: string): number {
    const hex = planId.replace(/^p-/, '');
    return parseInt(hex, 16) % 100;
  }

  /**
   * Scan existing environment.json files to find an available index
   */
  private async findAvailableIndex(preferredIndex: number): Promise<number> {
    const usedIndices = new Set<number>();

    try {
      const entries = await fs.readdir(this.backlogDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        try {
          const envPath = path.join(
            this.backlogDir,
            entry.name,
            'environment.json',
          );
          const data = JSON.parse(await fs.readFile(envPath, 'utf-8'));
          if (data.status !== 'torn_down') {
            usedIndices.add(data.index);
          }
        } catch {
          // No environment.json or invalid — skip
        }
      }
    } catch {
      // backlog dir doesn't exist yet
    }

    let index = preferredIndex;
    while (usedIndices.has(index)) {
      index = (index + 1) % 100;
    }
    return index;
  }

  /**
   * Read the plan name from state.json
   */
  private async getPlanName(planId: string): Promise<string> {
    try {
      const statePath = path.join(this.backlogDir, planId, 'state.json');
      const data = JSON.parse(await fs.readFile(statePath, 'utf-8'));
      return data.name || planId;
    } catch {
      return planId;
    }
  }

  /**
   * Slugify a plan name for use as a branch name
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Read base ports from root .env file
   */
  private async readBasePorts(): Promise<{
    backend: number;
    frontend: number;
    database: number;
    keycloak: number;
  }> {
    try {
      const envContent = await fs.readFile(
        path.join(this.repoRoot, '.env'),
        'utf-8',
      );
      const getPort = (key: string, fallback: number): number => {
        const match = envContent.match(new RegExp(`^${key}=(\\d+)`, 'm'));
        return match ? parseInt(match[1], 10) : fallback;
      };
      return {
        backend: getPort('BACKEND_PORT', 8085),
        frontend: getPort('FRONTEND_PORT', 3000),
        database: getPort('DATABASE_PORT', 5437),
        keycloak: getPort('KEYCLOAK_PORT', 8081),
      };
    } catch {
      return { backend: 8085, frontend: 3000, database: 5437, keycloak: 8081 };
    }
  }

  /**
   * Save environment state to disk
   */
  private async saveState(
    envPath: string,
    state: EnvironmentState,
  ): Promise<void> {
    await fs.writeFile(envPath, JSON.stringify(state, null, 2));
  }

  /**
   * Copy root .env to worktree and modify port variables
   */
  private async copyAndModifyEnv(
    worktreePath: string,
    state: EnvironmentState,
  ): Promise<void> {
    const rootEnv = await fs.readFile(
      path.join(this.repoRoot, '.env'),
      'utf-8',
    );
    const modified = rootEnv
      .replace(/^BACKEND_PORT=.*/m, `BACKEND_PORT=${state.ports.backend}`)
      .replace(/^FRONTEND_PORT=.*/m, `FRONTEND_PORT=${state.ports.frontend}`)
      .replace(/^DATABASE_PORT=.*/m, `DATABASE_PORT=${state.ports.database}`)
      .replace(/^KEYCLOAK_PORT=.*/m, `KEYCLOAK_PORT=${state.ports.keycloak}`)
      .replace(
        /^COMPOSE_PROJECT_NAME=.*/m,
        `COMPOSE_PROJECT_NAME=${state.composeProjectName}`,
      );
    await fs.writeFile(path.join(worktreePath, '.env'), modified, 'utf-8');
  }

  /**
   * Kick off environment setup. Returns initial state immediately,
   * runs the actual setup steps asynchronously.
   */
  async setup(planId: string): Promise<EnvironmentState> {
    const envPath = path.join(this.backlogDir, planId, 'environment.json');

    // Check if already set up or in progress
    let state: EnvironmentState | null = null;
    try {
      const existing: EnvironmentState = JSON.parse(
        await fs.readFile(envPath, 'utf-8'),
      );
      if (existing.status === 'ready' || existing.status === 'setting_up') {
        return existing;
      }
      // If errored, retry — reuse existing index/ports/branch to stay consistent
      if (existing.status === 'error') {
        state = {
          ...existing,
          steps: {
            worktree: {
              status: 'in_progress',
              detail: 'Creating worktree and branch...',
            },
            docker: { status: 'pending', detail: '' },
          },
          status: 'setting_up',
        };
      }
    } catch {
      // No existing state — proceed with fresh setup
    }

    if (!state) {
      const preferredIndex = this.calculatePreferredIndex(planId);
      const index = await this.findAvailableIndex(preferredIndex);
      const offset = index * 10;
      const basePorts = await this.readBasePorts();

      const planName = await this.getPlanName(planId);
      const branch = `plan/${this.slugify(planName)}`;

      state = {
        index,
        worktreePath: `.worktrees/${planId}`,
        branch,
        ports: {
          backend: basePorts.backend + offset,
          frontend: basePorts.frontend + offset,
          database: basePorts.database + offset,
          keycloak: basePorts.keycloak + offset,
        },
        composeProjectName: `projects-${planId}`,
        steps: {
          worktree: {
            status: 'in_progress',
            detail: 'Creating worktree and branch...',
          },
          docker: { status: 'pending', detail: '' },
        },
        status: 'setting_up',
      };
    }

    await this.saveState(envPath, state);

    // Fire and forget — frontend polls for status
    this.runSetup(planId, state, envPath).catch((err) => {
      this.logger.error(`Environment setup failed for ${planId}:`, err);
    });

    return state;
  }

  /**
   * Run the setup steps sequentially, updating state file at each phase
   */
  private async runSetup(
    planId: string,
    state: EnvironmentState,
    envPath: string,
  ): Promise<void> {
    const absWorktree = path.join(this.repoRoot, state.worktreePath);

    // Step 1: Worktree + Branch
    try {
      this.logger.log(
        `Creating worktree at ${absWorktree} with branch ${state.branch}`,
      );

      // Check if worktree already exists on disk
      let worktreeExists = false;
      try {
        await fs.access(absWorktree);
        worktreeExists = true;
      } catch {
        // Does not exist
      }

      if (worktreeExists) {
        this.logger.log(`Worktree already exists at ${absWorktree}, reusing`);
      } else {
        // Check if branch already exists
        try {
          await exec(`git rev-parse --verify "${state.branch}"`, {
            cwd: this.repoRoot,
          });
          // Branch exists, create worktree on existing branch
          await exec(
            `git worktree add "${absWorktree}" "${state.branch}"`,
            { cwd: this.repoRoot },
          );
        } catch {
          // Branch doesn't exist, create both
          await exec(
            `git worktree add -b "${state.branch}" "${absWorktree}"`,
            { cwd: this.repoRoot },
          );
        }
      }

      // Copy and modify .env (always, in case ports changed)
      await this.copyAndModifyEnv(absWorktree, state);

      state.steps.worktree = {
        status: 'completed',
        detail: `${absWorktree} (${state.branch})`,
      };
      await this.saveState(envPath, state);
    } catch (err) {
      this.logger.error(`Worktree creation failed:`, err);
      state.steps.worktree = {
        status: 'error',
        detail: err.message || 'Failed to create worktree',
      };
      state.status = 'error';
      await this.saveState(envPath, state);
      return;
    }

    // Step 2: Docker Environment
    state.steps.docker = {
      status: 'in_progress',
      detail: 'Starting services...',
    };
    await this.saveState(envPath, state);

    try {
      this.logger.log(`Starting Docker services in ${absWorktree}`);
      await exec('task start-local', { cwd: absWorktree, env: CLEAN_ENV });

      state.steps.docker = {
        status: 'completed',
        detail: `Ports: backend=${state.ports.backend}, frontend=${state.ports.frontend}, db=${state.ports.database}, keycloak=${state.ports.keycloak}`,
      };
      state.status = 'ready';
    } catch (err) {
      this.logger.error(`Docker startup failed:`, err);
      state.steps.docker = {
        status: 'error',
        detail: err.message || 'Failed to start Docker services',
      };
      state.status = 'error';
    }

    await this.saveState(envPath, state);
  }

  /**
   * Get current environment status for a plan
   */
  async getStatus(planId: string): Promise<EnvironmentState | null> {
    try {
      const envPath = path.join(this.backlogDir, planId, 'environment.json');
      const data = await fs.readFile(envPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Stop Docker services for the plan (graceful stop, keeps containers)
   */
  async stop(planId: string): Promise<EnvironmentState> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    const absWorktree = path.join(this.repoRoot, state.worktreePath);

    this.logger.log(`Stopping services for ${planId}`);
    await exec('task stop-local', { cwd: absWorktree, env: CLEAN_ENV });

    state.status = 'stopped';
    const envPath = path.join(this.backlogDir, planId, 'environment.json');
    await this.saveState(envPath, state);
    return state;
  }

  /**
   * Start Docker services for a previously stopped environment
   */
  async start(planId: string): Promise<EnvironmentState> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    const absWorktree = path.join(this.repoRoot, state.worktreePath);

    this.logger.log(`Starting services for ${planId}`);
    await exec('task start-local', { cwd: absWorktree, env: CLEAN_ENV });

    state.status = 'ready';
    const envPath = path.join(this.backlogDir, planId, 'environment.json');
    await this.saveState(envPath, state);
    return state;
  }

  /**
   * Get logs from Docker services
   */
  async getLogs(planId: string, tail: number = 200): Promise<string> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    const absWorktree = path.join(this.repoRoot, state.worktreePath);
    const env = await this.buildWorktreeEnv(absWorktree);

    this.logger.log(`Fetching logs for ${planId}`);
    const { stdout } = await exec(
      `cd projects && docker compose logs --tail=${tail}`,
      { cwd: absWorktree, env, maxBuffer: 1024 * 1024 * 5 },
    );
    return stdout;
  }

  /**
   * Run health checks against the environment
   */
  async healthCheck(planId: string): Promise<{ services: Array<{ name: string; healthy: boolean; detail: string }> }> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }

    const services: Array<{ name: string; healthy: boolean; detail: string }> = [];

    // Check backend
    try {
      await exec(`curl -sf http://localhost:${state.ports.backend}/health`, { env: CLEAN_ENV });
      services.push({ name: 'backend', healthy: true, detail: `Port ${state.ports.backend}` });
    } catch {
      services.push({ name: 'backend', healthy: false, detail: `Port ${state.ports.backend} - not responding` });
    }

    // Check frontend
    try {
      await exec(`curl -sf http://localhost:${state.ports.frontend}`, { env: CLEAN_ENV });
      services.push({ name: 'frontend', healthy: true, detail: `Port ${state.ports.frontend}` });
    } catch {
      services.push({ name: 'frontend', healthy: false, detail: `Port ${state.ports.frontend} - not responding` });
    }

    // Check database
    try {
      await exec(`nc -z localhost ${state.ports.database}`, { env: CLEAN_ENV, timeout: 5000 });
      services.push({ name: 'database', healthy: true, detail: `Port ${state.ports.database}` });
    } catch {
      services.push({ name: 'database', healthy: false, detail: `Port ${state.ports.database} - not responding` });
    }

    // Check keycloak
    try {
      await exec(`curl -sf http://localhost:${state.ports.keycloak}`, { env: CLEAN_ENV });
      services.push({ name: 'keycloak', healthy: true, detail: `Port ${state.ports.keycloak}` });
    } catch {
      services.push({ name: 'keycloak', healthy: false, detail: `Port ${state.ports.keycloak} - not responding` });
    }

    return { services };
  }

  /**
   * Get Docker container status for the environment
   */
  async getContainerStatus(planId: string): Promise<string> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    const absWorktree = path.join(this.repoRoot, state.worktreePath);
    const env = await this.buildWorktreeEnv(absWorktree);

    const { stdout } = await exec('cd projects && docker compose ps', {
      cwd: absWorktree,
      env,
    });
    return stdout;
  }

  /**
   * Restart Docker services (stop then start)
   */
  async restart(planId: string): Promise<EnvironmentState> {
    await this.stop(planId);
    return this.start(planId);
  }

  /**
   * Purge and restart: full teardown of containers/volumes, rebuild, and start fresh
   */
  async purgeAndRestart(planId: string): Promise<EnvironmentState> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    const absWorktree = path.join(this.repoRoot, state.worktreePath);

    this.logger.log(`Purging and restarting for ${planId}`);
    await exec('task purge-and-restart-local', {
      cwd: absWorktree,
      env: CLEAN_ENV,
    });

    state.status = 'ready';
    const envPath = path.join(this.backlogDir, planId, 'environment.json');
    await this.saveState(envPath, state);
    return state;
  }

  // ── Per-service operations ──

  private readonly SERVICES = ['database', 'backend', 'keycloak', 'frontend'];

  /**
   * Get docker compose status for each service individually
   */
  async getServiceStatuses(
    planId: string,
  ): Promise<
    Array<{
      name: string;
      state: string;
      status: string;
      ports: string;
    }>
  > {
    const envState = await this.getStatus(planId);
    if (!envState) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    const absWorktree = path.join(this.repoRoot, envState.worktreePath);
    const env = await this.buildWorktreeEnv(absWorktree);

    const results: Array<{
      name: string;
      state: string;
      status: string;
      ports: string;
    }> = [];

    try {
      const { stdout } = await exec(
        'cd projects && docker compose ps --format json',
        { cwd: absWorktree, env, maxBuffer: 1024 * 1024 },
      );
      // docker compose ps --format json outputs one JSON object per line
      const lines = stdout.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const svc = JSON.parse(line);
          results.push({
            name: svc.Service || svc.Name || 'unknown',
            state: svc.State || 'unknown',
            status: svc.Status || '',
            ports: svc.Ports || '',
          });
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // compose ps failed — return all services as unknown
      for (const name of this.SERVICES) {
        results.push({ name, state: 'unknown', status: '', ports: '' });
      }
    }

    return results;
  }

  /**
   * Stop a single docker compose service
   */
  async stopService(planId: string, service: string): Promise<void> {
    this.validateServiceName(service);
    const absWorktree = await this.getWorktreePath(planId);
    const env = await this.buildWorktreeEnv(absWorktree);
    this.logger.log(`Stopping service ${service} for ${planId}`);
    await exec(`cd projects && docker compose stop ${service}`, {
      cwd: absWorktree,
      env,
    });
  }

  /**
   * Start a single docker compose service
   */
  async startService(planId: string, service: string): Promise<void> {
    this.validateServiceName(service);
    const absWorktree = await this.getWorktreePath(planId);
    const env = await this.buildWorktreeEnv(absWorktree);
    this.logger.log(`Starting service ${service} for ${planId}`);
    await exec(`cd projects && docker compose up -d ${service}`, {
      cwd: absWorktree,
      env,
    });
  }

  /**
   * Restart a single docker compose service
   */
  async restartService(planId: string, service: string): Promise<void> {
    this.validateServiceName(service);
    const absWorktree = await this.getWorktreePath(planId);
    const env = await this.buildWorktreeEnv(absWorktree);
    this.logger.log(`Restarting service ${service} for ${planId}`);
    await exec(`cd projects && docker compose restart ${service}`, {
      cwd: absWorktree,
      env,
    });
  }

  /**
   * Rebuild and restart a single docker compose service
   */
  async rebuildService(planId: string, service: string): Promise<void> {
    this.validateServiceName(service);
    const absWorktree = await this.getWorktreePath(planId);
    const env = await this.buildWorktreeEnv(absWorktree);
    this.logger.log(`Rebuilding service ${service} for ${planId}`);
    await exec(
      `cd projects && docker compose stop ${service} && docker compose rm -f ${service} && docker compose build --no-cache ${service} && docker compose up -d ${service}`,
      { cwd: absWorktree, env },
    );
  }

  /**
   * Get logs for a single service
   */
  async getServiceLogs(
    planId: string,
    service: string,
    tail: number = 200,
  ): Promise<string> {
    this.validateServiceName(service);
    const absWorktree = await this.getWorktreePath(planId);
    const env = await this.buildWorktreeEnv(absWorktree);
    this.logger.log(`Fetching logs for ${service} in ${planId}`);
    const { stdout } = await exec(
      `cd projects && docker compose logs --tail=${tail} ${service}`,
      { cwd: absWorktree, env, maxBuffer: 1024 * 1024 * 5 },
    );
    return stdout;
  }

  /**
   * Run health check for a single service
   */
  async healthCheckService(
    planId: string,
    service: string,
  ): Promise<{ healthy: boolean; detail: string }> {
    this.validateServiceName(service);
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }

    const portMap: Record<string, number> = {
      backend: state.ports.backend,
      frontend: state.ports.frontend,
      database: state.ports.database,
      keycloak: state.ports.keycloak,
    };
    const port = portMap[service];

    try {
      if (service === 'database') {
        // Use nc to check TCP connectivity — pg_isready may not be on the host
        await exec(
          `nc -z localhost ${port}`,
          { env: CLEAN_ENV, timeout: 5000 },
        );
      } else if (service === 'backend') {
        await exec(`curl -sf --max-time 5 http://localhost:${port}/health`, {
          env: CLEAN_ENV,
        });
      } else {
        await exec(`curl -sf --max-time 5 http://localhost:${port}`, {
          env: CLEAN_ENV,
        });
      }
      return { healthy: true, detail: `Port ${port}` };
    } catch {
      return { healthy: false, detail: `Port ${port} - not responding` };
    }
  }

  private validateServiceName(service: string): void {
    if (!this.SERVICES.includes(service)) {
      throw new Error(
        `Invalid service name: ${service}. Valid: ${this.SERVICES.join(', ')}`,
      );
    }
  }

  private async getWorktreePath(planId: string): Promise<string> {
    const state = await this.getStatus(planId);
    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }
    return path.join(this.repoRoot, state.worktreePath);
  }

  // ── Log streaming ──

  /**
   * Start streaming docker compose logs for a service (or all services).
   * Emits `env:logs:line` events via EventEmitter2.
   * Returns a stream key that can be used to stop streaming.
   */
  /**
   * Read the worktree's .env and merge with CLEAN_ENV so docker compose
   * can resolve variable interpolation (ports, db creds, etc.).
   */
  private async buildWorktreeEnv(
    absWorktree: string,
  ): Promise<Record<string, string>> {
    const env = { ...CLEAN_ENV };
    try {
      const content = await fs.readFile(
        path.join(absWorktree, '.env'),
        'utf-8',
      );
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
        }
      }
    } catch {
      // No .env file — proceed with CLEAN_ENV only
    }
    return env;
  }

  async startLogStream(planId: string, service?: string): Promise<string> {
    if (service) this.validateServiceName(service);
    const absWorktree = await this.getWorktreePath(planId);
    const streamKey = `${planId}:${service || 'all'}`;

    // Kill any existing stream for this key
    this.stopLogStream(streamKey);

    const worktreeEnv = await this.buildWorktreeEnv(absWorktree);

    const args = ['compose', 'logs', '-f', '--tail=200'];
    if (service) args.push(service);

    const child = spawn('docker', args, {
      cwd: path.join(absWorktree, 'projects'),
      env: worktreeEnv,
    });

    this.logStreams.set(streamKey, child);

    const emitLine = (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line) {
          this.eventEmitter.emit('env:logs:line', { streamKey, line });
        }
      }
    };

    child.stdout?.on('data', emitLine);
    child.stderr?.on('data', emitLine);

    child.on('close', (code) => {
      this.logStreams.delete(streamKey);
      this.eventEmitter.emit('env:logs:end', { streamKey, code });
    });

    child.on('error', (err) => {
      this.logger.error(`Log stream error for ${streamKey}: ${err.message}`);
      this.logStreams.delete(streamKey);
      this.eventEmitter.emit('env:logs:end', { streamKey, code: -1 });
    });

    return streamKey;
  }

  /**
   * Stop a running log stream
   */
  stopLogStream(streamKey: string): void {
    const child = this.logStreams.get(streamKey);
    if (child) {
      child.kill();
      this.logStreams.delete(streamKey);
    }
  }

  /**
   * Tear down the environment: stop Docker, remove worktree, delete branch, remove state
   */
  async teardown(planId: string): Promise<EnvironmentState> {
    const envPath = path.join(this.backlogDir, planId, 'environment.json');
    const state = await this.getStatus(planId);

    if (!state) {
      throw new Error(`No environment found for plan ${planId}`);
    }

    const absWorktree = path.join(this.repoRoot, state.worktreePath);

    // Stop and remove Docker services
    try {
      this.logger.log(`Tearing down Docker for ${planId}`);
      await exec('task purge-local', { cwd: absWorktree, env: CLEAN_ENV });
    } catch (err) {
      this.logger.warn(`Docker teardown failed (may already be stopped): ${err.message}`);
    }

    // Remove worktree
    try {
      this.logger.log(`Removing worktree at ${absWorktree}`);
      await exec(`rm -rf "${absWorktree}"`, { cwd: this.repoRoot });
      await exec('git worktree prune', { cwd: this.repoRoot });
    } catch (err) {
      this.logger.warn(`Worktree removal failed: ${err.message}`);
    }

    // Delete branch
    try {
      this.logger.log(`Deleting branch ${state.branch}`);
      await exec(`git branch -D "${state.branch}"`, { cwd: this.repoRoot });
    } catch (err) {
      this.logger.warn(`Branch deletion failed (may not exist): ${err.message}`);
    }

    // Remove state file
    try {
      await fs.unlink(envPath);
    } catch {
      // Already gone
    }

    state.status = 'torn_down';
    return state;
  }
}
