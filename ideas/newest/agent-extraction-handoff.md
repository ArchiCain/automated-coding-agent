# Agent Extraction Handoff

## Overview

This document describes the architectural split of the coding agent system from a single monolithic backend into two distinct backends with clear separation of concerns. The frontend moves to Docker alongside an orchestration backend, while a standalone local backend handles all direct machine access.

### Driving Motivation

- **Separation of concerns and clear responsibilities.** The SDK integration for running a coding agent is trivial. The power and differentiation lies in the UI, workflow orchestration, and agent management system built around it.
- **Deployment topology.** The frontend and orchestration layer will deploy to AWS. The local backend will run on an EC2 instance where it has direct machine access and compute power.
- **Architecture philosophy.** The filesystem and git serve as the database for coding agents. Everything is inspectable, version-controlled, and portable. No ORM, no migrations, no connection pooling — just files and git. All dot-directories (`.agents/`, `.backlog/`, `.agent-prompts/`, etc.) are intentional filesystem-based storage designed to be committed to git.

---

## Current Architecture

### Backend (NestJS — `projects/coding-agent-backend`)

Single NestJS application running on port 1086 with the following features under `app/src/features/`:

| Feature | Description |
|---|---|
| **claude-code-agent** | 9 controllers covering: session management, Claude Code SDK providers, brainstorming, decomposition, execution, review, agents CRUD, prompts, filesystem operations |
| **task-runner** | Executes Taskfile CLI commands via WebSocket, streams output |
| **job-queue** | Async job orchestration with Bull queue |
| **command-center** | Git operations (branch management, status, diffs) and Docker container status |
| **projects** | Scans repo directories, discovers project structure |
| **backlog** | Reads/writes `.backlog/` directory for plan management |
| **cors** | CORS configuration |
| **health** | Health check endpoint |

### Frontend (Angular 21 — `projects/coding-agent-frontend`)

Angular standalone-components application running on port 4200 with 17 features under `app/src/app/features/`. Communicates with backend via REST (`http://localhost:1086`) and Socket.IO WebSocket.

Key features: chatbot (scoped sessions), claude-code-agent (session management UI), tasks (CLI command execution), projects, backlog, agent-builder, command-center (frontend-only feature for git/docker display), brainstorm, decomposition, layout, local-env, docs, ui-components.

---

## Target Architecture

### 1. Local Backend ("Machine Gateway")

**Runs standalone on the machine (or EC2 instance). No Docker.**

A thin NestJS service that exposes everything requiring direct machine access. This is the reference implementation that demonstrates building an agent with the SDK is trivial.

| Feature | Responsibility | Source |
|---|---|---|
| **sessions** | Spawn Claude Code processes via `@anthropic-ai/claude-agent-sdk`, manage session lifecycle, stream transcripts over WebSocket (`/sessions` namespace) | Extracted from `claude-code-agent` — `session.service.ts`, `claude-code.provider.ts`, `session.gateway.ts` |
| **task-runner** | Execute Taskfile CLI commands, stream output over WebSocket (`/tasks` namespace) | Direct move from `task-runner` feature |
| **filesystem** | Read/write files, list directories, serve file content | Extracted from `claude-code-agent` — `filesystem.controller.ts` and related services |
| **git** | Branch management, status, diffs | Carved out of `command-center` — git-related operations only |
| **prompts** | Read `.agent-prompts/*.md` files from disk | Extracted from `claude-code-agent` — `prompts.controller.ts`, `prompts.service.ts` |

#### Key Files to Extract

From `coding-agent-backend/app/src/features/claude-code-agent/`:

- **Sessions**: `services/session.service.ts`, `services/claude-code.provider.ts`, `gateways/session.gateway.ts`, `controllers/session.controller.ts`
- **Filesystem**: `controllers/filesystem.controller.ts` and any supporting filesystem services
- **Prompts**: `controllers/prompts.controller.ts`, `services/prompts.service.ts`

From `coding-agent-backend/app/src/features/task-runner/`:
- Entire feature moves as-is

From `coding-agent-backend/app/src/features/command-center/`:
- Git-related controllers and services only

#### WebSocket Namespaces

- `/sessions` — session transcript streaming (`session:output`, `session:turn_complete`, `session:paused`, `session:completed`, `session:error`)
- `/tasks` — task output streaming (`task:started`, `task:output`, `task:completed`, `task:failed`, `task:cancelled`, `task:dismissed`)

---

### 2. Dockerized Backend ("Orchestration Layer")

**Runs in Docker alongside the frontend.**

Manages state, coordinates workflows, and serves as the API for all non-machine-access features. Reads/writes to the filesystem by calling the local backend's filesystem API — never directly accessing the disk.

| Feature | Responsibility | Notes |
|---|---|---|
| **agents** | CRUD for agent configurations | Currently reads/writes `.agents/` dir. Will proxy through local backend's filesystem API. |
| **projects** | Project discovery and structure | Currently scans local dirs. Will call local backend's filesystem API to list/read directories. |
| **backlog** | Plan management | Currently reads/writes `.backlog/` dir. Will proxy through local backend's filesystem API. |
| **docker** | Docker container status display | Carved out of `command-center` — Docker-related operations only |
| **job-queue** | Job orchestration | Creates sessions by calling local backend's session API over HTTP instead of in-process |

#### Filesystem Access Pattern

All dot-directory operations (`.agents/`, `.backlog/`, `.agent-prompts/`, etc.) go through the local backend's filesystem API. The orchestration layer never touches the disk directly. This means:

- Agent config reads/writes → `GET/POST` local backend filesystem endpoints
- Backlog reads/writes → `GET/POST` local backend filesystem endpoints
- Project directory scans → `GET` local backend filesystem endpoints

---

### 3. Dockerized Frontend (Angular)

**Runs in Docker with the orchestration backend.**

Same Angular application with two API base URLs configured:

```json
{
  "localBackendUrl": "http://<ec2-or-local>:<port>",
  "orchestrationBackendUrl": "http://<docker-host>:<port>"
}
```

- REST calls route to the appropriate backend based on the resource
- Socket.IO connections for session and task streaming go directly to the local backend

#### Frontend Feature Routing

| Frontend Feature | Calls |
|---|---|
| chatbot, claude-code-agent (sessions) | Local backend |
| tasks | Local backend |
| command-center (git) | Local backend |
| command-center (docker) | Orchestration backend |
| projects | Orchestration backend |
| backlog | Orchestration backend |
| agent-builder | Orchestration backend |
| local-env | Orchestration backend |

---

## Legacy Features to Remove

### Brainstorming, Decomposition, Execution, Review

These backend features (`brainstorming.service.ts`, `decomposition.service.ts`, `execution.service.ts`, `review.service.ts`) are legacy and will be deleted. They are tightly coupled to the session service and their workflow has been superseded.

#### Prompt Files to Relocate

The following prompt files in `.agent-prompts/` should be moved to `ideas/decomp-prompts/` for archival:

| File | Size | Purpose |
|---|---|---|
| `brainstorming.md` | 4.5 KB | Brainstorming agent system prompt |
| `decomposition.md` | 22.7 KB | Main decomposition agent prompt (4-phase process) |
| `decomp-plan-to-projects.md` | 4.5 KB | Plan → projects decomposition instructions |
| `decomp-project-to-features.md` | 10.3 KB | Project → features decomposition instructions |
| `decomp-feature-to-concerns.md` | 5.8 KB | Feature → concerns decomposition instructions |
| `execution.md` | 7.8 KB | Execution agent prompt |
| `review.md` | 7.6 KB | Review agent prompt (PASS/FAIL verdicts) |

#### Context Files Referenced by Legacy Services

These docs are referenced as context files by the legacy services. They may still be useful for other purposes — do not delete:

- `docs/backlog-structure.md`
- `docs/feature-architecture.md`
- `docs/README.md`
- `projects/README.md`

#### Frontend Features to Remove

- `brainstorm` feature
- `decomposition` feature
- Any route configurations referencing these features

#### Prompt Files to Keep

The following prompt files in `.agent-prompts/` are NOT part of the legacy decomp workflow and should remain:

- `projects-overview.md`
- `project-features.md`
- `feature-concerns.md`

---

## Implementation Sequence

### Phase 1: Extract Local Backend

1. Create new NestJS project for the local backend
2. Move session management (session service, claude-code provider, session gateway, session controller)
3. Move task-runner feature entirely
4. Move filesystem controller and services
5. Extract git operations from command-center into a git feature
6. Move prompts controller and service
7. Verify all WebSocket namespaces work in the new project
8. Configure CORS to allow requests from the Docker frontend

### Phase 2: Clean Up Monolith → Orchestration Backend

1. Remove extracted features from the original backend
2. Remove legacy features (brainstorming, decomposition, execution, review controllers and services)
3. Move decomp prompt files to `ideas/decomp-prompts/`
4. Extract Docker operations from command-center into a docker feature
5. Refactor agents/projects/backlog services to call local backend's filesystem API instead of direct disk access
6. Refactor job-queue to create sessions via HTTP to local backend instead of in-process
7. Add Dockerfile for the orchestration backend

### Phase 3: Dockerize Frontend

1. Add Dockerfile for Angular build and static serving
2. Update config to support dual backend URLs (`localBackendUrl`, `orchestrationBackendUrl`)
3. Update services to route calls to the correct backend
4. Create docker-compose for frontend + orchestration backend
5. Remove legacy frontend features (brainstorm, decomposition)

### Phase 4: Deployment

1. Deploy local backend to EC2
2. Deploy Docker stack (frontend + orchestration backend) to AWS
3. Configure networking between Docker stack and EC2 instance
