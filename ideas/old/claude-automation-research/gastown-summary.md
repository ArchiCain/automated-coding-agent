# Gas Town: Comprehensive Architecture Summary

> A deep-dive reference document for the Gas Town multi-agent orchestration system.

## Executive Summary

Gas Town is a **multi-agent workspace orchestration system** for coordinating multiple Claude Code (or other AI) agents working on different tasks simultaneously. It solves the fundamental problem of coordinating 4-30+ agents working in parallel while maintaining:

- **Persistent work state** (via git-backed storage)
- **Agent coordination** (via mail, hooks, and molecules)
- **Scalable parallelism** (via worker pools and worktrees)
- **Autonomous operation** (via the Propulsion Principle)

---

## Core Principles

### 1. GUPP: Gas Town Universal Propulsion Principle

> **"If you find something on your hook, YOU RUN IT."**

This is the heartbeat of autonomous operation. Gas Town is conceptualized as a **steam engine** where agents are **pistons**:

- There is no supervisor polling asking "did you start yet?"
- The hook IS the assignment - it was placed there deliberately
- Every moment an agent waits is a moment the engine stalls
- Other agents may be blocked waiting on that agent's output

**Startup Behavior:**
1. Check hook (`gt hook`)
2. Work hooked → EXECUTE immediately
3. Hook empty → Check mail for attached work
4. Nothing anywhere → ERROR: escalate to Witness

### 2. MEOW: Molecular Expression of Work

Breaking large goals into detailed, trackable instructions for agents. Work is decomposed into **atomic units** that agents can execute autonomously. Supported by:
- **Beads** (atomic work units)
- **Formulas** (workflow templates)
- **Molecules** (active workflow instances)

### 3. NDI: Nondeterministic Idempotence

The overarching goal ensuring useful outcomes through orchestration of potentially unreliable processes. Key mechanisms:
- **Persistent Beads** guarantee eventual workflow completion
- **Oversight agents** (Witness, Deacon) handle failures
- Any worker can continue any molecule
- Steps are atomic checkpoints in beads

---

## System Architecture

### Two-Level Structure

```
                    TOWN LEVEL (~/gt/)
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
 Mayor              Deacon               .beads/
 (coordinator)      (watchdog)           (hq-* prefix)
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
                    RIG LEVEL

 Rig A                 Rig B                Rig C
 ├── Witness           ├── Witness          ├── Witness
 ├── Refinery          ├── Refinery         ├── Refinery
 ├── Polecats/         ├── Polecats/        ├── Polecats/
 │   ├── Toast         │   ├── Amber        │   ├── Rust
 │   └── Shadow        │   └── Jade         │   └── Chrome
 └── Crew/             └── Crew/            └── Crew/
     └── joe               └── alice            └── bob
```

### Directory Structure

```
~/gt/                           Town root
├── .beads/                     Town-level beads (hq-* prefix)
│   ├── config.yaml             Beads configuration
│   ├── issues.jsonl            Town issues (mail, agents, convoys)
│   └── routes.jsonl            Prefix → rig routing table
├── mayor/                      Mayor agent home
│   ├── town.json               Town configuration
│   ├── CLAUDE.md               Mayor context
│   └── .claude/settings.json   Mayor settings
├── deacon/                     Deacon daemon home
│   ├── heartbeat.json          Deacon freshness indicator
│   ├── dogs/                   Deacon helpers
│   │   └── boot/               Health triage dog
│   └── .claude/settings.json   Deacon settings
└── <rig>/                      Project container (NOT a git clone)
    ├── config.json             Rig identity and beads prefix
    ├── .beads/ → mayor/rig/.beads  (symlink)
    ├── .repo.git/              Bare repo (shared by worktrees)
    ├── mayor/rig/              Canonical clone (beads live here)
    │   └── CLAUDE.md           Per-rig context
    ├── refinery/rig/           Worktree on main branch
    ├── witness/                No clone (monitors only)
    ├── crew/<name>/rig/        Human workspaces (full clones)
    └── polecats/<name>/rig/    Worker worktrees (ephemeral)
```

---

## Agent Taxonomy

### Town-Level Agents (Singletons)

| Agent | Purpose | Session | Lifecycle |
|-------|---------|---------|-----------|
| **Mayor** | Global coordinator, cross-rig communication, escalation handling | `gt-mayor` | Persistent, user-initiated |
| **Deacon** | Daemon beacon - monitors agents, runs patrol cycles, triggers recovery | `hq-deacon` | Persistent, continuous loop |
| **Boot** | Triages Deacon health (is it stuck or working?) | `gt-boot` | Ephemeral, fresh each tick |

### Rig-Level Agents (Per-Project)

| Agent | Purpose | Session | Lifecycle |
|-------|---------|---------|-----------|
| **Witness** | Monitors polecats, nudges stuck workers, handles cleanup | `gt-<rig>-witness` | Persistent, patrol loop |
| **Refinery** | Processes merge queue, runs verification, handles conflicts | `gt-<rig>-refinery` | Persistent, on-demand |
| **Polecat** | Ephemeral worker with own worktree, works on single issue | `gt-<rig>-<name>` | Transient, task-bound |
| **Crew** | Persistent worker for human-directed work | `gt-<rig>-crew-<name>` | Long-lived, user-managed |

### Infrastructure Helpers

| Agent | Purpose | Owner |
|-------|---------|-------|
| **Dogs** | Deacon's maintenance agents for background tasks | Deacon |
| **Boot** | Special dog that checks Deacon health every 5 minutes | Daemon |

---

## Worker Types Deep Dive

### Polecats: Ephemeral Workers

Polecats are the workhorses of Gas Town - ephemeral workers that:
- Spawn for specific tasks
- Work in isolated git worktrees
- Complete work and disappear

**Three-Layer Lifecycle:**

| Layer | Component | Lifecycle | Persistence |
|-------|-----------|-----------|-------------|
| **Session** | Claude (tmux pane) | Ephemeral | Cycles per step/handoff |
| **Sandbox** | Git worktree | Persistent | Until nuke |
| **Slot** | Name from pool | Persistent | Until nuke |

**Key Insight:** Session cycling is **normal operation**, not failure. The polecat continues working - only the Claude context refreshes.

**States:**
- `working` - Actively working on an issue
- `done` - Completed work, ready for cleanup
- `stuck` - Needs assistance

**Name Pool System:**
```go
// Built-in themes with 50 names each
var BuiltinThemes = map[string][]string{
    "mad-max": {"furiosa", "nux", "toast", "shadow", ...},
    "minerals": {"obsidian", "quartz", "amber", "jade", ...},
    "wasteland": {"rust", "chrome", "nitro", "dust", ...},
}
```

When pool exhausts, overflow names use `rigname-N` format.

### Crew: Persistent Workers

Crew members are long-lived agents for ongoing work:
- Human-directed or self-assigned work
- Full git clones (not worktrees)
- Push directly to main branch
- No Witness monitoring

### Dogs: Infrastructure Helpers

Dogs are NOT workers - they're the Deacon's helpers:
- Very short lifecycle (single task)
- Handle infrastructure tasks
- Example: Boot checks Deacon health

**Dog Pool Architecture (for shutdown dances):**

```go
type Dog struct {
    ID        string
    Warrant   *Warrant          // Death warrant being processed
    State     ShutdownDanceState
    Attempt   int               // Current attempt (1-3)
}

// States: idle → interrogating → evaluating → pardoned|executing → complete
```

Fixed pool of 5 dogs handles concurrent shutdown dances with escalating timeouts:
- Attempt 1: 60s
- Attempt 2: 120s
- Attempt 3: 240s

---

## Work Tracking Systems

### Beads: Atomic Work Units

Beads are git-backed atomic work units stored in JSONL format:

```json
{
  "id": "gt-abc123",
  "title": "Implement user auth",
  "type": "task",
  "status": "in_progress",
  "created_by": "gastown/crew/joe"
}
```

**Two-Level Beads Architecture:**

| Level | Location | Prefix | Purpose |
|-------|----------|--------|---------|
| **Town** | `~/gt/.beads/` | `hq-*` | Cross-rig coordination, Mayor mail |
| **Rig** | `<rig>/mayor/rig/.beads/` | project prefix | Implementation work, MRs |

### Molecules: Workflow Execution

```
Formula (source TOML) ─── "Ice-9"
    │
    ▼ bd cook
Protomolecule (frozen template) ─── Solid
    │
    ├─▶ bd mol pour ──▶ Mol (persistent) ─── Liquid ──▶ bd squash ──▶ Digest
    │
    └─▶ bd mol wisp ──▶ Wisp (ephemeral) ─── Vapor ──┬▶ bd squash ──▶ Digest
                                                     └▶ bd burn ──▶ (gone)
```

**Key Commands:**
```bash
bd mol current           # Where am I in the molecule?
bd ready                 # What step is next?
bd close <step> --continue  # Close and auto-advance
```

### Convoys: Work Batching

Convoys are the primary unit for tracking batched work:

```
            🚚 Convoy (hq-cv-abc)
                    │
       ┌────────────┼────────────┐
       │            │            │
       ▼            ▼            ▼
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ gt-xyz  │  │ gt-def  │  │ bd-abc  │
  │ gastown │  │ gastown │  │  beads  │
  └────┬────┘  └────┬────┘  └────┬────┘
       │            │            │
       ▼            ▼            ▼
  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │  nux    │  │ furiosa │  │  amber  │
  │(polecat)│  │(polecat)│  │(polecat)│
  └─────────┘  └─────────┘  └─────────┘
                    │
               "the swarm"
               (ephemeral)
```

**Convoy vs Swarm:**
- **Convoy**: Persistent tracking unit (`hq-cv-*` prefix)
- **Swarm**: Ephemeral - just the workers currently on convoy's issues

### Hooks: Persistent Work Queues

Hooks are special pinned beads for each agent:
- Git worktree-based persistent storage
- Survives crashes and restarts
- When work appears on hook, GUPP dictates immediate execution

---

## Monitoring & Health Systems

### Watchdog Chain (Three-Tier)

```
Daemon (Go process)          ← Dumb transport, 3-min heartbeat
    │
    └─► Boot (AI agent)       ← Intelligent triage, fresh each tick
            │
            └─► Deacon (AI agent)  ← Continuous patrol, long-running
                    │
                    └─► Witnesses & Refineries  ← Per-rig agents
```

**Why three tiers?**
1. **Daemon can't reason** - It's Go code, can't interpret agent state
2. **Boot provides intelligent triage** - Distinguishes "stuck" from "thinking"
3. **Deacon can't observe itself** - Needs external watchdog

### Heartbeat Mechanics

**Daemon Heartbeat (3 minutes):**
```go
func (d *Daemon) heartbeatTick() {
    d.ensureBootRunning()           // 1. Spawn Boot for triage
    d.checkDeaconHeartbeat()        // 2. Belt-and-suspenders fallback
    d.ensureWitnessesRunning()      // 3. Witness health
    d.ensureRefineriesRunning()     // 4. Refinery health
    d.triggerPendingSpawns()        // 5. Bootstrap polecats
    d.processLifecycleRequests()    // 6. Cycle/restart requests
}
```

**Deacon Heartbeat File:**
```json
{
  "timestamp": "2026-01-02T18:30:00Z",
  "cycle": 42,
  "last_action": "health-scan",
  "healthy_agents": 3,
  "unhealthy_agents": 0
}
```

**Freshness States:**
| Age | State | Boot Action |
|-----|-------|-------------|
| < 5 min | Fresh | Nothing (Deacon active) |
| 5-15 min | Stale | Nudge if pending mail |
| > 15 min | Very stale | Wake (Deacon may be stuck) |

### Patrol Agents

Deacon, Witness, and Refinery run continuous patrol loops:

| Agent | Patrol Molecule | Responsibility |
|-------|-----------------|----------------|
| **Deacon** | `mol-deacon-patrol` | Agent lifecycle, health checks |
| **Witness** | `mol-witness-patrol` | Monitor polecats, nudge stuck |
| **Refinery** | `mol-refinery-patrol` | Process merge queue |

---

## Communication Systems

### Mail Protocol

Agents coordinate via mail messages routed through beads:

**Message Types:**

| Type | Route | Purpose |
|------|-------|---------|
| `POLECAT_DONE` | Polecat → Witness | Signal work completion |
| `MERGE_READY` | Witness → Refinery | Branch ready for merge |
| `MERGED` | Refinery → Witness | Confirm successful merge |
| `MERGE_FAILED` | Refinery → Witness | Merge attempt failed |
| `REWORK_REQUEST` | Refinery → Witness | Rebase needed |
| `WITNESS_PING` | Witness → Deacon | Second-order monitoring |
| `HELP` | Any → Mayor | Request intervention |
| `HANDOFF` | Agent → self/successor | Session continuity |

**Address Format:** `<rig>/<role>` or `<rig>/<type>/<name>`
```
gastown/witness       # Witness for gastown rig
beads/refinery        # Refinery for beads rig
gastown/polecats/nux  # Specific polecat
mayor/                # Town-level Mayor
```

### Nudging

Real-time messaging between agents:
```bash
gt nudge <agent> "message"
```

**Important:** Always use `gt nudge` - never raw `tmux send-keys`. The nudge command handles Claude's input correctly with literal mode + debounce.

### Handoff Protocol

Session continuity across context limits:
```bash
gt handoff  # Session cycles, new session reads handoff mail
```

---

## Merge Queue (Refinery)

### Merge Request Lifecycle

```
Polecat                    Witness                    Refinery
   │                          │                          │
   │ POLECAT_DONE             │                          │
   │─────────────────────────>│                          │
   │                          │                          │
   │                    (verify clean)                   │
   │                          │                          │
   │                          │ MERGE_READY              │
   │                          │─────────────────────────>│
   │                          │                          │
   │                          │                    (merge attempt)
   │                          │                          │
   │                          │ MERGED (success)         │
   │                          │<─────────────────────────│
   │                          │                          │
   │                    (nuke polecat)                   │
```

### MR Status Flow

```
MROpen ──(Engineer claims)──> MRInProgress ──(success)──> MRClosed
   │                              │
   │                              │ (failure)
   └──────────────────────────────┘
         (needs rework)
```

### Failure Types

| Type | Label | Action |
|------|-------|--------|
| `conflict` | `needs-rebase` | Assign back to worker |
| `tests_fail` | `needs-fix` | Assign back to worker |
| `build_fail` | `needs-fix` | Assign back to worker |
| `push_fail` | `needs-retry` | Retry internally |

---

## Escalation Protocol

### Severity Levels

| Level | Priority | Description |
|-------|----------|-------------|
| **CRITICAL** | P0 | System-threatening, immediate attention |
| **HIGH** | P1 | Important blocker, needs human soon |
| **MEDIUM** | P2 | Standard escalation |

### Escalation Categories

| Category | Description | Default Route |
|----------|-------------|---------------|
| `decision` | Multiple valid paths, need choice | Deacon → Mayor |
| `help` | Need guidance or expertise | Deacon → Mayor |
| `blocked` | Waiting on unresolvable dependency | Mayor |
| `failed` | Unexpected error | Deacon |
| `emergency` | Security/data integrity | Overseer (direct) |
| `gate_timeout` | Gate didn't resolve | Deacon |
| `lifecycle` | Worker stuck | Witness |

### Tiered Flow

```
Worker encounters issue
    │
    ▼
[Deacon receives] (default)
    │
    ├── Can resolve? → Updates issue, re-slings work
    │
    └── Cannot resolve? → Forward to Mayor
                              │
                              ├── Can resolve? → Updates issue
                              │
                              └── Cannot resolve? → Forward to Overseer
```

---

## Identity & Attribution

### BD_ACTOR Format

| Role Type | Format | Example |
|-----------|--------|---------|
| **Mayor** | `mayor` | `mayor` |
| **Deacon** | `deacon` | `deacon` |
| **Witness** | `{rig}/witness` | `gastown/witness` |
| **Refinery** | `{rig}/refinery` | `gastown/refinery` |
| **Crew** | `{rig}/crew/{name}` | `gastown/crew/joe` |
| **Polecat** | `{rig}/polecats/{name}` | `gastown/polecats/toast` |

### Attribution Model

```bash
# Git commits
GIT_AUTHOR_NAME="gastown/crew/joe"      # Agent identity
GIT_AUTHOR_EMAIL="steve@example.com"    # Owner identity

# Beads records
"created_by": "gastown/crew/joe"
"updated_by": "gastown/witness"
```

**Key Insight:** Agents execute. Humans own. The polecat name is executor attribution. The CV credits the human owner.

---

## Configuration System

### Property Layers (Four-Level)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. WISP LAYER (transient, town-local)                       │
│    Location: <rig>/.beads-wisp/config/                      │
│    Use: Temporary local overrides                           │
└─────────────────────────────────────────────────────────────┘
                              │ if missing
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. RIG BEAD LAYER (persistent, synced globally)             │
│    Location: <rig>/.beads/ (rig identity bead labels)       │
│    Use: Project-wide operational state                      │
└─────────────────────────────────────────────────────────────┘
                              │ if missing
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. TOWN DEFAULTS                                            │
│    Location: ~/gt/config.json or ~/gt/.beads/               │
│    Use: Town-wide policies                                  │
└─────────────────────────────────────────────────────────────┘
                              │ if missing
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. SYSTEM DEFAULTS (compiled in)                            │
│    Use: Fallback when nothing else specified                │
└─────────────────────────────────────────────────────────────┘
```

### Rig Control

**Park (Local, Ephemeral):**
```bash
gt rig park gastown      # Stop services locally
gt rig unpark gastown    # Allow restart
```

**Dock (Global, Persistent):**
```bash
gt rig dock gastown      # Set status:docked (syncs to all clones)
gt rig undock gastown    # Remove label
```

---

## Git Worktree Architecture

### Why Worktrees?

- **Fast spawning**: No full clone needed
- **Shared objects**: Efficient storage
- **Immediate visibility**: Polecat branches visible to refinery instantly
- **Isolation**: Each worker has own working directory

### Bare Repo Pattern

```
<rig>/
├── .repo.git/              # Bare repo (no working dir)
├── refinery/rig/           # Worktree on main
└── polecats/
    ├── Toast/rig/          # Worktree on polecat/Toast-<timestamp>
    └── Shadow/rig/         # Worktree on polecat/Shadow-<timestamp>
```

### Sparse Checkout

Gas Town excludes source repo's Claude config via sparse checkout:
```bash
git sparse-checkout set --no-cone '/*' '!/.claude/' '!/CLAUDE.md' '!/CLAUDE.local.md' '!/.mcp.json'
```

---

## Key Commands Reference

### Town Management
```bash
gt install [path] --git     # Create town with git init
gt doctor --fix             # Health check and auto-repair
```

### Convoy Operations
```bash
gt convoy create "name" gt-abc gt-def --notify mayor/
gt convoy list              # Dashboard
gt convoy status [id]       # Progress
```

### Work Assignment
```bash
gt sling <bead> <rig>                    # Assign to polecat
gt sling <bead> <rig> --agent codex      # Override runtime
```

### Agent Control
```bash
gt mayor attach             # Start Mayor session
gt prime                    # Alternative startup
gt handoff                  # Request session cycle
gt nudge <agent> "message"  # Send message
gt peek <agent>             # Check health
```

### Beads Operations
```bash
bd ready                    # Work with no blockers
bd mol current              # Where am I?
bd close <step> --continue  # Complete and advance
bd sync                     # Push/pull changes
```

---

## Relevant Concepts for Coding Agent

### From Gas Town to Apply

1. **Propulsion Principle**: Work drives execution - when work is assigned, execute immediately without polling

2. **Git Worktrees for Isolation**: Each worker operates in isolated worktree, preventing conflicts

3. **Three-Layer Worker Lifecycle**: Session (ephemeral) vs Sandbox (persistent) vs Slot (named pool)

4. **Watchdog Chain**: Tiered monitoring with daemon → boot → deacon → witnesses

5. **Convoy-Based Work Tracking**: Group related issues, track progress, notify on completion

6. **Mail-Based Coordination**: Async inter-agent communication with defined protocols

7. **Merge Queue (Refinery)**: Automated merge processing with conflict handling and retry

8. **Escalation Protocol**: Tiered escalation from worker → deacon → mayor → human

9. **Heartbeat System**: Freshness-based health monitoring with stale/very-stale thresholds

10. **Identity Attribution**: Every action traced to specific agent for audit and debugging

---

## Design Philosophy

### What Gas Town IS

- Task execution engine for AI agents
- Workspace manager with git-backed persistence
- Coordination layer for parallel work
- Audit trail for agent actions

### What Gas Town is NOT

- Not a chat interface
- Not a CI/CD system
- Not a project manager
- Not magic - requires good decomposition

### Success Criteria

1. **Developers trust it** - Click "Start" and do other work
2. **Output is mergeable** - Code passes review
3. **Failures are contained** - Damage limited to single task
4. **Learning compounds** - Each execution improves the next
