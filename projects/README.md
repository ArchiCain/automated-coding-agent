# Projects

This directory contains all deployable projects in the automated-repo monorepo, organized into two groups.

## Application (`projects/application/`)

| Project | Path | Stack | Description |
|---------|------|-------|-------------|
| **backend** | `projects/application/backend` | NestJS | Main API server with WebSocket support |
| **frontend** | `projects/application/frontend` | React + Vite | Main web application |
| **database** | `projects/application/database` | PostgreSQL | Database infrastructure |
| **keycloak** | `projects/application/keycloak` | Keycloak | Authentication provider |

K8s namespace: `app`

## THE Dev Team (`projects/the-dev-team/`)

| Project | Path | Stack | Description |
|---------|------|-------|-------------|
| **backend** | `projects/the-dev-team/backend` | NestJS + Claude Code SDK | Orchestrator + API |
| **frontend** | `projects/the-dev-team/frontend` | React + Vite | Chat UI + cluster visualization |

K8s namespace: `the-dev-team`

Runtime data (task state, history, agent configs) lives in `.the-dev-team/` at the repo root.

## Shared

| Project | Path | Description |
|---------|------|-------------|
| **docs** | `projects/docs` | MkDocs documentation site |
