# Claude Code Out-of-Box Flow

This document describes the planning and decomposition flow for autonomous task execution using Claude Code skills, agents, commands, and hooks. This is a prototype for testing theories before building the full web UI.

---

## Philosophy

The goal is to transform scattered thoughts and requirements into executable atomic tasks through a series of human-reviewed stages. Each stage adds structure while preserving the creative intent of the original ideas.

**Key Principles:**
- Human approval at every stage (no runaway automation)
- Context-efficient storage (LLM can process without token explosion)
- Visual feedback via ASCII boxes (prototype for web UI)
- Flexible input, structured output
- Deep project understanding before decomposition

---

## The Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PREREQUISITE: Project Documentation                                        │
│  ═══════════════════════════════════                                        │
│                                                                             │
│  Before any planning/decomposition, the repo must be "readable":            │
│  - Every project has a README.md at its root                                │
│  - Every package within a project has a README.md                           │
│  - READMEs document: purpose, structure, APIs, dependencies                 │
│                                                                             │
│  Tool: project-documenter (agent or skill)                                  │
│  Run: Once to bootstrap, periodically to maintain                           │
│                                                                             │
│  After this, "understanding a project" = reading its READMEs                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 0: Brainstorm (Planner Skill)                                        │
│  ═══════════════════════════════════                                        │
│                                                                             │
│  Input Methods:                                                             │
│  - Interactive Q&A session (dev and LLM go back and forth)                  │
│  - Document dump (dev pastes existing specs, notes, ideas)                  │
│  - Hybrid (dump + clarifying questions)                                     │
│                                                                             │
│  Process:                                                                   │
│  1. LLM ingests all information                                             │
│  2. LLM asks clarifying questions until wholistic understanding             │
│  3. LLM summarizes what it understood                                       │
│  4. Dev approves or corrects                                                │
│  5. Plan document created                                                   │
│                                                                             │
│  Output: .backlog/p-{id}/plan.md                                            │
│                                                                             │
│  The plan.md is NOT heavily structured. It's the LLM's synthesis of the     │
│  brainstorm - comprehensible to another LLM that will decompose it.         │
│  Think: "smart notes" not "formal spec"                                     │
│                                                                             │
│  NO DECOMPOSITION HAPPENS HERE. Just understanding and documenting.         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CONTINUOUS SYNC (runs throughout brainstorm)                        │   │
│  │  ────────────────────────────────────────────                        │   │
│  │  The plan.md is created IMMEDIATELY when brainstorming starts and    │   │
│  │  updated frequently throughout the conversation. This ensures:       │   │
│  │  - Session crash → document has everything up to that point          │   │
│  │  - Context compaction → document survives summarization              │   │
│  │  - Dev walks away → can resume later with full context               │   │
│  │                                                                      │   │
│  │  Implementation: Background sync agent (see Continuous Sync section) │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                              [Dev Approval]
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: Project Split (Decomp Skill - First Pass)                         │
│  ══════════════════════════════════════════════════                         │
│                                                                             │
│  Input: plan.md + project READMEs                                           │
│                                                                             │
│  Process:                                                                   │
│  1. LLM reads plan.md                                                       │
│  2. LLM reads README.md for each project in the repo                        │
│  3. LLM determines which projects are affected                              │
│  4. For each affected project, LLM extracts:                                │
│     - What needs to be done in THIS project                                 │
│     - What this project PROVIDES to others (contracts out)                  │
│     - What this project REQUIRES from others (contracts in)                 │
│  5. Present as ASCII boxes for review                                       │
│                                                                             │
│  Output:                                                                    │
│  - Visual: ASCII box per project showing scope + contracts                  │
│  - Storage: Tasks added to tasks.jsonl (see Storage section)                │
│                                                                             │
│  These tasks are NOT atomic. They're project-level chunks.                  │
│  Dev reviews and can:                                                       │
│  - Approve all → move to Stage 2                                            │
│  - Edit a project's scope                                                   │
│  - Reject → back to brainstorm                                              │
│  - Decompose one project → drill into Stage 2 for just that project         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                              [Dev Approval]
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2+: Atomic Breakdown (Decomp Skill - Deep Pass)                      │
│  ═════════════════════════════════════════════════════                      │
│                                                                             │
│  Input: Project-level task + project README + contracts                     │
│                                                                             │
│  Process:                                                                   │
│  1. Dev selects a project to decompose (e.g., "decompose backend")          │
│  2. LLM reads the project-level task                                        │
│  3. LLM reads the project's README (understands structure, patterns)        │
│  4. LLM breaks into smaller tasks                                           │
│  5. For each subtask, determine:                                            │
│     - Is it atomic? (Can complete in <2hrs, 2-4 acceptance criteria)        │
│     - Dependencies (what must complete first)                               │
│     - Can run in parallel with siblings?                                    │
│  6. Present as ASCII flow chart                                             │
│                                                                             │
│  Output:                                                                    │
│  - Visual: ASCII flow chart showing task tree with dependencies             │
│  - Storage: Subtasks added to tasks.jsonl with parent references            │
│                                                                             │
│  If a subtask is still not atomic, dev can decompose further.               │
│  This creates a hierarchy: project → chunk → task → subtask                 │
│                                                                             │
│  Dev reviews and can:                                                       │
│  - Approve → tasks marked ready for execution                               │
│  - Edit a task                                                              │
│  - Split further → decompose a non-atomic task                              │
│  - Back → return to project view                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                              [Dev Approval]
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXECUTION (Existing Infrastructure)                                        │
│  ═══════════════════════════════════                                        │
│                                                                             │
│  Once all tasks are atomic and approved:                                    │
│  - /execute-plan spawns workers                                             │
│  - task-worker implements each task (TDD)                                   │
│  - validator verifies acceptance criteria                                   │
│  - Hooks manage the lifecycle                                               │
│                                                                             │
│  (This part already exists and works)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Structure

```
.backlog/
└── p-{plan-id}/
    ├── plan.md              # Stage 0 output: brainstorm synthesis
    ├── tasks.jsonl          # All tasks at all levels (append-only)
    ├── state.json           # Plan metadata and current state
    └── contexts/            # Execution context for workers (existing)
```

### plan.md Format

Flexible, organic, LLM-readable. NOT a rigid template.

Conventions (not rules):
- Bullet points for discrete thoughts
- Headers for major topic shifts
- Code blocks for technical specifics
- Questions and answers inline
- References to other docs as needed

Example:
```markdown
# Authentication System

The app needs user auth. Email/password for v1, maybe OAuth later.

## What we discussed
- JWT tokens, stored in httpOnly cookies (not localStorage - security)
- Password reset via email link
- Rate limiting on login attempts (prevent brute force)
- Session timeout: 7 days, refresh on activity

## Edge cases
- What if user tries to sign up with existing email? → Show "already exists" error
- What if password reset link expires? → 24hr expiry, can request new one
- Multiple devices? → Yes, each gets own session

## Projects affected
- Backend: auth endpoints, middleware
- Frontend: login/signup forms, protected routes
- Database: users table, sessions table

## Open questions resolved
- Q: Do we need email verification on signup?
- A: No for v1, add later

## Success criteria
- User can sign up, log in, log out
- Protected routes redirect to login
- Password reset works end-to-end
```

### tasks.jsonl Format

Append-only log of all tasks. Hierarchy via parent_id. Dependencies via depends_on.

```jsonl
{"id":"t-001","plan_id":"p-7f3a2b","title":"Backend auth implementation","level":"project","parent_id":null,"atomic":false,"status":"pending","contracts":{"provides":["POST /auth/login","POST /auth/signup"],"requires":["users table"]}}
{"id":"t-002","plan_id":"p-7f3a2b","title":"Frontend auth UI","level":"project","parent_id":null,"atomic":false,"status":"pending","contracts":{"provides":[],"requires":["POST /auth/login","POST /auth/signup"]}}
{"id":"t-003","plan_id":"p-7f3a2b","title":"Database auth schema","level":"project","parent_id":null,"atomic":false,"status":"pending","contracts":{"provides":["users table","sessions table"],"requires":[]}}
{"id":"t-001-1","plan_id":"p-7f3a2b","title":"Create auth router skeleton","level":"task","parent_id":"t-001","atomic":true,"status":"pending","depends_on":[],"acceptance_criteria":["Router exists at /auth","POST /login returns 501","POST /signup returns 501"]}
{"id":"t-001-2","plan_id":"p-7f3a2b","title":"Implement login endpoint","level":"task","parent_id":"t-001","atomic":true,"status":"pending","depends_on":["t-001-1","t-003-1"],"acceptance_criteria":["Validates email/password","Returns JWT on success","Returns 401 on failure"]}
```

Fields:
- `id`: Unique task ID. Format: t-{parent}-{seq} for hierarchy
- `plan_id`: Which plan this belongs to
- `title`: Human-readable task name
- `level`: "project" | "chunk" | "task" | "subtask" (depth indicator)
- `parent_id`: Parent task ID (null for top-level project splits)
- `atomic`: Boolean - can this be executed as-is?
- `status`: "pending" | "ready" | "in_progress" | "completed" | "failed"
- `contracts`: For project-level tasks, what it provides/requires
- `depends_on`: Array of task IDs that must complete first
- `acceptance_criteria`: For atomic tasks, how we know it's done

### state.json Format

```json
{
  "plan_id": "p-7f3a2b",
  "title": "Authentication System",
  "created_at": "2024-01-15T10:30:00Z",
  "stage": "project_split",
  "status": "awaiting_review",
  "stats": {
    "total_tasks": 6,
    "atomic_tasks": 2,
    "pending": 6,
    "completed": 0
  }
}
```

Stages:
- `draft` - Plan created but not approved
- `approved` - Plan approved, ready for decomposition
- `project_split` - Stage 1 complete, project-level tasks exist
- `decomposing` - Stage 2 in progress
- `ready` - All tasks atomic and approved
- `executing` - Workers running
- `completed` - All tasks done

---

## ASCII UI Interaction Model

The ASCII boxes serve as both visualization and interaction prompt. They show the current state and suggest commands.

### Stage 1: Project Split View

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  PLAN: p-7f3a2b  "Authentication System"                                      ║
║  Stage: PROJECT SPLIT                                                         ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────┐ ║
║   │ [1] BACKEND            │  │ [2] FRONTEND           │  │ [3] DATABASE    │ ║
║   │ ════════════           │  │ ════════════           │  │ ════════════    │ ║
║   │                        │  │                        │  │                 │ ║
║   │ Auth REST API          │  │ Login/signup forms     │  │ Users table     │ ║
║   │ JWT middleware         │  │ Token management       │  │ Sessions table  │ ║
║   │ Password hashing       │  │ Protected routes       │  │ Migrations      │ ║
║   │ Rate limiting          │  │ Error handling         │  │                 │ ║
║   │                        │  │                        │  │                 │ ║
║   │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│  │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│  │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│ ║
║   │ Provides:              │  │ Provides:              │  │ Provides:       │ ║
║   │  POST /auth/login      │  │  (none)                │  │  users table    │ ║
║   │  POST /auth/signup     │  │                        │  │  sessions table │ ║
║   │                        │  │ Requires:              │  │                 │ ║
║   │ Requires:              │  │  POST /auth/login      │  │ Requires:       │ ║
║   │  users table           │  │  POST /auth/signup     │  │  (none)         │ ║
║   │                        │  │                        │  │                 │ ║
║   │ [NOT ATOMIC]           │  │ [NOT ATOMIC]           │  │ [NOT ATOMIC]    │ ║
║   └────────────────────────┘  └────────────────────────┘  └─────────────────┘ ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Actions:                                                                     ║
║  • "decompose 1" or "decompose backend" → Break down into tasks               ║
║  • "show 2" or "show frontend" → View full details                            ║
║  • "edit 3" → Modify project scope                                            ║
║  • "approve" → Accept all, ready for atomic breakdown                         ║
║  • "back" → Return to plan view                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Stage 2: Task Breakdown View (After decomposing Backend)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  PLAN: p-7f3a2b  "Authentication System"                                      ║
║  Project: BACKEND                                                             ║
║  Stage: ATOMIC BREAKDOWN                                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║                        ┌─────────────────────────────┐                        ║
║                        │ [1] Create auth router      │                        ║
║                        │     POST /login (stub)      │                        ║
║                        │     POST /signup (stub)     │                        ║
║                        │     ✓ ATOMIC                │                        ║
║                        └─────────────┬───────────────┘                        ║
║                                      │                                        ║
║                                      ▼                                        ║
║                        ┌─────────────────────────────┐                        ║
║                        │ [2] Implement signup        │                        ║
║                        │     Validate input          │                        ║
║                        │     Hash password           │                        ║
║                        │     Create user record      │                        ║
║                        │     ✓ ATOMIC                │                        ║
║                        │     Requires: DATABASE [3]  │                        ║
║                        └─────────────┬───────────────┘                        ║
║                                      │                                        ║
║                    ┌─────────────────┼─────────────────┐                      ║
║                    ▼                 ▼                 ▼                      ║
║   ┌──────────────────────┐ ┌─────────────────┐ ┌──────────────────────┐       ║
║   │ [3] Implement login  │ │ [4] JWT helper  │ │ [5] Password reset   │       ║
║   │     Check password   │ │     Sign token  │ │     Generate link    │       ║
║   │     Return JWT       │ │     Verify token│ │     Validate + reset │       ║
║   │     ✓ ATOMIC         │ │     ✓ ATOMIC    │ │     ✗ NOT ATOMIC     │       ║
║   └──────────────────────┘ └─────────────────┘ └──────────────────────┘       ║
║          (parallel)              (parallel)         (needs split)             ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Actions:                                                                     ║
║  • "decompose 5" → Break down password reset further                          ║
║  • "show 3" → View full task details + acceptance criteria                    ║
║  • "edit 4" → Modify task                                                     ║
║  • "approve" → Accept breakdown (warning: task 5 not atomic)                  ║
║  • "back" → Return to project split view                                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Navigation Pattern

The ASCII UI creates a drill-down navigation:

```
Plan Overview
    │
    ├── [decompose backend] ──► Backend Task Tree
    │                               │
    │                               ├── [decompose 5] ──► Password Reset Subtasks
    │                               │                          │
    │                               │                          └── [back] ──► Backend Task Tree
    │                               │
    │                               └── [back] ──► Plan Overview
    │
    ├── [decompose frontend] ──► Frontend Task Tree
    │
    └── [decompose database] ──► Database Task Tree
```

Commands are contextual - what's available depends on current view.

---

## Cross-Project Contracts

When decomposing, the LLM must understand how projects depend on each other. This is captured in the `contracts` field:

**contracts.provides**: What this project exposes to others
- API endpoints (with shapes)
- Database tables (with schemas)
- Shared types/interfaces
- Events/messages

**contracts.requires**: What this project needs from others
- Same categories as above

When generating tasks for a project, the LLM includes contract information so workers know:
1. What they're building must match the "provides" contract
2. What they depend on will be available per the "requires" contract

Example: Backend task depends on `DATABASE [3]` (users table). The worker knows the table will exist with the agreed schema.

---

## Continuous Sync Architecture

The plan.md must be a **living document** throughout the brainstorm session. If the session ends unexpectedly, crashes, or context gets compacted, the document should contain everything discussed up to that point.

### The Problem

During a brainstorm session:
1. Dev and LLM go back and forth for 20+ turns
2. Lots of decisions made, edge cases discussed, questions resolved
3. Session crashes / dev closes terminal / context compacts
4. All that context is LOST unless captured in the document

### The Solution: Extract → Delegate Pattern

The key insight: **keep the main conversation lean** by offloading document management to disposable subagents.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MAIN AGENT (Brainstorming)                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  Focus: Conversation with dev                                               │
│  Responsibility: Identify key information as it emerges                     │
│                                                                             │
│  When something important is discussed:                                     │
│  1. Extract the key point (tiny payload)                                    │
│  2. Spawn plan-sync subagent with payload                                   │
│  3. Continue conversation (don't wait)                                      │
│                                                                             │
│  Main context only grows by:                                                │
│  - The extraction (small)                                                   │
│  - Subagent confirmation (tiny)                                             │
│                                                                             │
│  Main context does NOT include:                                             │
│  - Reading plan.md                                                          │
│  - Synthesis reasoning                                                      │
│  - Writing plan.md                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Small structured payload
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PLAN-SYNC SUBAGENT (Disposable)                                            │
│  ═══════════════════════════════                                            │
│                                                                             │
│  Model: haiku (fast, cheap)                                                 │
│  Lifecycle: Spawn → do work → die (context discarded)                       │
│                                                                             │
│  Input: Small structured payload from main agent                            │
│  {                                                                          │
│    "plan_id": "p-7f3a2b",                                                   │
│    "type": "decision",                                                      │
│    "content": "Use JWT tokens stored in httpOnly cookies",                  │
│    "context": "Security concern about localStorage"                         │
│  }                                                                          │
│                                                                             │
│  Job:                                                                       │
│  1. Read current plan.md                                                    │
│  2. Add/update the appropriate section                                      │
│  3. Write plan.md                                                           │
│  4. Return brief confirmation                                               │
│                                                                             │
│  Output: "Added to Decisions section"                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Token Efficiency

| Approach | Main Context Cost | Subagent Cost | Total |
|----------|-------------------|---------------|-------|
| Main agent does everything | High (accumulates) | N/A | High |
| Extract → Delegate | Low (just extractions) | Moderate (disposable) | Lower |

The Extract → Delegate pattern wins because:
- Main conversation stays focused on brainstorming
- Heavy lifting happens in disposable contexts
- Subagent cost is isolated, doesn't compound

### What Gets Extracted (Small Payloads)

The main agent identifies **type + content + brief context**:

```json
{"type": "requirement", "content": "Password reset via email link"}
{"type": "decision", "content": "JWT tokens, not sessions", "why": "Stateless scaling"}
{"type": "edge_case", "q": "Duplicate email on signup?", "a": "Show 'already exists' error"}
{"type": "open_question", "content": "Email verification needed?", "status": "discussing"}
{"type": "resolved_question", "q": "OAuth support?", "a": "Deferred to v2"}
{"type": "scope", "project": "backend", "work": "Auth endpoints, JWT middleware"}
{"type": "constraint", "content": "Must work offline"}
{"type": "success_criterion", "content": "User can sign up, log in, log out"}
```

These payloads are tiny. The subagent does the work of:
- Reading the current document
- Figuring out where to add/update
- Maintaining coherent structure
- Writing the updated document

### Sync Triggers

Main agent spawns plan-sync subagent when it recognizes:

| Trigger | Example |
|---------|---------|
| Decision made | "Let's go with JWT tokens" |
| Requirement stated | "We need password reset" |
| Question resolved | "No OAuth for v1" |
| Edge case discussed | "What if email exists?" → answer |
| Scope identified | "This affects backend and frontend" |
| Constraint mentioned | "Must support mobile" |

The main agent doesn't need perfect detection - occasional missed items are caught by safety hooks.

### Safety Hooks

Even with continuous extraction, hooks provide a safety net:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PreCompact Hook                                                            │
│  ───────────────                                                            │
│  Fires: When context is about to be compacted                               │
│  Action: Spawn plan-sync with instruction to do FULL synthesis              │
│  Purpose: Catch anything the incremental extractions missed                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Stop Hook (during planning mode)                                           │
│  ────────────────────────────────                                           │
│  Fires: When session ends or user exits                                     │
│  Action: Final sync + mark plan as "draft" or "interrupted"                 │
│  Purpose: Ensure clean state for resume                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SessionStart Hook                                                          │
│  ─────────────────                                                          │
│  Fires: When new session starts                                             │
│  Action: Check for interrupted plans, offer to resume                       │
│  Purpose: Seamless continuation after interruption                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Plan-Sync Subagent Design

```yaml
name: plan-sync
model: haiku  # Fast, cheap, sufficient for document updates
tools:
  - Read (plan.md only)
  - Write (plan.md only)

input_schema:
  plan_id: string (required)
  type: enum [requirement, decision, edge_case, open_question,
              resolved_question, scope, constraint, success_criterion,
              full_sync]
  content: string
  context: string (optional, for additional detail)
  # For edge_case and questions:
  q: string (the question)
  a: string (the answer, if resolved)
  # For scope:
  project: string
  work: string

behavior:
  - If type is "full_sync": rewrite entire document from provided context
  - Otherwise: surgically add/update the relevant section
  - Maintain consistent document structure
  - Return brief confirmation of what was updated
```

### How the Document Evolves

**Start of session** (main agent creates initial file):
```markdown
# Plan: p-7f3a2b
Created: 2024-01-15T10:30:00Z
Status: drafting

## Initial Request
Dev wants to add user authentication to the app.
```

**After a few extractions** (subagent has added incrementally):
```markdown
# Plan: p-7f3a2b
Created: 2024-01-15T10:30:00Z
Status: drafting

## Initial Request
Dev wants to add user authentication to the app.

## Requirements
- Email/password auth for v1
- Password reset via email

## Decisions
- JWT tokens (not sessions) - stateless scaling
- Store in httpOnly cookies - security concern about localStorage

## Open Questions
- Email verification on signup? - still discussing
```

**After approval** (final state):
```markdown
# Plan: p-7f3a2b
Created: 2024-01-15T10:30:00Z
Status: approved

## Initial Request
Dev wants to add user authentication to the app.

## Requirements
- Email/password auth for v1
- Password reset via email
- Session management
- Rate limiting on login attempts

## Decisions
- JWT tokens stored in httpOnly cookies
- 7 day expiry, refresh on activity
- No email verification for v1
- No OAuth for v1

## Edge Cases
- Duplicate email on signup → Show "already exists" error
- Expired reset link → 24hr expiry, can request new one
- Multiple devices → Each gets own session

## Scope
- Backend: auth endpoints, JWT middleware
- Frontend: login/signup forms, protected routes
- Database: users table, sessions table

## Success Criteria
- User can sign up, log in, log out
- Protected routes redirect to login
- Password reset works end-to-end
```

### Resuming an Interrupted Session

When dev returns to an interrupted plan:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  INTERRUPTED PLAN DETECTED                                                    ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Plan: p-7f3a2b "User Authentication"                                         ║
║  Last updated: 2024-01-15T11:45:00Z (2 hours ago)                             ║
║  Status: drafting (interrupted)                                               ║
║                                                                               ║
║  Summary of what we discussed:                                                ║
║  • Email/password auth with JWT tokens                                        ║
║  • Password reset via email link                                              ║
║  • No OAuth for v1                                                            ║
║                                                                               ║
║  Open questions when interrupted:                                             ║
║  • Email verification on signup - still discussing                            ║
║                                                                               ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Actions:                                                                     ║
║  • "resume" → Continue brainstorming where we left off                        ║
║  • "show plan" → View full plan.md                                            ║
║  • "approve" → Accept plan as-is, move to decomposition                       ║
║  • "discard" → Delete this plan and start fresh                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Open Questions

### Q1: How deep should decomposition go?

Current rule: atomic = <2 hours + 2-4 acceptance criteria

But what if a task is complex enough that even after splitting, subtasks are >2 hours?
- Option A: Keep splitting (risk: too granular, overhead)
- Option B: Allow some larger atomic tasks if well-defined
- Option C: Hard limit on depth (e.g., 3 levels max)

### Q2: How to handle cross-project dependencies during execution?

If Backend task [2] depends on Database task [1], and they're in different projects:
- Option A: Execute Database project first, then Backend
- Option B: Allow parallel start, block at dependency points
- Option C: Worker checks dependency status before proceeding

### Q3: What happens when contracts conflict?

Frontend expects `POST /auth/login` to return `{ token, user }`
Backend team decides to return `{ accessToken, refreshToken, userData }`

How is this caught and resolved?
- Option A: Contract validation step before execution
- Option B: Discovered during execution (frontend tests fail)
- Option C: Schema definitions in a shared location

### Q4: Plan versioning

If dev edits a task after decomposition, what happens to children?
- Option A: Children orphaned, must re-decompose
- Option B: Children preserved, may be inconsistent
- Option C: Edit triggers re-decomposition suggestion

### Q5: Continuous sync mechanism - RESOLVED

**Decision: Extract → Delegate Pattern**

Main agent extracts key points as small structured payloads → spawns disposable haiku subagent → subagent maintains document.

Why this wins:
- Main conversation stays lean (just extractions + confirmations)
- Heavy lifting (read/synthesize/write) happens in disposable subagent context
- Safety hooks (PreCompact, Stop) catch anything missed
- Cost is isolated, doesn't compound over long sessions

Open implementation questions:
- Can we run plan-sync subagent truly in background (non-blocking)?
- What's the right trigger frequency? Every key point vs. batching?
- How does PreCompact hook pass conversation context for full_sync?

---

## Implementation Order

1. **project-documenter** ✅ IMPLEMENTED
   - `/document-projects` command orchestrates parallel README creation
   - `readme-writer` agent (sonnet) creates individual READMEs
   - `list-documentation-targets.sh` script discovers projects/packages
   - See: `.claude/commands/document-projects.md`, `.claude/agents/readme-writer.md`

2. **planner (refactored)** ✅ IMPLEMENTED
   - Pure brainstorm mode - asks questions, captures decisions
   - Creates plan.md immediately and keeps it updated
   - Uses Extract → Delegate pattern with plan-sync agent
   - Outputs plan.md (NOT tasks.jsonl - that's decomp's job)
   - See: `.claude/skills/planner/SKILL.md`

3. **plan-sync mechanism** ✅ IMPLEMENTED
   - Haiku agent that maintains plan.md during brainstorming
   - Receives structured payloads: decision, requirement, edge_case, etc.
   - Supports full_sync for comprehensive updates before compaction
   - See: `.claude/agents/plan-sync.md`

4. **decomp (refactored - two stages)** ✅ IMPLEMENTED
   - Stage 1: Project split with ASCII boxes + contracts
   - Stage 2: Atomic breakdown with dependency flow chart
   - Supports natural commands: "decompose 1", "decompose backend"
   - Creates tasks.jsonl with proper hierarchy
   - See: `.claude/skills/decomp/SKILL.md`

5. **Plan viewer command** ✅ IMPLEMENTED
   - `/plan [plan-id]` shows current state
   - Supports --full, --tasks, --status modes
   - Context-appropriate action suggestions
   - See: `.claude/commands/plan.md`

6. **Session resume hook** ✅ IMPLEMENTED
   - SessionStart hook detects interrupted plans
   - Shows resumption prompt with options
   - See: `.claude/hooks/scripts/detect-interrupted-plans.sh`

7. **PreCompact hook** ✅ IMPLEMENTED
   - Triggers full sync before context compaction
   - Ensures no brainstorming context is lost
   - See: `.claude/hooks/scripts/precompact-plan-sync.sh`

8. **Execution integration** ✅ ALREADY EXISTS
   - `/execute-plan` command handles worker spawning
   - task-worker agent implements tasks with TDD
   - validator agent verifies completion
   - SubagentStop hook chains validation
   - See: `.claude/commands/execute-plan.md`

---

## Notes

- This is a prototype. The ASCII UI will become a web UI.
- Storage format may evolve as we learn what works.
- The goal is human-AI collaboration, not full automation.
- Each stage is a checkpoint. Dev can stop, edit, restart anytime.

---

## Learnings & Patterns

### Pattern: Command → Script → Parallel Agents

Discovered while building project-documenter:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SLASH COMMAND (orchestrator)                                               │
│  ───────────────────────────                                                │
│  - Entry point for user                                                     │
│  - Parses arguments                                                         │
│  - Calls discovery script                                                   │
│  - Spawns agents in parallel                                                │
│  - Reports results                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SHELL SCRIPT (discovery)                                                   │
│  ────────────────────────                                                   │
│  - Scans filesystem                                                         │
│  - Outputs structured JSON                                                  │
│  - Fast, no LLM cost                                                        │
│  - Reusable across commands                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AGENTS (parallel workers)                                                  │
│  ────────────────────────                                                   │
│  - One agent per target                                                     │
│  - Haiku model (fast, cheap)                                                │
│  - Single responsibility                                                    │
│  - Spawned in parallel (single message, multiple Task calls)                │
└─────────────────────────────────────────────────────────────────────────────┘
```

Benefits:
- **Cost-efficient**: Shell script for discovery (free), haiku for simple tasks
- **Parallel execution**: All agents run simultaneously
- **Single responsibility**: Each agent does one thing well
- **Composable**: Script can be reused, agents can be composed

### Pattern: Haiku for Focused Tasks

When a task is:
- Well-defined with clear inputs/outputs
- Doesn't require complex reasoning
- Can be templated or structured

Use **haiku** model:
- 10x+ cheaper than sonnet
- Faster response times
- Sufficient for mechanical tasks

Examples:
- README generation (structured output)
- Validation (checking criteria)
- Document sync (extracting + writing)

### Learning: Parallel Agent Spawning

To run agents in parallel, you MUST:
1. Send a SINGLE message with MULTIPLE Task tool calls
2. Do NOT await individual results before spawning next
3. Collect results after all agents complete

```
WRONG (sequential):
  spawn agent 1 → wait → spawn agent 2 → wait → spawn agent 3

RIGHT (parallel):
  spawn agent 1, agent 2, agent 3 → wait for all → collect results
```

### Files Created/Modified

```
.claude/
├── agents/
│   ├── plan-sync.md             # NEW: Haiku agent for document sync
│   ├── project-documenter.md    # (superseded by readme-writer)
│   ├── readme-writer.md         # Creates README for single target
│   ├── task-worker.md           # Existing: implements atomic tasks
│   └── validator.md             # Existing: validates task completion
├── commands/
│   ├── document-projects.md     # Orchestrates parallel README creation
│   ├── execute-plan.md          # Existing: spawns workers
│   ├── list-worktrees.md        # Existing: shows plan worktrees
│   └── plan.md                  # NEW: View plan state
├── skills/
│   ├── planner/
│   │   └── SKILL.md             # REFACTORED: Pure brainstorm mode
│   ├── decomp/
│   │   └── SKILL.md             # REFACTORED: Two-stage decomposition
│   ├── orchestrator/
│   │   └── SKILL.md             # Existing: monitors execution
│   └── project-context/
│       └── SKILL.md             # Existing: codebase understanding
├── hooks/
│   ├── hooks.json               # UPDATED: Added planning hooks
│   └── scripts/
│       ├── precompact-plan-sync.sh     # NEW: Full sync before compaction
│       ├── detect-interrupted-plans.sh # NEW: Detect plans to resume
│       ├── spawn-validator.sh          # Existing
│       ├── load-checkpoint.sh          # Existing
│       ├── create-plan-worktree.sh     # Existing
│       ├── remove-plan-worktree.sh     # Existing
│       └── list-plan-worktrees.sh      # Existing
└── scripts/
    └── list-documentation-targets.sh   # Discovers projects/packages

ideas/
├── claude-code-oob-flow.md      # This document
└── oob-flow-decisions.md        # NEW: Decisions made during implementation
```

---

## Complete Flow Summary

Here's how all the pieces connect from idea to execution:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: ENSURE PROJECT READABILITY                                             │
│  ═══════════════════════════════════                                            │
│                                                                                 │
│  /document-projects                                                             │
│       │                                                                         │
│       ├─→ list-documentation-targets.sh (discovers projects/packages)           │
│       │                                                                         │
│       └─→ readme-writer agents (parallel, creates READMEs)                      │
│                                                                                 │
│  Result: Every project has a README.md                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: BRAINSTORM (Planner Skill)                                             │
│  ═════════════════════════════════                                              │
│                                                                                 │
│  User: "I want to add feature X"                                                │
│       │                                                                         │
│       ├─→ Creates .backlog/p-{id}/plan.md immediately                           │
│       │                                                                         │
│       ├─→ Asks clarifying questions                                             │
│       │                                                                         │
│       ├─→ Spawns plan-sync (haiku) for each decision/requirement                │
│       │   (keeps plan.md updated throughout)                                    │
│       │                                                                         │
│       └─→ Shows summary, gets approval                                          │
│                                                                                 │
│  Result: Approved plan.md with full understanding                               │
│                                                                                 │
│  Hooks:                                                                         │
│  • PreCompact → triggers full_sync before context compaction                    │
│  • SessionStart → detects interrupted plans, offers resume                      │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: PROJECT SPLIT (Decomp Stage 1)                                         │
│  ═══════════════════════════════════════                                        │
│                                                                                 │
│  /decomp p-{id}                                                                 │
│       │                                                                         │
│       ├─→ Reads plan.md                                                         │
│       │                                                                         │
│       ├─→ Reads project READMEs                                                 │
│       │                                                                         │
│       ├─→ Creates project-level tasks with contracts                            │
│       │   (provides/requires for cross-project dependencies)                    │
│       │                                                                         │
│       └─→ Shows ASCII boxes for review                                          │
│                                                                                 │
│  Result: tasks.jsonl with project-level tasks                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: ATOMIC BREAKDOWN (Decomp Stage 2)                                      │
│  ═════════════════════════════════════════                                      │
│                                                                                 │
│  "decompose backend" or "decompose 1"                                           │
│       │                                                                         │
│       ├─→ Reads project README for patterns                                     │
│       │                                                                         │
│       ├─→ Creates atomic subtasks with:                                         │
│       │   - 2-4 acceptance criteria each                                        │
│       │   - <2 hour estimated time                                              │
│       │   - Clear dependencies                                                  │
│       │                                                                         │
│       └─→ Shows ASCII dependency tree                                           │
│                                                                                 │
│  Result: All tasks atomic, ready for execution                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: EXECUTION                                                              │
│  ═════════════════                                                              │
│                                                                                 │
│  /execute-plan p-{id}                                                           │
│       │                                                                         │
│       ├─→ Creates isolated worktree: .worktrees/p-{id}/                         │
│       │                                                                         │
│       ├─→ Starts Docker environment                                             │
│       │                                                                         │
│       └─→ Spawns task-worker agents (parallel, respecting dependencies)         │
│                                                                                 │
│  Each worker:                                                                   │
│       ├─→ Implements task with TDD                                              │
│       ├─→ Checkpoints progress every 15 min                                     │
│       ├─→ Commits on completion                                                 │
│       └─→ SubagentStop hook → spawns validator                                  │
│                                                                                 │
│  Result: All tasks implemented and validated                                    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### View Plan State Anytime

```
/plan p-{id}           # Status overview
/plan p-{id} --full    # Full plan.md content
/plan p-{id} --tasks   # Task breakdown view
```

### Quick Reference

| Stage | Skill/Command | Input | Output |
|-------|--------------|-------|--------|
| 0. Docs | `/document-projects` | Projects | README.md files |
| 1. Brainstorm | planner skill | Feature idea | plan.md |
| 2. Project Split | `/decomp p-{id}` | plan.md | Project tasks |
| 3. Atomic Breakdown | "decompose backend" | Project task | Atomic tasks |
| 4. Execute | `/execute-plan` | Atomic tasks | Implemented code |
| Monitor | `/plan` | Plan ID | Status view |

---

*Implementation completed: 2026-01-12*
*All core OOB flow components are now in place.*
