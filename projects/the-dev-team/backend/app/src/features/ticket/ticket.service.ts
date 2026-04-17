import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  Ticket,
  TicketStatus,
  TicketPhase,
  TicketPriority,
  AgentRoleName,
  AgentInstance,
  TicketEvent,
  CreateTicketDto,
  NamePool,
  TransitionTrigger,
  AgentExitReason,
  VALID_TRANSITIONS,
  DEFAULT_NAME_POOL,
} from './ticket.types';

@Injectable()
export class TicketService implements OnModuleInit {
  private readonly logger = new Logger(TicketService.name);
  private readonly repoRoot: string;
  private readonly ticketsDir: string;
  private readonly namesFile: string;
  private readonly memoryDir: string;
  private readonly plansDir: string;
  private tickets = new Map<string, Ticket>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.repoRoot = process.env.REPO_ROOT || '/workspace';
    this.ticketsDir = path.join(this.repoRoot, '.dev-team', 'tickets');
    this.namesFile = path.join(this.repoRoot, '.dev-team', 'names.json');
    this.memoryDir = path.join(this.repoRoot, '.dev-team', 'memory');
    this.plansDir = path.join(this.repoRoot, '.dev-team', 'plans');
  }

  onModuleInit(): void {
    this.ensureDirectories();
    this.ensureNamePool();
    this.loadAllTickets();
    this.logger.log(`Loaded ${this.tickets.size} tickets`);
  }

  // ── Directory setup ───────────────────────────────────────────────

  private ensureDirectories(): void {
    const dirs = [
      this.ticketsDir,
      this.plansDir,
      path.join(this.memoryDir, 'frontend-developer', 'wiki'),
      path.join(this.memoryDir, 'designer', 'wiki'),
      path.join(this.memoryDir, 'devops', 'wiki'),
      path.join(this.memoryDir, 'code-reviewer', 'wiki'),
      path.join(this.memoryDir, 'team-lead', 'wiki'),
    ];
    for (const dir of dirs) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create index.md and log.md stubs for each role wiki
    const roles = ['frontend-developer', 'designer', 'devops', 'code-reviewer', 'team-lead'];
    for (const role of roles) {
      const indexPath = path.join(this.memoryDir, role, 'index.md');
      const logPath = path.join(this.memoryDir, role, 'log.md');
      if (!fs.existsSync(indexPath)) {
        fs.writeFileSync(indexPath, `# ${role} Wiki Index\n\nNo pages yet.\n`);
      }
      if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, `# ${role} Learning Log\n`);
      }
    }
  }

  private ensureNamePool(): void {
    if (!fs.existsSync(this.namesFile)) {
      const pool: NamePool = { pool: [...DEFAULT_NAME_POOL], assigned: {} };
      fs.writeFileSync(this.namesFile, JSON.stringify(pool, null, 2));
    }
  }

  // ── Load / persist ────────────────────────────────────────────────

  loadAllTickets(): Ticket[] {
    this.tickets.clear();
    if (!fs.existsSync(this.ticketsDir)) return [];

    const entries = fs.readdirSync(this.ticketsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const ticketFile = path.join(this.ticketsDir, entry.name, 'ticket.json');
      if (!fs.existsSync(ticketFile)) continue;
      try {
        const raw = fs.readFileSync(ticketFile, 'utf-8');
        const ticket = JSON.parse(raw) as Ticket;
        this.tickets.set(ticket.id, ticket);
      } catch (err) {
        this.logger.warn(`Failed to load ticket ${entry.name}: ${(err as Error).message}`);
      }
    }
    return [...this.tickets.values()];
  }

  private persistTicket(ticket: Ticket): void {
    const dir = path.join(this.ticketsDir, ticket.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.mkdirSync(path.join(dir, 'handoffs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ticket.json'), JSON.stringify(ticket, null, 2));
  }

  // ── CRUD ──────────────────────────────────────────────────────────

  createTicket(dto: CreateTicketDto): Ticket {
    const id = `t-${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();

    const ticket: Ticket = {
      id,
      title: dto.title,
      specPath: dto.specPath,
      planId: dto.planId,
      status: 'created',
      assignedRole: dto.assignedRole,
      activeAgent: null,
      agentHistory: [],
      dependsOn: dto.dependsOn || [],
      priority: dto.priority,
      branch: null,
      worktreePath: null,
      sandboxNamespace: null,
      prNumber: null,
      targetBranch: dto.targetBranch || 'local-scain',
      history: [{ status: 'created', at: now, trigger: 'team-lead' as TransitionTrigger }],
      createdAt: now,
      updatedAt: now,
    };

    this.tickets.set(id, ticket);
    this.persistTicket(ticket);
    this.eventEmitter.emit('ticket.created', ticket);
    this.logger.log(`Created ticket ${id}: "${dto.title}" (${dto.assignedRole})`);
    return ticket;
  }

  getTicket(ticketId: string): Ticket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
    return ticket;
  }

  listTickets(filters?: { status?: TicketStatus; role?: AgentRoleName; planId?: string }): Ticket[] {
    let results = [...this.tickets.values()];
    if (filters?.status) results = results.filter((t) => t.status === filters.status);
    if (filters?.role) results = results.filter((t) => t.assignedRole === filters.role);
    if (filters?.planId) results = results.filter((t) => t.planId === filters.planId);
    return results;
  }

  updateTicketStatus(
    ticketId: string,
    status: TicketStatus,
    trigger: TransitionTrigger,
    detail?: string,
  ): Ticket {
    const ticket = this.getTicket(ticketId);
    const allowed = VALID_TRANSITIONS[ticket.status];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid transition: ${ticket.status} → ${status}. Allowed: ${allowed.join(', ')}`,
      );
    }

    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();
    ticket.history.push({ status, at: ticket.updatedAt, trigger, detail });

    this.persistTicket(ticket);
    this.eventEmitter.emit('ticket.updated', ticket);
    this.logger.log(`Ticket ${ticketId}: ${ticket.history[ticket.history.length - 2]?.status} → ${status} (${trigger})`);
    return ticket;
  }

  updateTicket(ticketId: string, partial: Partial<Ticket>): Ticket {
    const ticket = this.getTicket(ticketId);
    Object.assign(ticket, partial, { updatedAt: new Date().toISOString() });
    this.persistTicket(ticket);
    this.eventEmitter.emit('ticket.updated', ticket);
    return ticket;
  }

  // ── Agent lifecycle on tickets ────────────────────────────────────

  setActiveAgent(ticketId: string, agent: AgentInstance): Ticket {
    const ticket = this.getTicket(ticketId);
    // Retire current agent if exists
    if (ticket.activeAgent) {
      ticket.activeAgent.endedAt = new Date().toISOString();
      ticket.activeAgent.exitReason = ticket.activeAgent.exitReason || 'completed';
      ticket.agentHistory.push(ticket.activeAgent);
    }
    ticket.activeAgent = agent;
    ticket.updatedAt = new Date().toISOString();
    this.persistTicket(ticket);
    this.eventEmitter.emit('ticket.updated', ticket);
    return ticket;
  }

  retireAgent(ticketId: string, exitReason: AgentExitReason): Ticket {
    const ticket = this.getTicket(ticketId);
    if (ticket.activeAgent) {
      ticket.activeAgent.endedAt = new Date().toISOString();
      ticket.activeAgent.exitReason = exitReason;
      ticket.agentHistory.push(ticket.activeAgent);
      ticket.activeAgent = null;
    }
    ticket.updatedAt = new Date().toISOString();
    this.persistTicket(ticket);
    this.eventEmitter.emit('ticket.updated', ticket);
    return ticket;
  }

  // ── Handoff notes ─────────────────────────────────────────────────

  writeHandoff(ticketId: string, phase: string, content: string): string {
    const ticket = this.getTicket(ticketId);
    const handoffsDir = path.join(this.ticketsDir, ticketId, 'handoffs');
    fs.mkdirSync(handoffsDir, { recursive: true });

    // Count existing handoffs to determine sequence number
    const existing = fs.existsSync(handoffsDir)
      ? fs.readdirSync(handoffsDir).filter((f) => f.endsWith('.md'))
      : [];
    const seq = String(existing.length + 1).padStart(3, '0');
    const filename = `${seq}-${phase}.md`;
    const filepath = path.join(handoffsDir, filename);

    // Build frontmatter from active agent
    const agent = ticket.activeAgent;
    const frontmatter = [
      '---',
      `agent: ${agent?.name || 'unknown'}`,
      `role: ${agent?.role || 'unknown'}`,
      `phase: ${phase}`,
      `ticket: ${ticketId}`,
      `at: ${new Date().toISOString()}`,
      '---',
      '',
    ].join('\n');

    fs.writeFileSync(filepath, frontmatter + content);
    this.logger.log(`Wrote handoff ${filename} for ticket ${ticketId}`);
    return filename;
  }

  readHandoffs(ticketId: string): Array<{ filename: string; content: string }> {
    const handoffsDir = path.join(this.ticketsDir, ticketId, 'handoffs');
    if (!fs.existsSync(handoffsDir)) return [];

    return fs
      .readdirSync(handoffsDir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((filename) => ({
        filename,
        content: fs.readFileSync(path.join(handoffsDir, filename), 'utf-8'),
      }));
  }

  // ── Name pool ─────────────────────────────────────────────────────

  pickName(ticketId: string, role: string): string {
    const pool = this.loadNamePool();

    // Check if this ticket+role already has a name (name persistence within same role)
    for (const [name, assignment] of Object.entries(pool.assigned)) {
      if (assignment.ticketId === ticketId && assignment.role === role) {
        return name;
      }
    }

    // Pick a random name from the available pool
    const available = pool.pool.filter((n) => !(n in pool.assigned));
    if (available.length === 0) {
      // Overflow: generate a numbered name
      const name = `Agent-${crypto.randomBytes(2).toString('hex')}`;
      pool.assigned[name] = { ticketId, role, sessionId: '' };
      this.saveNamePool(pool);
      return name;
    }

    const name = available[Math.floor(Math.random() * available.length)];
    pool.assigned[name] = { ticketId, role, sessionId: '' };
    this.saveNamePool(pool);
    return name;
  }

  updateNameSession(name: string, sessionId: string): void {
    const pool = this.loadNamePool();
    if (pool.assigned[name]) {
      pool.assigned[name].sessionId = sessionId;
      this.saveNamePool(pool);
    }
  }

  releaseName(name: string): void {
    const pool = this.loadNamePool();
    delete pool.assigned[name];
    this.saveNamePool(pool);
  }

  private loadNamePool(): NamePool {
    try {
      const raw = fs.readFileSync(this.namesFile, 'utf-8');
      return JSON.parse(raw) as NamePool;
    } catch {
      const pool: NamePool = { pool: [...DEFAULT_NAME_POOL], assigned: {} };
      this.saveNamePool(pool);
      return pool;
    }
  }

  private saveNamePool(pool: NamePool): void {
    fs.writeFileSync(this.namesFile, JSON.stringify(pool, null, 2));
  }

  // ── Role wiki helpers ─────────────────────────────────────────────

  readRoleWikiIndex(role: string): string {
    const indexPath = path.join(this.memoryDir, role, 'index.md');
    if (!fs.existsSync(indexPath)) return '';
    return fs.readFileSync(indexPath, 'utf-8');
  }

  readRoleWikiPage(role: string, page: string): string {
    const pagePath = path.join(this.memoryDir, role, 'wiki', page);
    if (!fs.existsSync(pagePath)) return '';
    return fs.readFileSync(pagePath, 'utf-8');
  }

  listRoleWikiPages(role: string): string[] {
    const wikiDir = path.join(this.memoryDir, role, 'wiki');
    if (!fs.existsSync(wikiDir)) return [];
    return fs.readdirSync(wikiDir).filter((f) => f.endsWith('.md'));
  }
}
