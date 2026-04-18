import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { AgentService } from '../agent/agent.service';
import { RouterState, IssueSummary, PrSummary, ClosedPrSummary } from './router.types';

const execFile = promisify(execFileCb);

/**
 * Routes GitHub state changes to the right agent.
 *
 * Trigger → Action:
 *  - New open issue with `frontend` label  → spawn Frontend Owner with "pick up #N"
 *  - New open issue with `backend` label   → spawn Backend Owner (when role exists)
 *  - New draft PR opened by the agent bot  → spawn Designer with "review PR #M"
 *  - New CHANGES_REQUESTED review on agent draft PR → spawn FE Owner with "address review on #M"
 *  - New commits on draft PR after Designer reviewed → spawn Designer to re-review
 *  - APPROVED review on draft PR (and not yet marked ready) → spawn FE Owner to mark_pr_ready
 *
 * State is persisted to $REPO_ROOT/.dev-team/router/state.json so we don't
 * re-route the same trigger after a backend restart.
 */
@Injectable()
export class RouterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RouterService.name);
  private readonly stateFile: string;
  private readonly repoRoot: string;
  private state: RouterState = {
    routedIssues: [],
    designerRoutedForPrCommit: {},
    feOwnerRoutedForPrReview: {},
    cleanedPrs: [],
  };
  private timer: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 30_000;
  private polling = false;

  /** Login of the bot that authors agent PRs/issues. Reviews FROM this login are ignored. */
  private readonly BOT_LOGIN = process.env.GITHUB_BOT_LOGIN || 'app/macbook-agent';

  constructor(private readonly agentService: AgentService) {
    this.repoRoot = process.env.REPO_ROOT || '/workspace';
    this.stateFile = path.join(this.repoRoot, '.dev-team', 'router', 'state.json');
  }

  onModuleInit(): void {
    this.loadState();
    // DISABLED for Mastra testing — no GitHub polling
    // void this.poll();
    // this.timer = setInterval(() => void this.poll(), this.POLL_INTERVAL_MS);
    this.logger.log('Router DISABLED (Mastra testing mode)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private loadState(): void {
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, 'utf-8');
        this.state = { ...this.state, ...JSON.parse(raw) };
        this.logger.log(`Loaded router state: ${this.state.routedIssues.length} issues, ${Object.keys(this.state.designerRoutedForPrCommit).length} PRs`);
      }
    } catch (err) {
      this.logger.warn(`Failed to load router state: ${(err as Error).message}`);
    }
  }

  private persistState(): void {
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (err) {
      this.logger.warn(`Failed to persist router state: ${(err as Error).message}`);
    }
  }

  private async poll(): Promise<void> {
    if (this.polling) return; // skip overlapping polls
    this.polling = true;
    try {
      await this.routeNewIssues();
      await this.routePrTriggers();
      await this.cleanupClosedPrs();
    } catch (err) {
      this.logger.warn(`Poll failed: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  // ── Issue routing ──────────────────────────────────────────────────

  private async routeNewIssues(): Promise<void> {
    const [issues, issuesWithOpenPrs] = await Promise.all([
      this.fetchOpenIssues(),
      this.fetchIssuesWithOpenPrs(),
    ]);

    for (const issue of issues) {
      if (this.state.routedIssues.includes(issue.number)) continue;

      // Dedup: skip issues that already have an open PR closing them.
      // Prevents duplicate spawns after a router state reset, when the
      // FE Owner has already opened a PR for this issue.
      if (issuesWithOpenPrs.has(issue.number)) {
        this.logger.log(`Issue #${issue.number} already has an open PR — skipping`);
        this.state.routedIssues.push(issue.number);
        this.persistState();
        continue;
      }

      const labels = (issue.labels || []).map((l) => l.name);
      const role = this.routeIssueByLabel(labels);
      if (!role) {
        this.logger.log(`Issue #${issue.number} has no routable label (${labels.join(', ') || 'none'}) — skipping`);
        // Mark as seen so we don't log again every poll
        this.state.routedIssues.push(issue.number);
        this.persistState();
        continue;
      }

      this.logger.log(`Routing issue #${issue.number} ("${issue.title}") to ${role}`);
      await this.spawnAgent(role, this.buildPickUpIssuePrompt(issue));
      this.state.routedIssues.push(issue.number);
      this.persistState();
    }
  }

  /** Returns the set of issue numbers referenced by any currently-open PR. */
  private async fetchIssuesWithOpenPrs(): Promise<Set<number>> {
    try {
      const { stdout } = await execFile(
        'gh',
        ['pr', 'list', '--state', 'open', '--limit', '50', '--json', 'closingIssuesReferences'],
        { cwd: this.repoRoot, env: { ...process.env, REPO_ROOT: this.repoRoot } },
      );
      const prs = JSON.parse(stdout) as Array<{ closingIssuesReferences?: Array<{ number: number }> }>;
      const numbers = new Set<number>();
      for (const pr of prs) {
        for (const ref of pr.closingIssuesReferences || []) {
          numbers.add(ref.number);
        }
      }
      return numbers;
    } catch (err) {
      this.logger.warn(`Failed to list issues-with-PRs: ${(err as Error).message}`);
      return new Set();
    }
  }

  private routeIssueByLabel(labels: string[]): string | null {
    if (labels.includes('frontend')) return 'frontend-owner';
    // 'backend' → 'backend-owner' will go here when the role exists
    return null;
  }

  private buildPickUpIssuePrompt(issue: IssueSummary): string {
    return `Pick up GitHub issue #${issue.number}. Read it with mcp__workspace__read_github_issue, create a worktree+sandbox, implement the fix, and open it as a DRAFT PR (the default) that closes the issue. Once you push the draft PR, stop and wait — the Designer will be auto-invoked to review your sandbox.`;
  }

  // ── PR routing ─────────────────────────────────────────────────────

  private async routePrTriggers(): Promise<void> {
    const prs = await this.fetchOpenPrs();
    for (const pr of prs) {
      // Only handle PRs the bot opened
      if (pr.author?.login !== this.BOT_LOGIN) continue;

      // 1. Designer review trigger — new commits since we last spawned Designer
      if (pr.isDraft) {
        const lastSpawnedSha = this.state.designerRoutedForPrCommit[pr.number];
        if (lastSpawnedSha !== pr.headRefOid) {
          this.logger.log(`Routing draft PR #${pr.number} (commit ${pr.headRefOid.slice(0, 7)}) to designer`);
          await this.spawnAgent('designer', this.buildReviewDraftPrPrompt(pr));
          this.state.designerRoutedForPrCommit[pr.number] = pr.headRefOid;
          this.persistState();
          continue; // give the Designer a chance to review before we trigger anything else on this PR
        }
      }

      // 2. FE Owner iteration trigger — latest CHANGES_REQUESTED review we haven't addressed
      const latestChangesRequested = (pr.reviews || [])
        .filter((r) => r.state === 'CHANGES_REQUESTED')
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
      if (latestChangesRequested) {
        const lastAddressed = this.state.feOwnerRoutedForPrReview[pr.number];
        if (lastAddressed !== latestChangesRequested.id) {
          this.logger.log(`Routing PR #${pr.number} review ${latestChangesRequested.id.slice(0, 7)} to frontend-owner`);
          await this.spawnAgent('frontend-owner', this.buildAddressReviewPrompt(pr));
          this.state.feOwnerRoutedForPrReview[pr.number] = latestChangesRequested.id;
          this.persistState();
          continue;
        }
      }

      // No mark-ready trigger — the Designer marks PRs ready directly when
      // satisfied (since both agents share a bot identity, GitHub blocks
      // self-approval, so we use draft→ready as the "this is done" signal).
    }
  }

  private buildReviewDraftPrPrompt(pr: PrSummary): string {
    const sandboxName = pr.headRefName.replace(/^the-dev-team\//, '');
    const devHostname = process.env.DEV_HOSTNAME || 'localhost';
    return `Review draft PR #${pr.number} ("${pr.title}").

Branch: ${pr.headRefName}
Sandbox URL: http://app.env-${sandboxName}.${devHostname}/

Steps:
1. Read the PR with mcp__workspace__read_pr_reviews to see existing review history (if any) and the PR description for the original issue context.
2. Read the original issue if mentioned in the PR body (look for "Closes #N").
3. Visit the sandbox URL via Playwright. Log in with admin/admin if prompted.
4. Evaluate the work against the original issue's acceptance criteria AND general design quality.
5. Submit a formal review with mcp__workspace__review_pr:
   - event="REQUEST_CHANGES" with a body listing specific, actionable changes if anything needs work
   - event="APPROVE" with a body summarizing what looks good if it's done
6. Do NOT file a new GitHub issue — the iteration happens inside this PR via reviews.`;
  }

  private buildAddressReviewPrompt(pr: PrSummary): string {
    const sandboxName = pr.headRefName.replace(/^the-dev-team\//, '');
    return `The Designer requested changes on draft PR #${pr.number} ("${pr.title}").

Branch: ${pr.headRefName}
Worktree should be at: .worktrees/${sandboxName}

Steps:
1. Read the latest review with mcp__workspace__read_pr_reviews — focus on the most recent CHANGES_REQUESTED review body.
2. Make sure the worktree exists (mcp__workspace__create_worktree with name "${sandboxName}" — it gracefully reuses an existing worktree).
3. Make the requested changes in that worktree.
4. Re-deploy the sandbox with mcp__workspace__deploy_sandbox name "${sandboxName}".
5. Push the new commits — use mcp__workspace__git_add + git_commit + git_push (don't try push_and_pr again, the PR already exists).
6. Comment on the PR with mcp__workspace__comment_pr saying "Addressed feedback in latest commit. Sandbox redeployed. Ready for re-review."
7. Stop — the Designer will be auto-invoked to re-review.`;
  }

  // ── gh CLI helpers ────────────────────────────────────────────────

  private async fetchOpenIssues(): Promise<IssueSummary[]> {
    try {
      const { stdout } = await execFile(
        'gh',
        ['issue', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,body,labels,state,author'],
        { cwd: this.repoRoot, env: { ...process.env, REPO_ROOT: this.repoRoot } },
      );
      return JSON.parse(stdout) as IssueSummary[];
    } catch (err) {
      this.logger.warn(`Failed to list issues: ${(err as Error).message}`);
      return [];
    }
  }

  private async fetchOpenPrs(): Promise<PrSummary[]> {
    try {
      const { stdout } = await execFile(
        'gh',
        ['pr', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,body,state,isDraft,headRefName,headRefOid,author,reviews'],
        { cwd: this.repoRoot, env: { ...process.env, REPO_ROOT: this.repoRoot } },
      );
      return JSON.parse(stdout) as PrSummary[];
    } catch (err) {
      this.logger.warn(`Failed to list PRs: ${(err as Error).message}`);
      return [];
    }
  }

  // ── Cleanup closed PRs ────────────────────────────────────────────

  private async cleanupClosedPrs(): Promise<void> {
    const closedPrs = await this.fetchClosedAgentPrs();
    for (const pr of closedPrs) {
      if (this.state.cleanedPrs.includes(pr.number)) continue;
      // Only clean PRs on agent-prefixed branches so we never touch a human's branch
      if (!pr.headRefName.startsWith('the-dev-team/')) continue;

      const sandboxName = pr.headRefName.replace(/^the-dev-team\//, '');
      this.logger.log(`Cleaning up closed PR #${pr.number} (sandbox=${sandboxName})`);

      // Destroy sandbox (best-effort)
      try {
        await execFile('task', ['env:destroy', '--', sandboxName], {
          cwd: this.repoRoot,
          env: { ...process.env, REPO_ROOT: this.repoRoot },
        });
        this.logger.log(`  Destroyed sandbox env-${sandboxName}`);
      } catch (err) {
        this.logger.warn(`  Failed to destroy sandbox env-${sandboxName}: ${(err as Error).message}`);
      }

      // Remove worktree (best-effort)
      const worktreePath = path.join(this.repoRoot, '.worktrees', sandboxName);
      try {
        await execFile('git', ['worktree', 'remove', '--force', worktreePath], {
          cwd: this.repoRoot,
          env: { ...process.env, REPO_ROOT: this.repoRoot },
        });
        this.logger.log(`  Removed worktree ${worktreePath}`);
      } catch (err) {
        this.logger.warn(`  Failed to remove worktree ${worktreePath}: ${(err as Error).message}`);
      }

      this.state.cleanedPrs.push(pr.number);
      this.persistState();
    }
  }

  private async fetchClosedAgentPrs(): Promise<ClosedPrSummary[]> {
    try {
      const { stdout } = await execFile(
        'gh',
        ['pr', 'list', '--state', 'closed', '--limit', '50', '--json', 'number,headRefName,state,mergedAt,closedAt,author'],
        { cwd: this.repoRoot, env: { ...process.env, REPO_ROOT: this.repoRoot } },
      );
      const prs = JSON.parse(stdout) as ClosedPrSummary[];
      return prs.filter((pr) => pr.author?.login === this.BOT_LOGIN);
    } catch (err) {
      this.logger.warn(`Failed to list closed PRs: ${(err as Error).message}`);
      return [];
    }
  }

  // ── Session spawning ──────────────────────────────────────────────

  private async spawnAgent(role: string, prompt: string): Promise<void> {
    try {
      const session = this.agentService.createSession(undefined, undefined, role);
      this.logger.log(`Spawned ${role} session ${session.id.slice(0, 8)}`);
      // Fire and forget — the agent runs in the background, persisting messages
      void this.agentService.runMessage(session.id, prompt).catch((err) => {
        this.logger.warn(`runMessage on session ${session.id.slice(0, 8)} threw: ${(err as Error).message}`);
      });
    } catch (err) {
      this.logger.warn(`Failed to spawn ${role}: ${(err as Error).message}`);
    }
  }
}
