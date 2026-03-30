# Backlog System

The coding agent uses a file-based backlog system stored in `.backlog/` at the repo root. Plans are decomposed through a 4-level hierarchy.

## Decomposition hierarchy

```
PLAN → PROJECT → FEATURE → {specialty}
```

### Plan

Top-level output from a brainstorming session. Contains problem statement, requirements, architecture decisions, and scope.

**Artifact:** `plan.md`

### Project

A major area of work aligned with a codebase (e.g., Backend, Frontend, E2E Tests).

### Feature

A cohesive unit of functionality within a project (e.g., `auth`, `websocket-client`, `plans-dashboard`). Features map directly to the feature-based architecture in code.

### Specialty (atomic task)

The smallest unit of work — small enough that Claude can execute it confidently:

**Backend:** `controller`, `service`, `gateway`, `guard`, `module`, `types`, `utils`

**Frontend:** `page`, `component`, `service`, `guard`, `directive`, `pipe`, `styles`

**Shared:** `model`, `config`, `test`, `docs`

## Directory structure

```
.backlog/
├── README.md
└── {plan-id}/                  # e.g., p-a075b3
    ├── plan.md                 # Original plan
    ├── state.json              # Plan metadata
    └── tasks/
        └── {project}/          # e.g., backend
            ├── task.md         # Project scope
            ├── status.json
            └── features/
                └── {feature}/  # e.g., auth
                    ├── task.md
                    ├── status.json
                    └── concerns/
                        └── {type}/ # e.g., service
                            ├── task.md
                            └── status.json
```

## Plan IDs

Format: `p-{6-hex}` (e.g., `p-a075b3`)

## Status values

```
not_ready → ready → executing → completed
                        │
                        └──→ failed
```

| Status | Meaning |
|--------|---------|
| `not_ready` | Defined but not ready for execution |
| `ready` | Fully specified, waiting to execute |
| `executing` | Work in progress |
| `completed` | Done and verified |
| `failed` | Attempted but unsuccessful |

## status.json format

```json
{"status": "not_ready", "updatedAt": "2026-01-18T20:16:28.342Z"}
```

## state.json format

```json
{
  "id": "p-a075b3",
  "name": "Calculator App",
  "status": "active",
  "created": "2026-01-15T10:00:00.000Z",
  "updated": "2026-01-18T15:30:00.000Z"
}
```

## When to stop decomposing

A task is atomic enough when:

1. It has a single responsibility
2. It can be verified with clear acceptance criteria
3. It's small enough for Claude to hold the full context
4. There's no ambiguity about what "done" means

Signs you need to decompose further: multiple "and"s in the description, multiple files to create, sub-steps that could fail independently.

## Example decomposition

```
Plan: "Web UI for Planner & Decomp Engine"
 │
 ├── Project: Backend
 │    ├── Feature: claude-session
 │    │    ├── service: ClaudeCodeSessionService
 │    │    ├── types: session.types.ts
 │    │    └── module: claude-session.module.ts
 │    │
 │    └── Feature: brainstorming
 │         ├── gateway: brainstorming.gateway.ts
 │         ├── service: brainstorming-session.service.ts
 │         └── controller: plans.controller.ts
 │
 └── Project: Frontend
      ├── Feature: plans-dashboard
      │    ├── page: PlansListPage
      │    └── component: PlanCard
      │
      └── Feature: brainstorming-ui
           ├── page: BrainstormingPage
           └── component: ChatPanel
```
