import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { AgentService } from '../agent/agent.service';
import { TicketService } from './ticket.service';
import { Ticket, TicketPhase, TicketStatus, AgentInstance, ACTIVE_STATUSES } from './ticket.types';

const execFile = promisify(execFileCb);

@Injectable()
export class TicketEngineService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketEngineService.name);
  private readonly repoRoot: string;
  private timer: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 10_000;
  private polling = false;

  constructor(
    private readonly ticketService: TicketService,
    private readonly agentService: AgentService,
  ) {
    this.repoRoot = process.env.REPO_ROOT || '/workspace';
  }

  onModuleInit(): void {
    // DISABLED for Mastra testing — no ticket polling
    // void this.poll();
    // this.timer = setInterval(() => void this.poll(), this.POLL_INTERVAL_MS);
    this.logger.log('Ticket engine DISABLED (Mastra testing mode)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll(): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      // Re-read from disk every poll (MCP server may have written externally)
      const tickets = this.ticketService.loadAllTickets();
      for (const ticket of tickets) {
        await this.evaluateTransitions(ticket, tickets);
      }
    } catch (err) {
      this.logger.warn(`Poll failed: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private async evaluateTransitions(ticket: Ticket, allTickets: Ticket[]): Promise<void> {
    switch (ticket.status) {
      case 'created':
      case 'blocked':
        this.checkDependencies(ticket, allTickets);
        break;
      case 'queued':
        await this.spawnBuilder(ticket);
        break;
      case 'ready_for_sandbox':
        await this.spawnDevOps(ticket);
        break;
      case 'sandbox_ready':
        await this.spawnSelfTester(ticket);
        break;
      case 'pr_open':
        await this.spawnCodeReviewer(ticket);
        break;
      case 'code_review_passed':
        await this.spawnDesigner(ticket);
        break;
      case 'code_review_changes_needed':
      case 'design_changes_needed':
        await this.spawnIteration(ticket);
        break;
      case 'stalled':
        this.retryStalled(ticket);
        break;
      case 'merged':
        await this.cleanup(ticket);
        break;
    }
  }

  // ── Dependency check ──────────────────────────────────────────────

  private checkDependencies(ticket: Ticket, allTickets: Ticket[]): void {
    if (ticket.dependsOn.length === 0) {
      this.ticketService.updateTicketStatus(ticket.id, 'queued', 'ticket-engine', 'No dependencies');
      return;
    }
    const allMet = ticket.dependsOn.every((depId) => {
      const dep = allTickets.find((t) => t.id === depId);
      return dep?.status === 'merged';
    });
    if (allMet) {
      this.ticketService.updateTicketStatus(ticket.id, 'queued', 'ticket-engine', 'All dependencies merged');
    } else if (ticket.status === 'created') {
      this.ticketService.updateTicketStatus(ticket.id, 'blocked', 'ticket-engine', 'Waiting on dependencies');
    }
  }

  // ── Agent spawning ────────────────────────────────────────────────

  private async spawnBuilder(ticket: Ticket): Promise<void> {
    const agent = await this.spawnFreshAgent(ticket, ticket.assignedRole, 'implementation');
    // Set up worktree + branch (idempotent)
    if (!ticket.branch) {
      this.ticketService.updateTicket(ticket.id, {
        branch: `ticket/${ticket.id}`,
        worktreePath: `.worktrees/${ticket.id}`,
      });
    }
    this.ticketService.updateTicketStatus(ticket.id, 'in_progress', 'ticket-engine',
      `Spawned agent ${agent.name} (${agent.role}) for implementation`);
    void this.agentService.runMessage(agent.sessionId, this.buildImplementationPrompt(ticket, agent)).catch((err) =>
      this.logger.warn(`Agent ${agent.name} failed: ${(err as Error).message}`));
  }

  private async spawnDevOps(ticket: Ticket): Promise<void> {
    const agent = await this.spawnFreshAgent(ticket, 'devops', 'deployment');
    if (!ticket.sandboxNamespace) {
      this.ticketService.updateTicket(ticket.id, { sandboxNamespace: `env-${ticket.id}` });
    }
    this.ticketService.updateTicketStatus(ticket.id, 'sandbox_deploying', 'ticket-engine',
      `Spawned agent ${agent.name} (devops) for deployment`);
    void this.agentService.runMessage(agent.sessionId, this.buildDeployPrompt(ticket, agent)).catch((err) =>
      this.logger.warn(`Agent ${agent.name} failed: ${(err as Error).message}`));
  }

  private async spawnSelfTester(ticket: Ticket): Promise<void> {
    const agent = await this.spawnFreshAgent(ticket, ticket.assignedRole, 'self_test');
    this.ticketService.updateTicketStatus(ticket.id, 'self_testing', 'ticket-engine',
      `Spawned agent ${agent.name} (${agent.role}) for self-test`);
    void this.agentService.runMessage(agent.sessionId, this.buildSelfTestPrompt(ticket, agent)).catch((err) =>
      this.logger.warn(`Agent ${agent.name} failed: ${(err as Error).message}`));
  }

  private async spawnCodeReviewer(ticket: Ticket): Promise<void> {
    const agent = await this.spawnFreshAgent(ticket, 'code-reviewer', 'code_review');
    this.ticketService.updateTicketStatus(ticket.id, 'code_reviewing', 'ticket-engine',
      `Spawned agent ${agent.name} (code-reviewer) for code review`);
    void this.agentService.runMessage(agent.sessionId, this.buildCodeReviewPrompt(ticket, agent)).catch((err) =>
      this.logger.warn(`Agent ${agent.name} failed: ${(err as Error).message}`));
  }

  private async spawnDesigner(ticket: Ticket): Promise<void> {
    const agent = await this.spawnFreshAgent(ticket, 'designer', 'design_review');
    this.ticketService.updateTicketStatus(ticket.id, 'design_reviewing', 'ticket-engine',
      `Spawned agent ${agent.name} (designer) for design review`);
    void this.agentService.runMessage(agent.sessionId, this.buildDesignReviewPrompt(ticket, agent)).catch((err) =>
      this.logger.warn(`Agent ${agent.name} failed: ${(err as Error).message}`));
  }

  private async spawnIteration(ticket: Ticket): Promise<void> {
    const agent = await this.spawnFreshAgent(ticket, ticket.assignedRole, 'iteration');
    this.ticketService.updateTicketStatus(ticket.id, 'in_progress', 'ticket-engine',
      `Spawned agent ${agent.name} (${agent.role}) for iteration`);
    void this.agentService.runMessage(agent.sessionId, this.buildIterationPrompt(ticket, agent)).catch((err) =>
      this.logger.warn(`Agent ${agent.name} failed: ${(err as Error).message}`));
  }

  private retryStalled(ticket: Ticket): void {
    // Count retries
    const stallCount = ticket.history.filter((e) => e.status === 'stalled').length;
    if (stallCount >= 3) {
      this.ticketService.updateTicketStatus(ticket.id, 'failed', 'ticket-engine',
        `Max retries (${stallCount}) exceeded`);
      return;
    }
    this.ticketService.updateTicketStatus(ticket.id, 'queued', 'ticket-engine',
      `Retry ${stallCount + 1}/3 after stall`);
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  private async cleanup(ticket: Ticket): Promise<void> {
    if (ticket.sandboxNamespace) {
      try {
        const sandboxName = ticket.sandboxNamespace.replace(/^env-/, '');
        await execFile('task', ['env:destroy', '--', sandboxName], {
          cwd: this.repoRoot,
          env: { ...process.env, REPO_ROOT: this.repoRoot },
        });
        this.logger.log(`Destroyed sandbox ${ticket.sandboxNamespace}`);
      } catch (err) {
        this.logger.warn(`Failed to destroy sandbox: ${(err as Error).message}`);
      }
    }
    if (ticket.worktreePath) {
      const fullPath = path.join(this.repoRoot, ticket.worktreePath);
      try {
        await execFile('git', ['worktree', 'remove', '--force', fullPath], {
          cwd: this.repoRoot,
        });
        this.logger.log(`Removed worktree ${fullPath}`);
      } catch (err) {
        this.logger.warn(`Failed to remove worktree: ${(err as Error).message}`);
      }
    }
    // Release agent name
    if (ticket.activeAgent) {
      this.ticketService.releaseName(ticket.activeAgent.name);
      this.ticketService.retireAgent(ticket.id, 'completed');
    }
  }

  // ── Agent lifecycle ───────────────────────────────────────────────

  private async spawnFreshAgent(
    ticket: Ticket,
    role: string,
    phase: TicketPhase,
  ): Promise<AgentInstance> {
    // Pick name (reuses name for same role on same ticket)
    const name = this.ticketService.pickName(ticket.id, role);

    // Create session with the role
    const session = this.agentService.createSession(undefined, undefined, role);

    const agent: AgentInstance = {
      sessionId: session.id,
      name,
      role,
      phase,
      startedAt: new Date().toISOString(),
      endedAt: null,
      exitReason: null,
    };

    this.ticketService.setActiveAgent(ticket.id, agent);
    this.ticketService.updateNameSession(name, session.id);
    this.logger.log(`Spawned ${role} agent "${name}" (session ${session.id.slice(0, 8)}) for ticket ${ticket.id} phase ${phase}`);
    return agent;
  }

  // ── Prompt builders ───────────────────────────────────────────────

  private readSpec(ticket: Ticket): string {
    const specPath = path.join(this.repoRoot, ticket.specPath);
    try {
      return fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf-8') : '(spec file not found)';
    } catch { return '(failed to read spec)'; }
  }

  private buildHandoffContext(ticket: Ticket): string {
    const handoffs = this.ticketService.readHandoffs(ticket.id);
    if (handoffs.length === 0) return 'No handoff notes from previous agents.';
    return handoffs.map((h) => `### ${h.filename}\n${h.content}`).join('\n\n');
  }

  private buildHistorySummary(ticket: Ticket): string {
    return ticket.history.map((e) =>
      `- ${e.at}: ${e.status} (${e.trigger}${e.detail ? ` — ${e.detail}` : ''})`,
    ).join('\n');
  }

  private buildRoleWikiContext(role: string): string {
    const pages = this.ticketService.listRoleWikiPages(role);
    if (pages.length === 0) return 'No wiki pages for this role yet.';
    return pages.map((page) => {
      const content = this.ticketService.readRoleWikiPage(role, page);
      return `### ${page}\n${content}`;
    }).join('\n\n');
  }

  private buildCommonContext(ticket: Ticket, agent: AgentInstance): string {
    const devHostname = process.env.DEV_HOSTNAME || 'localhost';
    const refreshedTicket = this.ticketService.getTicket(ticket.id);
    return [
      `You are ${agent.name}, a ${agent.role} on THE Dev Team.`,
      '',
      '## Your Assignment',
      `Ticket: ${refreshedTicket.id} — "${refreshedTicket.title}"`,
      `Phase: ${agent.phase}`,
      `Priority: ${refreshedTicket.priority}`,
      '',
      '## Task Specification',
      this.readSpec(refreshedTicket),
      '',
      '## Ticket History',
      this.buildHistorySummary(refreshedTicket),
      '',
      '## Handoff Notes from Previous Agents',
      this.buildHandoffContext(refreshedTicket),
      '',
      '## Workspace',
      `Branch: ${refreshedTicket.branch || '(not yet created)'}`,
      `Worktree: ${refreshedTicket.worktreePath || '(not yet created)'}`,
      `Sandbox: ${refreshedTicket.sandboxNamespace || '(not yet deployed)'}`,
      refreshedTicket.sandboxNamespace ? `Sandbox URL: http://app.${refreshedTicket.sandboxNamespace}.${devHostname}/` : '',
      `PR: ${refreshedTicket.prNumber ? `#${refreshedTicket.prNumber}` : '(not yet opened)'}`,
      `Target branch: ${refreshedTicket.targetBranch}`,
      '',
      '## Role Knowledge',
      this.buildRoleWikiContext(agent.role),
      '',
      '## Before You Finish',
      'You MUST do these two things before your work is done:',
      '1. Write a handoff note using mcp__workspace__write_handoff with what you did, what\'s not done, gotchas, and recommendations.',
      '2. Update the ticket status using mcp__workspace__update_ticket_status to indicate your work is complete.',
    ].join('\n');
  }

  private buildImplementationPrompt(ticket: Ticket, agent: AgentInstance): string {
    return [
      this.buildCommonContext(ticket, agent),
      '',
      '## Your Task: Implementation',
      '',
      '1. Create the worktree if it doesn\'t exist: mcp__workspace__create_worktree with name matching the ticket ID',
      `2. Check out the branch \`${ticket.branch}\` from \`${ticket.targetBranch}\``,
      '3. Read the task specification above carefully',
      '4. Implement the changes in the worktree',
      '5. Commit your changes with clear commit messages',
      '6. Write your handoff note (mcp__workspace__write_handoff)',
      '7. Update ticket status to "ready_for_sandbox" (mcp__workspace__update_ticket_status)',
    ].join('\n');
  }

  private buildDeployPrompt(ticket: Ticket, agent: AgentInstance): string {
    // Sandbox name is the worktree directory name (already lowercase)
    const worktreeName = ticket.worktreePath?.replace(/^\.worktrees\//, '') || ticket.id;
    return [
      this.buildCommonContext(ticket, agent),
      '',
      '## Your Task: Deploy Sandbox',
      '',
      `The worktree is at: ${ticket.worktreePath}`,
      `The sandbox name to use: ${worktreeName}`,
      '',
      `1. Deploy with mcp__workspace__deploy_sandbox using name="${worktreeName}" — this deploys the full stack (frontend, backend, database, keycloak)`,
      '2. Do NOT pass a services parameter — it always deploys everything',
      '3. Wait for deployment to complete',
      '4. Check sandbox health with mcp__workspace__sandbox_status',
      '5. Write a handoff note with the sandbox URL and any issues',
      '6. Update ticket status to "sandbox_ready" (mcp__workspace__update_ticket_status)',
    ].join('\n');
  }

  private buildSelfTestPrompt(ticket: Ticket, agent: AgentInstance): string {
    const devHostname = process.env.DEV_HOSTNAME || 'localhost';
    const sandboxName = ticket.sandboxNamespace?.replace(/^env-/, '') || ticket.id;
    return [
      this.buildCommonContext(ticket, agent),
      '',
      '## Your Task: Self-Test in Sandbox',
      '',
      `The sandbox is deployed at: http://app.env-${sandboxName}.${devHostname}/`,
      '',
      '1. Navigate to the sandbox URL using Playwright',
      '2. Test the changes you implemented against the task specification',
      '3. Verify visual appearance and interactions work correctly',
      '4. If tests pass:',
      '   a. Open a draft PR using mcp__workspace__push_and_pr',
      '   b. Write your handoff note with test results',
      '   c. Update ticket status to "pr_open" with the PR number',
      '5. If tests fail:',
      '   a. Fix the issues in the worktree',
      '   b. Re-deploy with mcp__workspace__deploy_sandbox',
      '   c. Re-test until passing',
      '   d. Then proceed with step 4',
    ].join('\n');
  }

  private buildCodeReviewPrompt(ticket: Ticket, agent: AgentInstance): string {
    return [
      this.buildCommonContext(ticket, agent),
      '',
      '## Your Task: Code Review',
      '',
      `Review PR #${ticket.prNumber} for code quality, Angular standards, and correctness.`,
      '',
      '1. Read the PR diff with mcp__workspace__read_pr_reviews to see the PR details',
      '2. Read the changed files to understand the implementation',
      '3. Check against Angular standards, patterns, and best practices',
      '4. Submit your review:',
      '   - If code passes: update ticket status to "code_review_passed"',
      '   - If changes needed: use mcp__workspace__review_pr with event="REQUEST_CHANGES" and update ticket status to "code_review_changes_needed"',
      '5. Write a handoff note summarizing your review findings',
    ].join('\n');
  }

  private buildDesignReviewPrompt(ticket: Ticket, agent: AgentInstance): string {
    const devHostname = process.env.DEV_HOSTNAME || 'localhost';
    const sandboxName = ticket.sandboxNamespace?.replace(/^env-/, '') || ticket.id;
    return [
      this.buildCommonContext(ticket, agent),
      '',
      '## Your Task: Design Review',
      '',
      `Review the deployed sandbox at: http://app.env-${sandboxName}.${devHostname}/`,
      '',
      '1. Navigate to the sandbox using Playwright',
      '2. Evaluate the visual quality, UX, and adherence to the design guide',
      '3. Test responsive behavior at different viewport sizes',
      '4. Submit your decision:',
      '   - If design is good: update ticket status to "approved"',
      '   - If changes needed: update ticket status to "design_changes_needed" and use mcp__workspace__review_pr with event="REQUEST_CHANGES" to describe the design issues',
      '5. Write a handoff note with your design findings',
    ].join('\n');
  }

  private buildIterationPrompt(ticket: Ticket, agent: AgentInstance): string {
    return [
      this.buildCommonContext(ticket, agent),
      '',
      '## Your Task: Address Review Feedback',
      '',
      'A reviewer has requested changes. Read the handoff notes and PR reviews to understand what needs to change.',
      '',
      '### Important: Check if the deployed sandbox reflects your latest changes',
      'A common failure is making code changes but the sandbox still serving a stale build.',
      'When fixing issues, ensure your changes will actually take effect:',
      '- Global styles (like border-radius in styles.scss) override component styles',
      '- If a reviewer says "the deployed build is stale", your changes need to be committed and the sandbox re-deployed',
      '',
      '### Steps',
      `1. Read the latest PR reviews with mcp__workspace__read_pr_reviews for PR #${ticket.prNumber}`,
      '2. Read the handoff notes above — especially the latest design_review handoff for specific issues',
      '3. Address each piece of feedback in the worktree',
      '4. Commit your changes with a clear message describing what was fixed',
      '5. Write your handoff note explaining exactly what you changed and why',
      '6. Update ticket status to "ready_for_sandbox" — this triggers the DevOps agent to re-deploy the sandbox with your latest code',
      '',
      'Do NOT try to deploy the sandbox yourself. Do NOT push to origin yet — that happens during the self-test phase.',
    ].join('\n');
  }
}
