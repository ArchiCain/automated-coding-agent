# Coding Agent: High-Level Overview

## Vision

Build an autonomous coding agent that transforms high-level feature requests into implemented, tested, and verified code—with human oversight at the right moments, not constant hand-holding.

The goal is not to replace developers but to amplify them: a developer describes what they want in plain language, collaborates with the agent to decompose it into well-defined tasks, then clicks "Start" and lets the agent execute while they focus on other work.

## The Problem

Current AI coding assistants operate in one of two modes:

1. **Too hands-on**: Chat-based assistants that require constant interaction, context re-establishment, and manual verification after every change.

2. **Too autonomous**: Fully autonomous agents that run without checkpoints, often going off-track and requiring significant cleanup.

Neither approach scales. The first exhausts developers with cognitive overhead. The second produces unreliable results that erode trust.

## The Solution: Decomposition + Autonomous Execution + Verification

Inspired by the MAKER framework's insight that **extreme decomposition + error correction** enables reliable multi-step AI execution, this agent:

1. **Decomposes** complex requests into atomic, verifiable tasks
2. **Executes** tasks autonomously with parallel workers
3. **Verifies** each task through multiple validation layers
4. **Learns** from execution to improve future performance

Human involvement is concentrated where it matters most:
- **Before execution**: Approving the decomposed plan
- **After execution**: Reviewing the completed work
- **On failure**: Intervening when automated recovery fails

## Core Principles

### From MAKER: Extreme Decomposition

> "A system with a 1% per-step error rate is expected to fail after only 100 steps of a million-step task."

The key insight: break tasks into the smallest possible atomic units. Each unit is simple enough that:
- The agent can complete it reliably
- Verification can confirm success
- Failure can be isolated and retried

### From MAKER: Error Correction at Each Step

Don't wait until the end to discover problems. Verify at each step through:
- **Self-verification**: Tests written as part of the task
- **Quick validation**: Cheap model confirms code matches intent
- **Phase gates**: Full test suite at milestones
- **Final review**: Comprehensive review before human handoff

### From Auto-Claude: Structured Workflows

Borrow the spec → plan → execute → QA pattern:
- Clear phases with defined outputs
- Subtask-based implementation plans
- QA validation loops for automatic fix cycles
- Session memory for context preservation

### From Gas Town: Parallel Execution

Maximize throughput through parallel workers:
- Task dependency graph enables parallel execution
- Independent tasks run simultaneously
- Workers coordinate through shared state
- Propulsion principle: work drives execution, not polling

### From Beads: Git-Native Storage

Plans and state live in the repository:
- JSONL format for append-friendly, conflict-resistant storage
- Hash-based IDs prevent merge conflicts
- Full audit trail in version control
- Resumable execution after interruption

## User Experience

### Phase 1: Request & Decompose

```
┌─────────────────────────────────────────────────────────────┐
│                        WEB INTERFACE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  What would you like to build?                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Add user authentication with email/password login,     │ │
│  │ JWT tokens, and password reset via email.              │ │
│  │                                                        │ │
│  │ [📎 Attach files] [🖼️ Add screenshots]                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Template: [Auto-detect ▼]  or  [CRUD Feature] [API] [Bug] │
│                                                              │
│                              [Generate Plan →]              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: Review & Refine

```
┌─────────────────────────────────────────────────────────────┐
│  Plan: User Authentication                    [Edit] [Start]│
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Tasks ───────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │  ✓ Create User entity                        [Atomic] │  │
│  │  ✓ Create Auth service                       [Atomic] │  │
│  │  ✓ Create Auth controller                    [Atomic] │  │
│  │  ▶ Add password reset flow              [Decompose ▼] │  │
│  │    │                                                   │  │
│  │    ├─ ✓ Create PasswordResetToken entity    [Atomic] │  │
│  │    ├─ ✓ Add email service                   [Atomic] │  │
│  │    └─ ✓ Add reset endpoints                 [Atomic] │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  Dependencies: Entity → Service → Controller                 │
│  Estimated parallel groups: 3                               │
│                                                              │
│                    [← Back]  [Start Execution →]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The user can:
- Click any task to see full description and acceptance criteria
- Click "Decompose" on non-atomic tasks for further breakdown
- Manually edit task descriptions or acceptance criteria
- Reorder tasks or modify dependencies
- Add new tasks manually

### Phase 3: Autonomous Execution

```
┌─────────────────────────────────────────────────────────────┐
│  Executing: User Authentication              [Pause] [Stop] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Progress: ████████░░░░░░░░░░░░ 4/10 tasks                  │
│                                                              │
│  ┌─ Active Workers (3/4) ─────────────────────────────────┐ │
│  │                                                         │ │
│  │  Worker 1: Create Auth service          [Running 2:34] │ │
│  │  Worker 2: Add email service            [Running 1:12] │ │
│  │  Worker 3: Create PasswordResetToken    [Running 0:45] │ │
│  │  Worker 4: Idle (waiting for dependencies)             │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Completed ────────────────────────────────────────────┐ │
│  │  ✓ Create User entity              [abc1234] 2:15      │ │
│  │  ✓ Create Auth DTOs                [def5678] 1:45      │ │
│  │  ✓ Create User migration           [ghi9012] 0:58      │ │
│  │  ✓ Create reset token migration    [jkl3456] 0:42      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Live Log ─────────────────────────────────────────────┐ │
│  │  10:32:15 Worker 1: Running tests for Auth service...  │ │
│  │  10:32:18 Worker 1: 5/5 tests passing                  │ │
│  │  10:32:20 Worker 1: Quick validation passed            │ │
│  │  10:32:22 Worker 3: Created PasswordResetToken entity  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The user can:
- Watch real-time progress
- See which workers are active and what they're doing
- View completed tasks and their commits
- Pause execution at any time
- Expand any task to see detailed logs

### Phase 4: Review & Merge

```
┌─────────────────────────────────────────────────────────────┐
│  Ready for Review: User Authentication                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─ Summary ──────────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  ✓ 10 tasks completed                                  │ │
│  │  ✓ 47 tests passing                                    │ │
│  │  ✓ No type errors                                      │ │
│  │  ✓ No lint errors (3 warnings)                         │ │
│  │  ⚠ 1 suggestion from review agent                      │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─ Review Agent Notes ───────────────────────────────────┐ │
│  │                                                         │ │
│  │  All acceptance criteria met. Implementation follows   │ │
│  │  project patterns.                                     │ │
│  │                                                         │ │
│  │  Suggestion: Consider adding rate limiting to the      │ │
│  │  login endpoint to prevent brute force attacks.        │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [View Full Diff]  [View Commits]  [Run Tests Locally]     │
│                                                              │
│            [Request Changes]  [Approve & Merge →]           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The user can:
- Review the summary of changes
- Read the review agent's analysis
- View the full diff or individual commits
- Run the test suite locally before approving
- Request changes (creates new tasks for fixes)
- Approve and merge to the target branch

## System Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           WEB FRONTEND                              │
│                      (React + WebSocket)                            │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                │ WebSocket (real-time updates)
                                │ REST API (CRUD operations)
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                         CODING-AGENT SERVICE                        │
│                           (NestJS)                                  │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │Decomposition│  │  Execution  │  │Verification │  │  Memory   │ │
│  │   Engine    │  │   Engine    │  │   System    │  │  System   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         │                │                │                │       │
│         └────────────────┴────────────────┴────────────────┘       │
│                                   │                                 │
│  ┌────────────────────────────────▼────────────────────────────┐   │
│  │                       LLM Router                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │ Claude Code  │  │    Cheap     │  │   Review     │       │   │
│  │  │     SDK      │  │   Models     │  │   Models     │       │   │
│  │  │ (Execution)  │  │(Haiku/Ollama)│  │  (Sonnet)    │       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└───────────────────────────────┬────────────────────────────────────┘
                                │
                                │ File System
                                │
┌───────────────────────────────▼────────────────────────────────────┐
│                          PROJECT REPOSITORY                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ .rtslabs/                                                    │   │
│  │ ├── config.json                                              │   │
│  │ ├── templates/                                               │   │
│  │ ├── plans/{plan-id}/                                        │   │
│  │ │   ├── meta.json, tasks.jsonl, state.json, ...            │   │
│  │ ├── worktrees/{plan-id}/    ← Isolated git worktrees        │   │
│  │ └── memory/                                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ src/                        ← Project source code            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Decomposition Engine

Transforms high-level requests into atomic, executable tasks.

**Responsibilities:**
- Parse user requests (text, images, files)
- Match against templates or generate custom decomposition
- Build task dependency graph
- Support iterative refinement (human requests further decomposition)
- Ensure all leaf tasks are atomic and verifiable

**Key insight**: The quality of decomposition directly determines execution success. A well-decomposed plan with clear acceptance criteria will execute reliably; a vague plan will produce vague results.

### 2. Execution Engine

Orchestrates parallel task execution with the Claude Code SDK.

**Responsibilities:**
- Manage git worktrees for plan isolation
- Coordinate worker pool for parallel execution
- Track task state and dependencies
- Handle commits per completed task
- Support pause/resume of execution

**Key insight**: Parallelism is critical for efficiency, but dependencies must be respected. The execution engine treats the task graph as a DAG and executes the maximum parallel set at each level.

### 3. Verification System

Multi-layered validation ensuring each task is complete and correct.

**Layers:**
1. **Self-verification**: Task writes and runs its own tests
2. **Quick validation**: Cheap model confirms code matches intent
3. **Phase gates**: Full test suite at milestone boundaries
4. **Final review**: Comprehensive review before human handoff

**Key insight**: Verification at each step catches errors early. A failed verification triggers a QA loop (retry with feedback) rather than cascading failures.

### 4. Memory System

Captures learnings to improve future execution.

**Components:**
- **Patterns**: Successful approaches for this project
- **Gotchas**: Pitfalls to avoid
- **Session insights**: What worked/failed per plan

**Key insight**: Projects have idioms. A memory system that captures "in this project, we always do X" prevents repeated mistakes and accelerates future tasks.

### 5. LLM Router

Directs requests to the appropriate model based on task type.

**Model allocation:**
| Task Type | Model | Rationale |
|-----------|-------|-----------|
| Code execution | Claude Code SDK | Full coding capability |
| Quick validation | Haiku / Ollama | Fast, cheap, sufficient for yes/no |
| Decomposition | Sonnet | Needs reasoning, not tool use |
| Final review | Sonnet / Opus | Comprehensive analysis |
| Compaction | Haiku | Summarization doesn't need power |

**Key insight**: Use expensive models only where necessary. MAKER demonstrated that small models with proper decomposition and error correction outperform large models on cost-effectiveness.

## Technical Decisions

### Why NestJS?

- Already used in the RTS Labs template repo
- Strong TypeScript support with decorators
- Built-in WebSocket support via Socket.IO
- Modular architecture with dependency injection
- Good fit for service-oriented design

### Why Claude Code SDK (not hooks)?

- Web UI requires programmatic control
- Need to stream results to frontend
- Human-in-the-loop for decomposition phase
- Simpler integration than tmux-based approaches
- Can still leverage Claude Code's tool use and context

### Why JSONL (not database)?

- Plans version-controlled with code
- Portable across environments
- No external dependencies
- Append-only format prevents data loss
- Easy to inspect and debug

### Why Git Worktrees?

- Isolated execution environment per plan
- Main branch stays clean during execution
- Multiple plans can execute simultaneously
- Natural rollback via branch deletion
- Preserves developer's local changes

## What This Is NOT

- **Not a chat interface**: This is task execution, not conversation
- **Not a code review tool**: Though it includes review, that's verification, not collaboration
- **Not a CI/CD system**: It creates code; CI/CD tests and deploys it
- **Not a project manager**: It executes defined work; humans define what's important
- **Not magic**: It requires good decomposition and clear acceptance criteria

## Success Criteria

The agent is successful when:

1. **Developers trust it**: They click "Start" and do other work, confident the agent will either succeed or pause at a sensible point.

2. **Output is mergeable**: The code produced passes review and can be merged without significant rework.

3. **Failures are contained**: When something goes wrong, the damage is limited to a single task, not the entire plan.

4. **Learning compounds**: Each execution makes future executions on the same project more reliable.

5. **Time is saved**: Despite the overhead of decomposition and verification, total developer time spent is less than manual implementation.

## Roadmap

### Phase 1: Foundation
- [ ] NestJS project setup
- [ ] File-based storage system (.rtslabs/)
- [ ] Basic decomposition with templates
- [ ] Single-worker execution with Claude Code SDK
- [ ] Self-verification layer
- [ ] Basic web UI for plan creation and monitoring

### Phase 2: Parallel Execution
- [ ] Worker pool implementation
- [ ] Task dependency graph execution
- [ ] Git worktree management
- [ ] Quick validation layer
- [ ] Real-time WebSocket updates

### Phase 3: Verification & QA
- [ ] Phase gate implementation
- [ ] QA loop for automatic retries
- [ ] Final review agent
- [ ] Red-flag detection

### Phase 4: Memory & Learning
- [ ] Pattern extraction
- [ ] Gotcha detection
- [ ] Cross-session context application
- [ ] Template suggestions based on history

### Phase 5: Polish & Scale
- [ ] Multi-project support
- [ ] Team collaboration features
- [ ] Performance optimization
- [ ] Comprehensive documentation

## Research Foundation

This design synthesizes learnings from:

### MAKER (Cognizant AI Lab, 2025)
- Extreme decomposition enables reliable multi-step execution
- Error correction via voting at each step
- Small models + decomposition beats large models on cost
- Red-flagging detects confused responses

### Auto-Claude
- Claude Code SDK for agent sessions
- Spec → Plan → Execute → QA workflow
- Subtask-based implementation plans
- Session memory for context preservation
- QA validation loops with automatic fixes

### Beads
- JSONL format for conflict-resistant storage
- Hash-based IDs prevent merge conflicts
- Git-backed persistence
- Dependency tracking as first-class concept

### Gas Town
- Parallel worker coordination
- Git worktrees for isolation
- Role-based agent architecture
- Propulsion principle (work drives execution)

## Conclusion

The coding agent is not about replacing developers or achieving AGI-level coding. It's about finding the sweet spot where AI handles the mechanical aspects of implementation—translating well-defined tasks into code—while humans retain control over what gets built and when it's good enough.

The key innovations are:
1. **Decomposition-first**: Invest time upfront to create atomic, verifiable tasks
2. **Verify at every step**: Catch errors early, contain failures
3. **Parallel by default**: Maximize throughput where dependencies allow
4. **Learn from execution**: Each run improves the next

Done well, this creates a powerful multiplier: developers think at the feature level while the agent handles the function level.
