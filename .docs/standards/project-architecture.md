# Project Architecture

High-level organizational patterns for consistent project structure across technologies.

## Overview

This monorepo uses consistent project organization patterns that work across any technology stack. Each project maintains independence while sharing common structural and operational patterns.

### Key Principles

- **Project Independence**: Each project owns its functionality and configuration
- **Consistent Patterns**: Same structure across all technologies and project types
- **Compose-First**: All projects deploy via docker-compose — locally on Docker Desktop, on EC2 behind Caddy in production
- **Task Automation**: Standardized build, test, and deployment workflows via Taskfile
- **Docs-Driven**: Every project and feature has `.docs/` specifications

### Project Types

| Type | Purpose | Examples | Deployment |
|------|---------|----------|------------|
| **Applications** | User-facing interfaces | Angular frontend, React frontend | Docker image → compose service |
| **Services** | Backend logic and APIs | NestJS backend, Mastra agents | Docker image → compose service |
| **Infrastructure** | Supporting services | PostgreSQL, Keycloak | Docker image → compose service |
| **Platform** | Stack config | compose files, Caddy, Terraform, sandbox templates | docker-compose + Terraform |

## Directory Structure

```
projects/
├── application/                   # The benchmark app
│   ├── backend/                   # NestJS REST API
│   │   ├── .docs/                 # Project-level docs (overview, standards)
│   │   ├── app/                   # Source code
│   │   │   └── src/features/      # Feature-based code organization
│   │   ├── dockerfiles/           # Container definitions
│   │   └── Taskfile.yml           # Project automation
│   ├── frontend/                  # React frontend
│   │   ├── app/
│   │   │   ├── .docs/             # Project-level docs
│   │   │   └── src/app/features/  # Feature-based code organization
│   │   ├── dockerfiles/
│   │   └── Taskfile.yml
│   ├── database/                  # PostgreSQL setup + migrations
│   │   └── .docs/
│   ├── keycloak/                  # Auth server configuration
│   │   ├── .docs/
│   │   ├── app/                   # Realm config + startup scripts
│   │   └── dockerfiles/
│
├── openclaw/                     # Active agent runtime — edited by Claude Code
│   ├── .docs/                    # overview.md describes topology + auth + memory
│   ├── app/
│   │   ├── openclaw.json         # Gateway config (agents, plugins, browser)
│   │   └── skills/               # Per-agent prompt + tool-scope files
│   ├── dockerfiles/              # Gateway + git-sync-sidecar Dockerfiles
│   └── Taskfile.yml              # task openclaw:* (lifecycle wrappers)
│
└── the-dev-team/                 # FROZEN reference — prior orchestrator, not runnable
    ├── backend/                  # NestJS + Mastra (frozen)
    └── frontend/                 # React (frozen)
```

### Standard Project Layout

Every project follows the same structure:

```
project-name/
├── .docs/                         # Documentation (overview, standards, feature specs)
├── app/                           # Application source code
│   └── src/
│       └── features/              # Feature-based code organization
├── dockerfiles/                   # Container definitions (prod.Dockerfile, etc.)
└── Taskfile.yml                   # Project-specific automation
```

## Deployment Model

All projects deploy via docker-compose:

```
Source code → Docker image → compose service (local Docker daemon or EC2 host)
```

- **Local**: Docker Desktop, `task up` brings up `dev` + `openclaw` compose projects
- **Production**: Single Ubuntu EC2 host, images pulled from GHCR via the prod compose overlay, fronted by Caddy
- **Sandboxes**: Per-feature compose projects (`env-{feature}`) cloned from the sandbox template

The root `Taskfile.yml` includes all project Taskfiles and provides orchestration:
- `task up` — bring up the full compose stack
- `task down` — stop everything (preserves volumes)
- `task build` — build all compose images

## Key Management Principles

### 1. Consistent Project Structure
- **Standard Layout**: All projects follow `app/` + `dockerfiles/` + `Taskfile.yml`
- **Feature Architecture**: All source code lives in `features/` — see [Feature Architecture](feature-architecture.md)
- **Compose Services**: Every deployable project has a service stanza in `infrastructure/compose/dev/compose.yml`
- **Environment Parity**: Same compose files run locally and on EC2 (prod-specific overrides in a layered overlay)

### 2. Configuration
- **Per-stack `.env`**: Each compose project carries its own `.env` in `infrastructure/compose/{stack}/` — see [Environment Configuration](environment-configuration.md)
- **Compose env**: Non-sensitive config via `environment:` keys in `compose.yml`, secrets via gitignored `.env` files
- **No defaults**: All required env vars must be explicit — fail fast on missing config

### 3. Project Communication
- **Compose network**: Services on the same compose project reach each other by service name. Cross-stack calls go through host-published ports
- **API Contracts**: Cross-boundary interfaces documented in `.docs/contracts.md`
- **Health Endpoints**: Every service exposes `/health` for liveness checks

### 4. Code Organization
All projects follow the [Feature Architecture](feature-architecture.md) pattern. All code lives inside `features/`. Features can be full-stack (with pages/endpoints) or shared utilities (components/services/clients).
