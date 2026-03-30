# Projects

This directory contains all deployable projects in the automated-repo monorepo, organized into two groups.

## Application (`projects/application/`)

| Project | Path | Stack | Description |
|---------|------|-------|-------------|
| **backend** | `projects/application/backend` | NestJS | Main API server with WebSocket support |
| **frontend** | `projects/application/frontend` | React + Vite | Main web application |
| **database** | `projects/application/database` | PostgreSQL | Database infrastructure |
| **keycloak** | `projects/application/keycloak` | Keycloak | Authentication provider |
| **e2e** | `projects/application/e2e` | Playwright | End-to-end test suite |

K8s namespace: `app`

## Coding Agent (`projects/coding-agent/`)

| Project | Path | Stack | Description |
|---------|------|-------|-------------|
| **backend** | `projects/coding-agent/backend` | NestJS + Claude Code SDK | Autonomous coding agent API |
| **frontend** | `projects/coding-agent/frontend` | Angular | Coding agent UI |

K8s namespace: `coding-agent`

Runtime data (backlog, agent configs) lives in `.coding-agent-data/` at the repo root.

## Shared

| Project | Path | Description |
|---------|------|-------------|
| **docs** | `projects/docs` | MkDocs documentation site |
