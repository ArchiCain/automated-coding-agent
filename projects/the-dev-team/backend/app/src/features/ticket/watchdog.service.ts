import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { TicketService } from './ticket.service';
import { Ticket, TicketStatus, ACTIVE_STATUSES } from './ticket.types';

/** Max time (ms) a ticket can stay in each active status before the watchdog intervenes */
const MAX_DURATIONS: Partial<Record<TicketStatus, number>> = {
  in_progress: 45 * 60 * 1000,       // 45 min
  sandbox_deploying: 10 * 60 * 1000, // 10 min
  self_testing: 30 * 60 * 1000,      // 30 min
  code_reviewing: 20 * 60 * 1000,    // 20 min
  design_reviewing: 20 * 60 * 1000,  // 20 min
};

@Injectable()
export class WatchdogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WatchdogService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 60_000;

  constructor(
    private readonly ticketService: TicketService,
    private readonly agentService: AgentService,
  ) {}

  onModuleInit(): void {
    // First check after 30s to let things stabilize on startup
    setTimeout(() => {
      void this.check();
      this.timer = setInterval(() => void this.check(), this.CHECK_INTERVAL_MS);
    }, 30_000);
    this.logger.log(`Watchdog started, checking every ${this.CHECK_INTERVAL_MS / 1000}s`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async check(): Promise<void> {
    try {
      const tickets = this.ticketService.loadAllTickets();
      for (const ticket of tickets) {
        if (!ACTIVE_STATUSES.includes(ticket.status)) continue;
        if (!ticket.activeAgent) continue;

        // Check 1: Is the agent session still alive?
        const sessionAlive = this.isSessionAlive(ticket.activeAgent.sessionId);
        if (!sessionAlive) {
          this.logger.warn(
            `Agent "${ticket.activeAgent.name}" (session ${ticket.activeAgent.sessionId.slice(0, 8)}) ` +
            `crashed for ticket ${ticket.id}. Marking stalled.`,
          );
          this.ticketService.retireAgent(ticket.id, 'crashed');
          this.ticketService.updateTicketStatus(ticket.id, 'stalled', 'watchdog',
            `Agent "${ticket.activeAgent?.name}" session died`);
          continue;
        }

        // Check 2: Has the ticket been in this status too long?
        const maxDuration = MAX_DURATIONS[ticket.status];
        if (maxDuration) {
          const elapsed = Date.now() - new Date(ticket.activeAgent.startedAt).getTime();
          if (elapsed > maxDuration) {
            this.logger.warn(
              `Agent "${ticket.activeAgent.name}" stuck on ticket ${ticket.id} ` +
              `(${ticket.status} for ${Math.round(elapsed / 60000)}min). Killing and marking stalled.`,
            );
            // Try to cancel the session
            try {
              this.agentService.cancelSession(ticket.activeAgent.sessionId);
            } catch {
              // Session may already be gone
            }
            this.ticketService.retireAgent(ticket.id, 'watchdog_killed');
            this.ticketService.updateTicketStatus(ticket.id, 'stalled', 'watchdog',
              `Agent stuck for ${Math.round(elapsed / 60000)}min, killed by watchdog`);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Watchdog check failed: ${(err as Error).message}`);
    }
  }

  private isSessionAlive(sessionId: string): boolean {
    try {
      const session = this.agentService.getSession(sessionId);
      return session !== undefined;
    } catch {
      return false;
    }
  }
}
