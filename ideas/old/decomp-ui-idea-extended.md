# Decomposition UI Extended: Full Repository Orchestration Platform

Building on the original decomposition UI concept, this document explores an expanded vision where the tool becomes a **single pane of glass** for the entire development ecosystem - not just task decomposition, but full repository management, environment orchestration, and an educational interface.

---

## Core Principles

1. **Progressive Disclosure** - Show just enough at each level, let curiosity drive deeper
2. **Everything is a Box** - Consistent drill-down metaphor at every level
3. **Claude on Demand** - AI assistance available everywhere, but opt-in to save tokens
4. **Work Flows Through Backlog** - Claude can advise and run tasks, but all file changes go through the Backlog system
5. **Local-First** - Runs locally, can execute any task command, full control over your environment

---

## Top-Level Dashboard

The entry point shows the entire repository ecosystem at a glance:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  rts-ai-dev-template                                        [💬] [☰]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PROJECTS                                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                                   │
│  │ backend │ │frontend │ │   e2e   │                                   │
│  │    ⋮    │ │    ⋮    │ │    ⋮    │                                   │
│  └─────────┘ └─────────┘ └─────────┘                                   │
│                                                                         │
│  ENVIRONMENTS                                                           │
│  ┌─ Local ──────────────────────────────────────────────────────────┐  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │  │
│  │  │ main             │ │ 006-agent        │ │ 007-feature      │  │  │
│  │  │ ● :3000, :8086   │ │ ● :3001, :8087   │ │ ○ stopped        │  │  │
│  │  │        ⋮         │ │        ⋮         │ │        ⋮         │  │  │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌─ Remote ─────────────────────────────────────────────────────────┐  │
│  │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │  │
│  │  │ dev              │ │ staging          │ │ prod             │  │  │
│  │  │ ● healthy        │ │ ● healthy        │ │ ● healthy        │  │  │
│  │  │        ⋮         │ │        ⋮         │ │        ⋮         │  │  │
│  │  └──────────────────┘ └──────────────────┘ └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  BACKLOG                                                                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ + New                                                             │  │
│  │ ◐ Claude SDK refactor ──────────────────────────────── 006-agent │  │
│  │ ◉ Auth flow ──────────────────────────────────────────────  main │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Dashboard Sections

| Section | Purpose |
|---------|---------|
| **Projects** | The actual code projects in the repo (backend, frontend, e2e, etc.) |
| **Environments > Local** | Docker environments for main repo and each worktree |
| **Environments > Remote** | Infrastructure deployments (dev, staging, prod via Terraform) |
| **Backlog** | Work items - from idea through completion |

### The Claude Button [💬]

- Located at top-right of dashboard (repo-level)
- Opens a **large modal** with Claude
- Has high-level knowledge of entire repo
- Can run ANY task command (knows all via `task list`)
- **Cannot make file changes** - advises only, changes flow through Backlog

---

## Drilling Into Projects

Clicking a project box reveals its structure, purpose, and available actions.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    coding-agent-backend                        [⋮] [💬 Claude]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATUS: ● Running on localhost:8086                                    │
│  ──────────────────────────────────────────────────────────────────     │
│                                                                         │
│  WHAT IS THIS?                                                          │
│  NestJS backend service providing REST APIs and WebSocket               │
│  connections for the coding agent. Handles plan management,             │
│  decomposition orchestration, and Claude Code integration.              │
│                                                                         │
│  STRUCTURE                              QUICK ACTIONS                   │
│  ┌───────────┐ ┌───────────┐           ┌─────────────────────────────┐ │
│  │ packages  │ │ etc...    │           │ ▶ task start                │ │
│  │ 5 modules │ │           │           │ ■ task stop                 │ │
│  └───────────┘ └───────────┘           │ ↻ task restart              │ │
│                                         │ 🧪 task test                │ │
│                                         │ 🔨 task build               │ │
│                                         └─────────────────────────────┘ │
│                                                                         │
│  DEPENDENCIES            RECENT ACTIVITY                               │
│  @nestjs/core 10.x       • 2h ago: Fixed CORS config                   │
│  socket.io 4.x           • 5h ago: Added decomposition controller      │
│  @anthropic-ai/sdk       • 1d ago: Initial setup                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Drilling Deeper (packages folder)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    backend / packages                          [⋮] [💬 Claude]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WHAT IS THIS?                                                          │
│  Internal packages following NestJS module pattern. Each package        │
│  is a self-contained domain with its own module, services, and DTOs.    │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ agent-runtime   │  │ decomposition-  │  │ project-config  │         │
│  │                 │  │ engine          │  │                 │         │
│  │ Claude Code CLI │  │ Task breakdown  │  │ Project type    │         │
│  │ process mgmt    │  │ orchestration   │  │ detection       │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐                              │
│  │ plan-storage    │  │ validation      │                              │
│  │                 │  │                 │                              │
│  │ Plan CRUD &     │  │ Schema & input  │                              │
│  │ persistence     │  │ validation      │                              │
│  └─────────────────┘  └─────────────────┘                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Project-Level Claude

Each project/area has its own [💬 Claude] button that opens with:
- Full context of that specific project
- Knowledge of its README, structure, patterns
- Access to project-specific task commands
- **Still cannot make file changes** - read-only advisor + task runner

---

## Drilling Into Environments

### Local Environment (Worktree)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    006-agent (local)                           [⋮] [💬 Claude]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATUS: ● Running                        Branch: auto-claude/006-...   │
│  ──────────────────────────────────────────────────────────────────     │
│                                                                         │
│  WHAT IS THIS?                                                          │
│  Local development environment for the coding agent MVP feature.        │
│  Isolated Docker stack with dedicated ports.                            │
│                                                                         │
│  SERVICES                               QUICK ACTIONS                   │
│  ┌───────────┐ ┌───────────┐           ┌─────────────────────────────┐ │
│  │ backend   │ │ frontend  │           │ ▶ task env:006:start        │ │
│  │ ● :8087   │ │ ● :3001   │           │ ■ task env:006:stop         │ │
│  └───────────┘ └───────────┘           │ ↻ task env:006:restart      │ │
│  ┌───────────┐ ┌───────────┐           │ 📊 task env:006:logs        │ │
│  │ postgres  │ │ redis     │           │ 🗑 task env:006:destroy     │ │
│  │ ● :5433   │ │ ● :6380   │           └─────────────────────────────┘ │
│  └───────────┘ └───────────┘                                           │
│                                         ASSOCIATED WORK                 │
│  PORTS                                  ┌─────────────────────────────┐│
│  Frontend: localhost:3001               │ ◐ Claude SDK refactor (3/5)││
│  Backend:  localhost:8087               │    [Open in Backlog →]      ││
│  Postgres: localhost:5433               └─────────────────────────────┘│
│  Redis:    localhost:6380                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Remote Environment (Infrastructure)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    staging (remote)                            [⋮] [💬 Claude]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATUS: ● Healthy                        Last deploy: 2h ago           │
│  ──────────────────────────────────────────────────────────────────     │
│                                                                         │
│  WHAT IS THIS?                                                          │
│  Staging environment for QA testing before production. Mirrors          │
│  prod infrastructure. Deployed via Terraform + GitHub Actions.          │
│                                                                         │
│  RESOURCES                              QUICK ACTIONS                   │
│  ┌───────────┐ ┌───────────┐           ┌─────────────────────────────┐ │
│  │ ECS       │ │ RDS       │           │ 📋 task infra:staging:plan  │ │
│  │ 2 tasks   │ │ db.t3.med │           │ 🚀 task infra:staging:apply │ │
│  │ ● healthy │ │ ● healthy │           │ 🔄 task staging:deploy      │ │
│  └───────────┘ └───────────┘           │ 📊 task staging:logs        │ │
│  ┌───────────┐ ┌───────────┐           └─────────────────────────────┘ │
│  │ ALB       │ │ S3        │                                           │
│  │ ● active  │ │ 3 buckets │           RECENT DEPLOYS                  │
│  └───────────┘ └───────────┘           • 2h ago: v1.2.3 (main@abc123) │
│                                         • 1d ago: v1.2.2 (main@def456) │
│  URLS                                   • 3d ago: v1.2.1 (main@789ghi) │
│  https://staging.myapp.com                                              │
│  https://api.staging.myapp.com                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backlog Item Lifecycle

Work items flow through defined states from idea to completion:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  BACKLOG ITEM LIFECYCLE                                                 │
│                                                                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│  │  DRAFT   │────▶│ PLANNING │────▶│  READY   │────▶│ RUNNING  │       │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘       │
│       │                │                 │                │             │
│       │                │                 │                │             │
│   User creates    Decomposition      All tasks        [Start]           │
│   new item        happening          approved         clicked           │
│                   (left→right                               │           │
│                    flowchart)                               ▼           │
│                                                    • Worktree created   │
│                                                    • Docker env spins up│
│                                                    • Agents begin work  │
│                                                                         │
│                                                                         │
│  ┌──────────┐     ┌──────────┐                                         │
│  │ COMPLETE │◀────│ REVIEW   │                                         │
│  └──────────┘     └──────────┘                                         │
│       │                │                                                │
│       │                │                                                │
│   Merged to        All tasks done,                                     │
│   main             validations pass,                                   │
│                    PR ready                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Points

- **No worktree/environment created until [Start]** - Plan fully first
- **All tasks must be approved** before starting
- **Validators (Definition of Done)** generated with each task, editable by user

---

## Backlog Item: Planning State

When drilling into a backlog item that's still being planned:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    Claude SDK Refactor                         [⋮] [💬 Claude]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATUS: ◐ Planning                    Environment: (not created yet)   │
│  ──────────────────────────────────────────────────────────────────     │
│                                                                         │
│  ┌─ DECOMPOSITION ──────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐    │  │
│  │  │         │     │ ✓       │     │ ◉       │     │ ○       │    │  │
│  │  │ Claude  │─────│ Backend │─────│ Agent   │─────│ Spawn   │    │  │
│  │  │ SDK...  │     │         │     │ Runtime │     │ Service │    │  │
│  │  │         │     │         │─────│─────────│     └─────────┘    │  │
│  │  │         │     └─────────┘     │ Stream  │─────┬─────────┐    │  │
│  │  │         │                     │ Gateway │     │ Socket  │    │  │
│  │  │         │     ┌─────────┐     └─────────┘     │ Handler │    │  │
│  │  │         │─────│ ◉       │                     └─────────┘    │  │
│  │  │         │     │ Frontend│                                    │  │
│  │  └─────────┘     │         │                                    │  │
│  │                  └─────────┘                                    │  │
│  │                                                                   │  │
│  │  Legend: ✓ approved  ◉ needs approval  ○ pending  ◐ decomposing  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  PROGRESS                                                               │
│  Tasks: 12 total │ 4 approved │ 3 need review │ 5 pending              │
│  ▓▓▓▓▓▓▓░░░░░░░░░░░░░ 33% ready                                        │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │                        [ Start Work ]                              ││
│  │                                                                    ││
│  │   ⚠ 3 tasks need approval before starting                         ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Backlog Item: Running State

After clicking [Start], worktree and environment are created, agents begin work:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Back    Claude SDK Refactor                         [⋮] [💬 Claude]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STATUS: ● Running                     Environment: 008-claude-sdk      │
│  ──────────────────────────────────────────────────────────────────     │
│                                         localhost:3002, :8088           │
│                                         [View Environment →]            │
│  ┌─ DECOMPOSITION ──────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐    │  │
│  │  │ ✓✓      │     │ ✓✓      │     │ ✓✓      │     │ ◐       │    │  │
│  │  │ Claude  │─────│ Backend │─────│ Agent   │─────│ Spawn   │    │  │
│  │  │ SDK...  │     │         │     │ Runtime │     │ Service │    │  │
│  │  │         │     │         │─────│─────────│     │ Agent   │    │  │
│  │  │         │     └─────────┘     │ ✓✓      │     │ working │    │  │
│  │  │         │                     │ Stream  │─────┬─────────┐    │  │
│  │  │         │     ┌─────────┐     │ Gateway │     │ ○       │    │  │
│  │  │         │─────│ ◐       │     └─────────┘     │ Socket  │    │  │
│  │  │         │     │ Frontend│                     │ Handler │    │  │
│  │  └─────────┘     │ Agent   │                     └─────────┘    │  │
│  │                  │ working │                                    │  │
│  │                  └─────────┘                                    │  │
│  │                                                                   │  │
│  │  Legend: ✓✓ complete  ✓ approved  ◐ agent working  ○ pending     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  PROGRESS                                                               │
│  Tasks: 12 total │ 8 complete │ 2 in progress │ 2 pending              │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ 67% complete                                     │
│                                                                         │
│  ACTIVE AGENTS                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐│
│  │ 🤖 Agent-1: Working on "Spawn Service"          [Logs] [Stop]     ││
│  │ 🤖 Agent-2: Working on "Frontend Components"    [Logs] [Stop]     ││
│  └────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Box States Reference

Boxes throughout the UI show status via icons:

```
┌─ PENDING ─────────┐   ┌─ IN PROGRESS ─────┐   ┌─ NEEDS APPROVAL ──┐
│ ○ Task Name       │   │ ◐ Task Name       │   │ ◉ Task Name       │
│                   │   │ ▓▓▓▓░░░░░░ 40%   │   │                   │
│ [not started]     │   │ [decomposing...]  │   │ [review required] │
└───────────────────┘   └───────────────────┘   └───────────────────┘

┌─ APPROVED ────────┐   ┌─ AGENT WORKING ───┐   ┌─ COMPLETE ────────┐
│ ✓ Task Name       │   │ ◐ Task Name       │   │ ✓✓ Task Name      │
│                   │   │ 🤖 Agent working  │   │                   │
│ [ready to start]  │   │ [in progress]     │   │ [done + verified] │
└───────────────────┘   └───────────────────┘   └───────────────────┘

┌─ FAILED ──────────┐   ┌─ VALIDATING ──────┐
│ ✗ Task Name       │   │ ⟳ Task Name       │
│                   │   │                   │
│ [validation fail] │   │ [checking DoD...] │
└───────────────────┘   └───────────────────┘
```

---

## Live Status on Boxes

Boxes show real-time state from the system:

```
┌─ coding-agent-backend ─┐     ┌─ coding-agent-backend ─┐
│ ● Running              │     │ ○ Stopped              │
│ localhost:8086         │     │                        │
│ CPU: 12% | Mem: 245MB  │     │ [▶ Start]              │
└────────────────────────┘     └────────────────────────┘

┌─ staging (terraform) ──┐     ┌─ staging (terraform) ──┐
│ ● Deployed             │     │ ⚠ Drift detected       │
│ Last apply: 2h ago     │     │ 3 resources changed    │
│ 12 resources           │     │ [Plan] [Apply]         │
└────────────────────────┘     └────────────────────────┘
```

---

## Box Actions

Each box has contextual actions available via ellipsis menu [⋮]:

**Project Box Actions:**
- ▶ Start / ■ Stop / ↻ Restart
- 🧪 Run Tests
- 🔨 Build
- 📊 View Logs
- 💬 Open Claude

**Environment Box Actions (Local):**
- ▶ Start / ■ Stop / ↻ Restart
- 📊 View Logs
- 🗑 Destroy
- 💬 Open Claude

**Environment Box Actions (Remote):**
- 📋 Plan (Terraform)
- 🚀 Apply (Terraform)
- 🔄 Deploy
- 📊 View Logs
- 💬 Open Claude

**Backlog Item Actions:**
- ✏️ Edit
- 🗑 Delete
- ↻ Regenerate (re-decompose)
- 💬 Open Claude

---

## Claude Integration

### Repo-Level Claude [💬]
- Top-right of dashboard
- Knows entire repo at high level
- Can run ANY task command (via `task list`)
- Cannot make file changes

### Context-Specific Claude [💬 Claude]
- Available on every drilled-down view
- Pre-loaded with context for that specific area:
  - Project: README, structure, dependencies, patterns
  - Environment: Status, config, recent activity
  - Backlog Item: Full decomposition, task details
- Can run relevant task commands
- Cannot make file changes - all changes flow through Backlog

### Claude Modal

When clicked, opens a large modal:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Claude - coding-agent-backend                                    [X]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                                                                   │ │
│  │  Claude: I have context about the coding-agent-backend project.  │ │
│  │  This is a NestJS service with 5 packages. How can I help?       │ │
│  │                                                                   │ │
│  │  You: What task commands are available for this project?         │ │
│  │                                                                   │ │
│  │  Claude: Here are the available tasks:                           │ │
│  │  • task backend:start - Start the dev server                     │ │
│  │  • task backend:test - Run unit tests                            │ │
│  │  • task backend:build - Build for production                     │ │
│  │  • task backend:lint - Run linter                                │ │
│  │                                                                   │ │
│  │  Would you like me to run any of these?                          │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │ Ask Claude...                                              [Send] │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Educational Value

The drill-down metaphor naturally teaches the codebase:

1. **Start at top level** - See the whole ecosystem
2. **Drill into Projects** - Learn what each service does
3. **Drill into packages** - Understand the architecture
4. **Drill into files** - See the actual implementation

Each level has:
- **"WHAT IS THIS?"** section explaining purpose
- **Claude available** to answer questions
- **Structure visualization** showing children
- **Recent activity** showing what's happening

This creates a self-documenting system where new team members can explore and understand the entire repo through the UI.

---

## Navigation

### Keyboard
| Key | Action |
|-----|--------|
| Arrow keys | Navigate between boxes |
| Enter | Drill into selected box |
| Backspace / Esc | Go back one level |
| Tab | Next box |
| Shift+Tab | Previous box |
| C | Open Claude for current context |

### Mouse
| Action | Result |
|--------|--------|
| Click box | Select |
| Double-click | Drill in |
| Right-click | Context menu (actions) |
| Click [⋮] | Open actions menu |
| Click [💬] | Open Claude modal |
| Click [← Back] | Go up one level |

---

## Technical Considerations

### Real-Time Updates
- WebSocket connections for live status
- Box states update as services start/stop
- Agent progress streams in real-time
- Environment health checks poll periodically

### Task Execution
- All task commands executed via local `task` CLI
- Output streamed to UI
- Can be triggered from boxes or via Claude

### State Management
- Backlog items persisted (local DB or file-based)
- Environment state derived from Docker/Terraform
- Project structure derived from filesystem

### Layout Engine
- Dashboard: Spatial/grid layout
- Decomposition view: Hierarchical left-to-right (Dagre algorithm)
- Responsive to different screen sizes
