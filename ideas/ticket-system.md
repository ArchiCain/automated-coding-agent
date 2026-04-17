# Ticket System — Data Model & State Machine

## Overview

The ticket system replaces both the current Router's GitHub-polling logic and the backlog's `status.json` files with a unified, event-driven model. Tickets are the **sole coordination mechanism** between agents. Creating a ticket spawns an agent. Ticket state transitions trigger pipeline stages (sandbox deployment, code review, design review). A watchdog monitors active tickets for stuck/crashed agents.

Tickets live as JSON files on disk at `.dev-team/tickets/`. No external systems. Version controlled. Human-readable.

## Core Design Principles

Borrowed from Gas Town (see `ideas/old/claude-automation-research/gastown-summary.md`) and adapted:

### Three-Layer Lifecycle

Every agent has three independent layers with different lifespans:

| Layer | What | Lifespan | Survives crash? |
|-------|------|----------|-----------------|
| **Session** | Claude Code process | Ephemeral — single phase of work | No (and doesn't need to) |
| **Workspace** | Git worktree + sandbox namespace | Persistent — lives until ticket is merged/closed | Yes |
| **Slot** | Name from pool + ticket assignment | Persistent — lives until ticket is terminal | Yes |

**Key insight:** The session is disposable garbage. The worktree is the real work. The ticket + role wiki are the coordination state. A fresh agent can always pick up because everything it needs is external to its session.

### Propulsion Principle (from Gas Town's GUPP)

> **"Ticket drops to queued = agent spawns. No polling for readiness, no waiting for permission."**

Work drives execution. The Ticket Engine reacts to state, it doesn't schedule. When a dependency resolves and a ticket becomes `queued`, a fresh agent spawns immediately.

### Nondeterministic Idempotence (from Gas Town's NDI)

Any agent can continue any ticket at any point. This is guaranteed by:
1. **Worktree persistence** — code changes survive agent death
2. **Ticket history** — full record of what's happened
3. **Role wiki** — accumulated knowledge from previous agents in the same role
4. **Handoff notes** — crystallized context from the previous agent's session (if it completed cleanly)

An agent that crashes mid-implementation leaves behind a partially-modified worktree. A fresh agent spawns, reads the ticket (sees it was `in_progress`), reads the worktree (sees partial work), reads the role wiki, reads any handoff notes, and continues. No session state needed.

### Fresh Agents Always

Every ticket phase gets a **fresh agent instance**. No session reuse across phases.

- Ticket moves to `queued` → fresh builder agent spawns
- Builder finishes, ticket moves to `ready_for_sandbox` → fresh DevOps agent spawns
- Sandbox ready, ticket moves to `self_testing` → fresh builder agent spawns (NOT the same session)
- PR opened → fresh code reviewer spawns
- Code review passes → fresh designer spawns
- Changes requested → fresh builder spawns (reads review comments from PR + role wiki)

This eliminates context window exhaustion, simplifies crash recovery, and means the memory system must be good enough to support seamless handoff.

---

## Relationship to Decomposition

The decomposition pipeline (brainstorm → plan → project → feature → concern) still exists. The Team Lead runs it during brainstorming. The output changes:

**Before:** Concern-level `task.md` + `status.json` in a nested backlog tree
**After:** Concern-level `task.md` stays as the spec. But instead of `status.json`, the Team Lead creates a **ticket** that references the task spec. The ticket is what drives execution.

```
Decomposition produces:
  .dev-team/plans/{plan-id}/
    ├── plan.md
    └── tasks/{project}/{feature}/{concern}/
        └── task.md          ← spec (what to build)

Team Lead creates tickets from specs:
  .dev-team/tickets/
    ├── T-4a2b1c.json        ← ticket (who builds it, when, what state)
    └── T-7f3e9d.json
```

The plan tree is the **blueprint**. Tickets are the **work orders**.

---

## Ticket Data Model

```typescript
interface Ticket {
  /** Unique ID: T-{6-hex} */
  id: string;

  /** Human-readable title */
  title: string;

  /** Path to the task.md spec, relative to repo root */
  specPath: string;

  /** Plan this ticket belongs to */
  planId: string;

  /** Current state */
  status: TicketStatus;

  /** Which agent role should work this */
  assignedRole: AgentRole;

  /** Agent instance currently working this (null if unassigned/queued) */
  activeAgent: AgentInstance | null;

  /** All agents that have worked on this ticket (completed, crashed, or dismissed) */
  agentHistory: AgentInstance[];

  /** Ticket IDs this depends on — won't enter 'queued' until all are 'merged' */
  dependsOn: string[];

  /** Priority: determines order when multiple tickets are ready */
  priority: 'critical' | 'high' | 'medium' | 'low';

  /** Git branch created for this ticket's work */
  branch: string | null;

  /** Worktree path */
  worktreePath: string | null;

  /** Sandbox namespace (if deployed) */
  sandboxNamespace: string | null;

  /** PR number (if opened) */
  prNumber: number | null;

  /** Target branch for PRs (environment branch, e.g. local-scain) */
  targetBranch: string;

  /** Full status history */
  history: TicketEvent[];

  /** Timestamps */
  createdAt: string;
  updatedAt: string;
}

interface AgentInstance {
  /** Session ID in the agent service */
  sessionId: string;

  /** Random human name */
  name: string;

  /** Role template this instance was created from */
  role: string;

  /** Which phase of the ticket this agent is working */
  phase: TicketPhase;

  /** When this agent started working */
  startedAt: string;

  /** When this agent finished (null if still active) */
  endedAt: string | null;

  /** How the session ended */
  exitReason: 'completed' | 'crashed' | 'stopped_manually' | 'watchdog_killed' | null;
}

/** Phases map to which agent role works at each stage */
type TicketPhase =
  | 'implementation'    // builder: queued → ready_for_sandbox
  | 'deployment'        // devops: ready_for_sandbox → sandbox_ready
  | 'self_test'         // builder: sandbox_ready → pr_open
  | 'code_review'       // code-reviewer: pr_open → code_review_passed/changes_needed
  | 'design_review'     // designer: code_review_passed → approved/changes_needed
  | 'iteration';        // builder: changes_needed → ready_for_sandbox (loop)

interface TicketEvent {
  status: TicketStatus;
  at: string;
  /** Who/what caused the transition */
  trigger: 'team-lead' | 'ticket-engine' | 'watchdog' | 'agent' | 'user';
  /** Optional context */
  detail?: string;
}

type AgentRole =
  | 'frontend-developer'
  | 'designer'
  | 'devops'
  | 'code-reviewer'
  | 'team-lead';
```

---

## Ticket States

```
                          ┌─────────────────────────────────────────────────┐
                          │                                                 │
  ┌──────────┐     ┌──────┴───┐     ┌─────────────┐     ┌───────────────┐  │
  │  created  ├────►│  queued   ├────►│ in_progress  ├────►│ ready_for_    │  │
  └──────────┘     └──────────┘     └──────┬──────┘     │ sandbox       │  │
       │                                    │            └───────┬───────┘  │
       │                                    │                    │          │
       │           ┌────────────────────────┘                    ▼          │
       │           │                              ┌───────────────────┐    │
       │           │                              │ sandbox_deploying  │    │
       │           │                              └────────┬──────────┘    │
       │           │                                       │               │
       │           │                                       ▼               │
       │           │                              ┌───────────────────┐    │
       │           │                              │  sandbox_ready    │    │
       │           │                              └────────┬──────────┘    │
       │           │                                       │               │
       │           │                                       ▼               │
       │           │                              ┌───────────────────┐    │
       │           │                              │  self_testing     │    │
       │           │                              └────────┬──────────┘    │
       │           │                                       │               │
       │           │                              ┌────────┴──────────┐    │
       │           │                              │                   │    │
       │           │                              ▼                   │    │
       │           │                    ┌───────────────┐    (test    │    │
       │           │                    │  pr_open      │    failed,  │    │
       │           │                    └───────┬───────┘    iterate) │    │
       │           │                            │                   │    │
       │           │                            ▼              ─────┘    │
       │           │                    ┌───────────────┐                │
       │           │                    │ code_reviewing │                │
       │           │                    └───────┬───────┘                │
       │           │                            │                        │
       │           │                   ┌────────┴────────┐               │
       │           │                   │                 │               │
       │           │                   ▼                 ▼               │
       │           │         ┌──────────────┐  ┌──────────────────┐     │
       │           │         │ code_review  │  │ code_review      │     │
       │           │         │ _passed      │  │ _changes_needed  ├─────┘
       │           │         └──────┬───────┘  └──────────────────┘
       │           │                │           (back to in_progress)
       │           │                ▼
       │           │       ┌────────────────┐
       │           │       │design_reviewing │
       │           │       └───────┬────────┘
       │           │               │
       │           │      ┌────────┴────────┐
       │           │      │                 │
       │           │      ▼                 ▼
       │           │  ┌──────────┐  ┌──────────────────┐
       │           │  │ approved │  │ design_changes    │
       │           │  └────┬─────┘  │ _needed           ├──────┐
       │           │       │        └──────────────────┘       │
       │           │       ▼          (back to in_progress)    │
       │           │  ┌──────────┐                             │
       │           │  │  merged  │                             │
       │           │  └──────────┘                             │
       │           │                                           │
       │           │                                           │
  ┌────▼───┐  ┌────▼──────────┐                               │
  │blocked │  │    failed     │                                │
  └────────┘  └───────────────┘                                │
       │                                                       │
  ┌────▼──────────────┐                                        │
  │ stopped_manually  │                                        │
  └───────────────────┘                                        │
```

### State Definitions

| State | Description | Who's active | Next |
|-------|-------------|-------------|------|
| `created` | Team Lead created the ticket but dependencies aren't met | Nobody | → `queued` (when deps met) or `blocked` |
| `blocked` | Waiting on dependency tickets to complete | Nobody | → `queued` (when deps met) |
| `queued` | Ready for pickup — all dependencies met | Ticket Engine | → `in_progress` (agent spawned) |
| `in_progress` | Agent is implementing the spec | Builder agent (e.g., Hank) | → `ready_for_sandbox` |
| `ready_for_sandbox` | Agent finished coding, needs deployment | Ticket Engine | → `sandbox_deploying` (DevOps spawned) |
| `sandbox_deploying` | DevOps agent is deploying the worktree | DevOps agent (e.g., Gus) | → `sandbox_ready` |
| `sandbox_ready` | Sandbox is live, builder can test | Ticket Engine | → `self_testing` (notifies builder) |
| `self_testing` | Builder agent is testing via Playwright | Builder agent | → `pr_open` or back to `in_progress` |
| `pr_open` | Draft PR opened, awaiting code review | Ticket Engine | → `code_reviewing` (reviewer spawned) |
| `code_reviewing` | Code reviewer is examining the PR | Code Reviewer agent | → `code_review_passed` or `code_review_changes_needed` |
| `code_review_passed` | Code passes, ready for design review | Ticket Engine | → `design_reviewing` (designer spawned) |
| `code_review_changes_needed` | Reviewer requested changes | Ticket Engine | → `in_progress` (builder picks back up) |
| `design_reviewing` | Designer is reviewing sandbox visually | Designer agent | → `approved` or `design_changes_needed` |
| `design_changes_needed` | Designer found issues | Ticket Engine | → `in_progress` (builder picks back up) |
| `approved` | All reviews passed, PR ready for merge | You | → `merged` |
| `merged` | PR merged into target branch, cleanup done | Ticket Engine | Terminal |
| `failed` | Agent errored, unrecoverable | Watchdog/Team Lead | Can be retried → `queued` |
| `stopped_manually` | You clicked stop | You | Manual restart only |

---

## Ticket Engine

The Ticket Engine replaces the current `RouterService`. It's a state machine executor that watches for ticket state changes and triggers the next action.

```typescript
interface TicketEngine {
  /**
   * Periodic scan (every 10-15s):
   * 1. Load all ticket JSON files from .dev-team/tickets/
   * 2. For each ticket, check if a transition should fire
   * 3. Execute the transition
   */
  poll(): Promise<void>;
}
```

### Transition Rules

Every transition that spawns an agent creates a **fresh session**. The previous agent's session is already gone — its work lives in the worktree, its knowledge lives in the role wiki, and its handoff notes live in the ticket's handoff directory.

```typescript
const TRANSITIONS: TransitionRule[] = [
  {
    // Dependencies met → move to queue
    when: (t) => t.status === 'created' || t.status === 'blocked',
    condition: (t, allTickets) =>
      t.dependsOn.every(depId =>
        allTickets.find(d => d.id === depId)?.status === 'merged'
      ),
    action: (t) => updateStatus(t, 'queued'),
  },
  {
    // Queued → spawn fresh builder agent
    when: (t) => t.status === 'queued',
    condition: () => true,
    action: async (t) => {
      const agent = await spawnFreshAgent(t, t.assignedRole, 'implementation');
      // Create worktree + branch off target branch (idempotent — may already exist from a previous attempt)
      t.branch = t.branch || `ticket/${t.id}`;
      t.worktreePath = t.worktreePath || `.worktrees/${t.id}`;
      updateStatus(t, 'in_progress');
      void agentService.runMessage(agent.sessionId, buildImplementationPrompt(t));
    },
  },
  {
    // Ready for sandbox → spawn fresh DevOps agent
    when: (t) => t.status === 'ready_for_sandbox',
    condition: () => true,
    action: async (t) => {
      const agent = await spawnFreshAgent(t, 'devops', 'deployment');
      t.sandboxNamespace = t.sandboxNamespace || `env-${t.id}`;
      updateStatus(t, 'sandbox_deploying');
      void agentService.runMessage(agent.sessionId, buildDeployPrompt(t));
    },
  },
  {
    // Sandbox ready → spawn fresh builder for self-testing
    when: (t) => t.status === 'sandbox_ready',
    condition: () => true,
    action: async (t) => {
      const agent = await spawnFreshAgent(t, t.assignedRole, 'self_test');
      updateStatus(t, 'self_testing');
      void agentService.runMessage(agent.sessionId, buildSelfTestPrompt(t));
    },
  },
  {
    // PR opened → spawn fresh code reviewer
    when: (t) => t.status === 'pr_open',
    condition: () => true,
    action: async (t) => {
      const agent = await spawnFreshAgent(t, 'code-reviewer', 'code_review');
      updateStatus(t, 'code_reviewing');
      void agentService.runMessage(agent.sessionId, buildCodeReviewPrompt(t));
    },
  },
  {
    // Code review passed → spawn fresh designer
    when: (t) => t.status === 'code_review_passed',
    condition: () => true,
    action: async (t) => {
      const agent = await spawnFreshAgent(t, 'designer', 'design_review');
      updateStatus(t, 'design_reviewing');
      void agentService.runMessage(agent.sessionId, buildDesignReviewPrompt(t));
    },
  },
  {
    // Changes needed → spawn fresh builder for iteration
    when: (t) => t.status === 'code_review_changes_needed' || t.status === 'design_changes_needed',
    condition: () => true,
    action: async (t) => {
      const agent = await spawnFreshAgent(t, t.assignedRole, 'iteration');
      updateStatus(t, 'in_progress');
      void agentService.runMessage(agent.sessionId, buildIterationPrompt(t));
    },
  },
  {
    // Approved → notify user, await merge
    when: (t) => t.status === 'approved',
    condition: () => true,
    action: async (t) => {
      // Emit WebSocket event to UI: "Ticket T-xxx approved, PR #N ready to merge"
    },
  },
  {
    // Merged → cleanup
    when: (t) => t.status === 'merged',
    condition: () => true,
    action: async (t) => {
      await destroySandbox(t.sandboxNamespace);
      await removeWorktree(t.worktreePath);
      t.activeAgent = null;
    },
  },
];

/** Spawns a fresh agent, retiring the current one if it exists */
async function spawnFreshAgent(
  ticket: Ticket,
  role: string,
  phase: TicketPhase,
): Promise<AgentInstance> {
  // Retire current agent if one exists
  if (ticket.activeAgent) {
    ticket.activeAgent.endedAt = now();
    ticket.activeAgent.exitReason = ticket.activeAgent.exitReason || 'completed';
    ticket.agentHistory.push(ticket.activeAgent);
  }

  // Pick a name (reuse the slot name if same role, new name if different role)
  const name = (ticket.activeAgent?.role === role)
    ? ticket.activeAgent.name  // "Hank" stays "Hank" across phases of the same role
    : pickRandomName();

  const session = agentService.createSession(undefined, undefined, role);
  const agent: AgentInstance = {
    sessionId: session.id,
    name,
    role,
    phase,
    startedAt: now(),
    endedAt: null,
    exitReason: null,
  };

  ticket.activeAgent = agent;
  return agent;
}
```

### How Agents Update Ticket State

Agents don't write to ticket files directly. They use an MCP tool:

```typescript
// Added to workspace MCP server
tool('update_ticket_status', {
  ticketId: z.string(),
  status: z.enum([
    'ready_for_sandbox',  // builder finished coding
    'pr_open',            // builder opened PR
    'sandbox_ready',      // devops finished deploying
    'code_review_passed', // reviewer approved
    'code_review_changes_needed', // reviewer requested changes
    'design_reviewing',   // (not needed — engine triggers this)
    'approved',           // designer approved
    'design_changes_needed', // designer requested changes
    'failed',             // agent hit unrecoverable error
  ]),
  prNumber: z.number().optional(),
  detail: z.string().optional(),
});
```

This keeps the ticket file as the single source of truth, with agents updating it through a controlled interface.

---

## Watchdog

Separate from the Ticket Engine. Runs on a slower interval (every 60s).

```typescript
interface WatchdogCheck {
  /** Ticket has been in an active state too long with no progress */
  stuckDetection: {
    maxDuration: Record<TicketStatus, number>; // ms
    // e.g., in_progress: 30min, sandbox_deploying: 10min, code_reviewing: 20min
  };

  /** Agent session is dead but ticket still shows active */
  crashDetection: {
    // Check if session.id still exists and is responsive
    isSessionAlive(sessionId: string): boolean;
  };

  /** Actions */
  onStuck(ticket: Ticket): void;   // → mark 'stalled', notify Team Lead
  onCrash(ticket: Ticket): void;   // → mark 'stalled', spawn replacement agent
}
```

Stalled tickets get a new status `stalled` (not in the main flow — it's a watchdog-only state). The Team Lead or Ticket Engine can move a stalled ticket back to `queued` to retry with a fresh agent, or to `failed` if retries are exhausted.

### Crash Recovery Flow

```
Agent crashes mid-implementation
  │
  Watchdog detects (session dead, ticket still in_progress)
  │
  Watchdog marks agent: exitReason = 'crashed', endedAt = now()
  │
  Watchdog moves agent to agentHistory
  │
  Watchdog sets ticket status → 'stalled'
  │
  Ticket Engine sees 'stalled' → moves to 'queued' (retry)
  │
  Fresh agent spawns, same name (Hank), reads:
    1. Ticket (sees history: previous Hank crashed during implementation)
    2. Worktree (sees partial code changes — git status, git diff)
    3. Handoff notes (if previous agent wrote any before crashing — unlikely)
    4. Role wiki (patterns, gotchas from all previous agents)
    5. Task spec (original requirements)
  │
  Fresh Hank continues from worktree state
```

The worktree is the critical piece. Even without handoff notes, a fresh agent can `git diff` the worktree against the base branch and understand what was already done. Combined with the task spec, it has enough to continue.

---

## Handoff & Crystallization

Every agent session produces knowledge. The handoff system ensures that knowledge survives the session.

### Two Mechanisms

**1. Handoff Notes (per-ticket, immediate)**

When an agent finishes a phase cleanly, it writes a handoff note before exiting. This is ticket-specific context for the next agent working this ticket.

```
.dev-team/tickets/T-4a2b1c/
├── ticket.json                    # The ticket itself
└── handoffs/
    ├── 001-implementation.md      # Hank (builder): what I built and why
    ├── 002-deployment.md          # Gus (devops): sandbox details, any quirks
    ├── 003-self-test.md           # Hank (builder): what I tested, what passed/failed
    ├── 004-code-review.md         # Sal (reviewer): what I flagged and why
    └── 005-iteration.md           # Hank (builder): changes I made to address review
```

Handoff note structure:
```markdown
---
agent: Hank
role: frontend-developer
phase: implementation
ticket: T-4a2b1c
at: 2026-04-16T23:15:00.000Z
---

## What I Did
- Implemented sticky nav using `position: sticky` instead of `fixed`
- Had to add a `z-index: 100` to prevent content overlap
- Modified 3 files: nav-bar.component.ts, nav-bar.component.scss, app.component.html

## What's Not Done
- Haven't tested responsive breakpoints yet
- The mobile drawer animation might conflict with sticky positioning

## Gotchas
- The scroll container needs `overflow-y: auto` on the main content div, not the body
- Angular's `ViewEncapsulation.None` was needed for the sticky to work across shadow DOM boundaries

## For Next Agent
- The sandbox should be deployed to verify sticky behavior with real content scrolling
- Check mobile viewport (375px) — I only tested desktop
```

**2. Crystallization (per-role, periodic)**

When a ticket reaches a terminal state (merged, failed, stopped), the system runs a crystallization step. This extracts **role-level learnings** from the ticket's handoff notes and updates the role wiki.

```typescript
async function crystallize(ticket: Ticket): Promise<void> {
  // Read all handoff notes for this ticket
  const handoffs = readHandoffNotes(ticket.id);
  
  // For each role that worked on this ticket, extract learnings
  const roleGroups = groupBy(handoffs, h => h.role);
  
  for (const [role, notes] of Object.entries(roleGroups)) {
    // Spawn a short-lived crystallization agent
    // Its job: read the notes, read the current role wiki, write updates
    const session = agentService.createSession(undefined, undefined, role);
    await agentService.runMessage(session.id, buildCrystallizationPrompt(role, notes, ticket));
  }
}
```

The crystallization agent reads the handoff notes and asks:
- What did I learn that wasn't in the wiki?
- What pattern did I discover or confirm?
- What went wrong that future agents should avoid?
- What worked well that should be repeated?

It then updates the role wiki pages and appends to the log.

### What Gets Written to the Role Wiki

```
.dev-team/memory/frontend-developer/
├── index.md                           # Catalog of all wiki pages
├── log.md                             # Chronological: what was learned, when
└── wiki/
    ├── angular-patterns.md            # Patterns: sticky nav, scroll containers, ViewEncapsulation
    ├── review-lessons.md              # Common reviewer feedback to avoid
    ├── sandbox-quirks.md              # Things that behave differently in sandbox vs main
    ├── material-component-choices.md  # Which MUI/Material components work for what
    └── testing-playbook.md            # Playwright test patterns that work
```

Example wiki update after crystallization:
```markdown
<!-- angular-patterns.md, updated by crystallization from T-4a2b1c -->

### Sticky Positioning in Angular

When implementing sticky nav/headers:
- Use `position: sticky`, NOT `position: fixed` — fixed breaks the scroll context
- The scroll container must have `overflow-y: auto` on the direct parent, not `<body>`
- May need `ViewEncapsulation.None` if the sticky element crosses component boundaries
- Always set `z-index` (100+ for nav-level elements) to prevent content overlap

*Source: T-4a2b1c (Hank, 2026-04-16)*
```

### Context Injection at Agent Spawn

When a fresh agent spawns, its prompt includes (in order):

1. **Role definition** — static identity, tools, philosophy
2. **Task spec** — the `task.md` for this ticket
3. **Ticket state** — current status, history, dependencies
4. **Handoff notes** — all previous handoffs for this ticket (chronological)
5. **Relevant wiki pages** — pulled from role wiki index based on ticket content
6. **Worktree state** — `git status` and `git diff` of the worktree (injected or agent reads on startup)

This is everything a fresh agent needs to continue seamlessly. The session is gone; the knowledge persists.

---

## File Layout

```
.dev-team/
├── tickets/
│   ├── T-4a2b1c/
│   │   ├── ticket.json           # Ticket data + state + history
│   │   └── handoffs/             # Per-phase handoff notes
│   │       ├── 001-implementation.md
│   │       ├── 002-deployment.md
│   │       └── ...
│   ├── T-7f3e9d/
│   │   ├── ticket.json
│   │   └── handoffs/
│   └── ...
├── plans/                        # Decomposition output (replaces .coding-agent-data/backlog)
│   └── {plan-id}/
│       ├── plan.md
│       └── tasks/{project}/{feature}/{concern}/
│           └── task.md           # Spec only — tickets track status
├── memory/                       # Role wikis (LLM Wiki pattern)
│   ├── frontend-developer/
│   │   ├── index.md              # Catalog of wiki pages
│   │   ├── log.md                # Chronological learning log
│   │   └── wiki/                 # Accumulated knowledge pages
│   │       ├── angular-patterns.md
│   │       ├── review-lessons.md
│   │       └── ...
│   ├── designer/
│   │   ├── index.md
│   │   ├── log.md
│   │   └── wiki/
│   ├── devops/
│   │   └── ...
│   ├── code-reviewer/
│   │   └── ...
│   └── team-lead/
│       └── ...
├── names.json                    # Name pool + current assignments
└── engine/
    └── state.json                # Ticket engine metadata (last poll, health stats)
```

---

## Ticket JSON Example

```json
{
  "id": "T-4a2b1c",
  "title": "Implement nav bar sticky positioning",
  "specPath": ".dev-team/plans/p-a3f1b2/tasks/frontend-angular/features/navigation/concerns/component/task.md",
  "planId": "p-a3f1b2",
  "status": "self_testing",
  "assignedRole": "frontend-developer",
  "activeAgent": {
    "sessionId": "d4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e8f9a",
    "name": "Hank",
    "role": "frontend-developer",
    "phase": "self_test",
    "startedAt": "2026-04-16T23:45:00.000Z",
    "endedAt": null,
    "exitReason": null
  },
  "agentHistory": [
    {
      "sessionId": "8f2a1b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "Hank",
      "role": "frontend-developer",
      "phase": "implementation",
      "startedAt": "2026-04-16T22:30:00.000Z",
      "endedAt": "2026-04-16T23:15:00.000Z",
      "exitReason": "completed"
    },
    {
      "sessionId": "a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "Gus",
      "role": "devops",
      "phase": "deployment",
      "startedAt": "2026-04-16T23:16:00.000Z",
      "endedAt": "2026-04-16T23:40:00.000Z",
      "exitReason": "completed"
    }
  ],
  "dependsOn": ["T-1c3d5e"],
  "priority": "high",
  "branch": "ticket/T-4a2b1c",
  "worktreePath": ".worktrees/T-4a2b1c",
  "sandboxNamespace": "env-T-4a2b1c",
  "prNumber": null,
  "targetBranch": "local-scain",
  "history": [
    { "status": "created", "at": "2026-04-16T22:00:00.000Z", "trigger": "team-lead" },
    { "status": "blocked", "at": "2026-04-16T22:00:01.000Z", "trigger": "ticket-engine", "detail": "Waiting on T-1c3d5e" },
    { "status": "queued", "at": "2026-04-16T22:25:00.000Z", "trigger": "ticket-engine", "detail": "Dependency T-1c3d5e merged" },
    { "status": "in_progress", "at": "2026-04-16T22:30:00.000Z", "trigger": "ticket-engine", "detail": "Spawned agent Hank (frontend-developer) for implementation" },
    { "status": "ready_for_sandbox", "at": "2026-04-16T23:15:00.000Z", "trigger": "agent", "detail": "Hank completed implementation" },
    { "status": "sandbox_deploying", "at": "2026-04-16T23:16:00.000Z", "trigger": "ticket-engine", "detail": "Spawned agent Gus (devops) for deployment" },
    { "status": "sandbox_ready", "at": "2026-04-16T23:40:00.000Z", "trigger": "agent", "detail": "Gus deployed sandbox env-T-4a2b1c" },
    { "status": "self_testing", "at": "2026-04-16T23:45:00.000Z", "trigger": "ticket-engine", "detail": "Spawned fresh Hank (frontend-developer) for self-test" }
  ],
  "createdAt": "2026-04-16T22:00:00.000Z",
  "updatedAt": "2026-04-16T23:45:00.000Z"
}
```

Note: Hank appears twice — once for implementation, once for self-test. Same name (same role), different session. The handoff notes in `T-4a2b1c/handoffs/001-implementation.md` give the self-test Hank everything he needs to know about what the implementation Hank built.

---

## Agent Names

```json
// .dev-team/names.json
{
  "pool": [
    "Bob", "Hank", "Frank", "Dale", "Peggy", "Bill",
    "Nancy", "Lou", "Gus", "Marge", "Earl", "Dot",
    "Rusty", "Sal", "Norm", "Bev", "Roy", "Flo",
    "Clyde", "Barb", "Vince", "June", "Walt", "Dee",
    "Lenny", "Bonnie", "Hector", "Iris", "Milo", "Opal"
  ],
  "assigned": {
    "Hank": { "ticketId": "T-4a2b1c", "role": "frontend-developer", "sessionId": "8f2a..." },
    "Gus": { "ticketId": "T-4a2b1c", "role": "devops", "sessionId": "2b3c..." }
  }
}
```

When an agent is dismissed (ticket merged/failed/stopped), its name moves back to the pool.

---

## Branch & PR Flow

```
main (protected)
  └── local-scain (protected, PRs only)
        ├── ticket/T-4a2b1c  ← Hank's worktree branch
        │     └── PR #42 → local-scain
        ├── ticket/T-7f3e9d  ← Peggy's worktree branch
        │     └── PR #43 → local-scain
        └── ticket/T-9b1c2d  ← Bob's worktree branch (no PR yet)

Periodic sync: main → local-scain (automated, conflicts escalated to Team Lead)
Agent branches: always off local-scain (git checkout -b ticket/T-xxx local-scain)
PRs: always target local-scain
Promotion: you PR local-scain → main when satisfied
```

---

## Integration Points

### Backend Changes Needed

| Component | Change |
|-----------|--------|
| `router.service.ts` | Replace with `ticket-engine.service.ts` — polls ticket files instead of GitHub |
| `router.types.ts` | Replace with `ticket.types.ts` — the interfaces above |
| New: `watchdog.service.ts` | Periodic health checks on active tickets |
| New: `ticket.service.ts` | CRUD for ticket files, state transitions, validation |
| `mcp-server.ts` | Add `update_ticket_status` tool |
| `agent.service.ts` | Add agent name tracking, crystallization hook on session end |
| `agent.gateway.ts` | Emit ticket state change events to frontend via WebSocket |

### Frontend Changes Needed

| Component | Change |
|-----------|--------|
| New: `features/team/` | Team dashboard — agent roster, ticket board, agent detail views |
| `features/chat/` | Adapt for per-agent chat (click agent → see their stream) |
| `features/environments/` | Keep but reframe — secondary to team view |
| `nav-bar.tsx` | Add "Team" as primary nav item |

### MCP Server Changes

| Tool | Purpose | Used by |
|------|---------|---------|
| `update_ticket_status` | Report state transitions | All agents |
| `write_handoff` | Write handoff notes before session ends | All agents |
| `read_ticket` | Read own ticket details + handoff notes | All agents |
| `read_handoffs` | Read all handoff notes for a ticket | All agents (on spawn) |
| `list_tickets` | Query ticket board (filter by status, role, plan) | Team Lead |
| `create_ticket` | Create tickets from decomposition output | Team Lead |
| `assign_ticket` | Set role + priority on a ticket | Team Lead |
| `read_role_wiki` | Read relevant wiki pages for context | All agents (on spawn) |
| `update_role_wiki` | Write/update wiki pages | Crystallization agent |

### Agent Prompt Template

Every agent receives this structured context on spawn:

```
You are {name}, a {role} on THE Dev Team.

## Your Assignment
Ticket: {ticket.id} — "{ticket.title}"
Phase: {phase}
Status: {ticket.status}

## Task Specification
{contents of ticket.specPath}

## What's Happened So Far
{ticket history summary — which agents worked, what they did}

## Handoff Notes
{contents of all handoff files, chronological}

## Workspace State
Branch: {ticket.branch}
Worktree: {ticket.worktreePath}
Sandbox: {ticket.sandboxNamespace} ({sandbox URL if deployed})
PR: #{ticket.prNumber} (if opened)
Target branch: {ticket.targetBranch}

## Role Knowledge
{relevant wiki pages from .dev-team/memory/{role}/wiki/}

## Before You Finish
You MUST write a handoff note using the write_handoff tool before
updating the ticket status. Include:
- What you did
- What's not done
- Any gotchas or context the next agent needs
- Recommendations for the next phase
```
