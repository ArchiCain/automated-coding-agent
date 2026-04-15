# Decomposition Structure

This document defines the hierarchical structure used when decomposing work in this system. All decomposition discussions should reference this structure.

## Hierarchy Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                            PLAN                                 │
│         (brainstorming output - ideas & requirements)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   PROJECT     │   │   PROJECT     │   │   PROJECT     │
│   Backend     │   │   Frontend    │   │  Integration  │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
    ┌───┴───┐           ┌───┴───┐           ┌───┴───┐
    ▼       ▼           ▼       ▼           ▼       ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│FEATURE│ │FEATURE│ │FEATURE│ │FEATURE│ │FEATURE│ │FEATURE│
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼         ▼
{specialty} {specialty} {specialty} {specialty} {specialty} {specialty}
```

## Level Definitions

### Plan
The top-level output from a brainstorming session. Contains:
- Problem statement
- Requirements (functional and non-functional)
- High-level architecture decisions
- Scope boundaries

**Artifact**: `plan.md`

### Project
A major area of work, typically aligned with a codebase or deployment unit.

**Examples**:
- Backend API
- Frontend SPA
- CLI Tool
- Shared Library
- Integration/E2E Tests

**Each project should have clear boundaries** - what's in scope, what's not.

### Feature
A cohesive unit of functionality within a project. Features are self-contained and could theoretically be developed independently.

**Examples**:
- `auth` - authentication and authorization
- `brainstorming` - brainstorming session management
- `websocket-client` - real-time communication layer
- `plans-dashboard` - UI for viewing/managing plans

### {specialty}
The atomic unit of work - small enough that Claude can execute it confidently. The type varies based on context:

**Backend specialties**:
- `controller` - HTTP endpoint handlers
- `service` - business logic
- `gateway` - WebSocket handlers
- `guard` - authentication/authorization
- `middleware` - request processing
- `module` - NestJS module wiring
- `types` - TypeScript interfaces/types
- `utils` - helper functions

**Frontend specialties**:
- `page` - routable view component
- `component` - reusable UI component
- `service` - data fetching/state management
- `guard` - route protection
- `directive` - DOM manipulation
- `pipe` - data transformation
- `styles` - CSS/SCSS
- `template` - HTML structure

**Shared specialties**:
- `model` - data structures
- `config` - configuration
- `test` - unit/integration tests
- `docs` - documentation

## Decomposition Rules

### When to stop decomposing

A task is atomic enough when:
1. It has a **single responsibility** (one thing to do)
2. It can be **verified** (clear acceptance criteria)
3. It's **small enough** that Claude can hold the full context
4. It has **no ambiguity** about what "done" means

### Signs you need to decompose further

- Task description uses "and" multiple times
- Multiple files need to be created/modified
- Task has sub-steps that could fail independently
- You can't write clear acceptance criteria

## Visual Reference

When discussing decomposition, use this ASCII representation:

```
PLAN
 └── PROJECT
      └── FEATURE
           └── {specialty}  ← atomic task
```

Or horizontally:

```
PLAN → PROJECT → FEATURE → {specialty}
```

## Example Decomposition

```
Plan: "Web UI for Planner & Decomp Engine"
 │
 ├── Project: Backend
 │    ├── Feature: claude-session
 │    │    ├── service: ClaudeCodeSessionService
 │    │    ├── types: session.types.ts
 │    │    ├── types: events.types.ts
 │    │    ├── utils: session-helpers.ts
 │    │    ├── module: claude-session.module.ts
 │    │    └── test: claude-code-session.service.spec.ts
 │    │
 │    └── Feature: brainstorming
 │         ├── gateway: brainstorming.gateway.ts
 │         ├── service: brainstorming-session.service.ts
 │         ├── service: plan-management.service.ts
 │         ├── controller: plans.controller.ts
 │         └── types: brainstorming.types.ts
 │
 └── Project: Frontend
      ├── Feature: plans-dashboard
      │    ├── page: PlansListPage
      │    ├── component: PlanCard
      │    └── service: plans.service.ts
      │
      └── Feature: brainstorming-ui
           ├── page: BrainstormingPage
           ├── component: ChatPanel
           ├── component: PlanPreviewPanel
           └── component: MessageInput
```

## Status Flow

Each level can have a status:

```
draft → ready → executing → completed
                    │
                    └──→ failed → (retry)
```

- **draft**: Still being defined/decomposed
- **ready**: Fully specified, waiting to execute
- **executing**: Work in progress
- **completed**: Done and verified
- **failed**: Attempted but unsuccessful
