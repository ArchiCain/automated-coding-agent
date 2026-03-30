# Automated Repo

A monorepo for building AI-powered applications, with an autonomous coding agent system for plan decomposition and task execution.

## What's in this repo

This repo contains two project sets that share infrastructure, tooling, and deployment patterns:

| Project Set | Purpose | Services |
|-------------|---------|----------|
| **Application** | The main product | Backend (NestJS), Frontend (React), Database (PostgreSQL), Keycloak (Auth) |
| **Coding Agent** | Autonomous coding system | Backend (NestJS), Frontend (Angular) |

Both deploy to a K3s cluster via Helmfile and run locally via Docker Compose.

## Quick Start

```bash
# 1. Enter the Nix dev shell (installs all tools)
cd automated-repo
direnv allow

# 2. Configure environment
cp .env.template .env
# Edit .env with your credentials

# 3. Start everything locally
task start-local

# 4. Verify
task status
```

| Service | Local URL |
|---------|-----------|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8085 |
| Keycloak | http://localhost:8081 |
| PGWeb | http://localhost:8082 |
| Coding Agent Frontend | http://localhost:3001 |
| Coding Agent Backend | http://localhost:8086 |
| Docs | http://localhost:8083 |

## Repo Structure

```
automated-repo/
├── projects/
│   ├── application/             # Main product services
│   │   ├── backend/             # NestJS API
│   │   ├── frontend/            # React SPA
│   │   ├── database/            # PostgreSQL + pgvector
│   │   ├── keycloak/            # Auth service
│   │   └── e2e/                 # Playwright tests
│   ├── coding-agent/            # Autonomous coding system
│   │   ├── backend/             # Coding agent API
│   │   └── frontend/            # Coding agent UI
│   └── docs/                    # This documentation site
├── infrastructure/
│   ├── docker/                  # Docker Compose (local dev)
│   ├── k8s/                     # Helmfile + Helm charts
│   └── terraform/               # EC2/K3s provisioning
├── .coding-agent-data/          # Runtime data from coding agent
│   ├── agents/                  # Agent configurations
│   └── backlog/                 # Plan storage
├── flake.nix                    # Nix dev shell
└── Taskfile.yml                 # Root task automation
```
