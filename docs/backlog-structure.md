# Backlog Directory Structure

This document defines the file and folder structure of the `.backlog` directory. All decomposition agents must follow this structure when creating tasks.

## Overview

```
.backlog/
├── README.md                     # Backlog documentation
└── {plan-id}/                    # Plan folder (e.g., p-a075b3)
    ├── plan.md                   # Original plan document
    ├── state.json                # Plan-level metadata
    └── tasks/                    # Decomposed work
        └── {project}/            # Project folder (e.g., backend)
            ├── task.md           # Project task description
            ├── status.json       # Project status
            └── features/         # Feature-level decomposition
                └── {feature}/    # Feature folder (e.g., auth)
                    ├── task.md   # Feature task description
                    ├── status.json
                    └── concerns/   # Atomic tasks
                        └── {type}/   # Concern folder (e.g., service)
                            ├── task.md
                            └── status.json
```

## Plan ID Format

Plan IDs use the format `p-{6-hex}` (e.g., `p-a075b3`, `p-calc01`).

## File Definitions

### plan.md

The original brainstorming output. Contains:
- Problem statement
- Requirements
- Architecture decisions
- Scope boundaries

This file is the input to project decomposition.

### state.json

Plan-level metadata:
```json
{
  "id": "p-a075b3",
  "name": "Calculator App",
  "status": "active",
  "created": "2026-01-15T10:00:00.000Z",
  "updated": "2026-01-18T15:30:00.000Z"
}
```

### task.md

Task description at any level (project, feature, or concern). Contains:
- Scope of work for this specific task
- Technical requirements
- File structure (if applicable)
- Dependencies on other tasks

Example (project level):
```markdown
# Backend - Calculator API (NestJS)

## Scope of Work
Build a NestJS backend that provides calculation APIs...

## Key Requirements
- Basic operations module
- Scientific operations module
...
```

### status.json

Task status at any level:
```json
{
  "status": "not_ready",
  "updatedAt": "2026-01-18T20:16:28.342Z"
}
```

Valid status values:
- `not_ready` - Task defined but not ready for execution
- `ready` - Task is ready to be executed
- `executing` - Task is currently being worked on
- `completed` - Task finished successfully
- `failed` - Task attempted but failed

## Directory Naming

### Projects

Use the project path from `projects/README.md`:
- `backend` (maps to `projects/backend`)
- `frontend` (maps to `projects/frontend`)
- `coding-agent-backend` (maps to `projects/coding-agent-backend`)

### Features

Use kebab-case descriptive names:
- `user-authentication`
- `basic-operations`
- `websocket-client`

### Concerns

Use the specialty type:
- `controller`
- `service`
- `component`
- `page`
- `types`
- `test`

## Example: Full Structure

```
.backlog/
└── p-calc01/
    ├── plan.md
    ├── state.json
    └── tasks/
        ├── backend/
        │   ├── task.md
        │   ├── status.json
        │   └── features/
        │       ├── basic-operations/
        │       │   ├── task.md
        │       │   ├── status.json
        │       │   └── concerns/
        │       │       ├── controller/
        │       │       │   ├── task.md
        │       │       │   └── status.json
        │       │       └── service/
        │       │           ├── task.md
        │       │           └── status.json
        │       └── scientific-operations/
        │           ├── task.md
        │           └── status.json
        └── frontend/
            ├── task.md
            └── status.json
```

## Decomposition Agent Requirements

When creating tasks, decomposition agents must:

1. **Create the directory** before writing files
2. **Write task.md** with clear scope and requirements
3. **Write status.json** with initial status `not_ready`
4. **Use correct paths** based on project inventory
5. **Follow naming conventions** (kebab-case for features)

### status.json Template

```json
{"status": "not_ready", "updatedAt": "{ISO_TIMESTAMP}"}
```

The timestamp should be the current time when the task is created.
