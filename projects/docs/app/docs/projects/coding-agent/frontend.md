# Coding Agent Frontend

Angular frontend for the autonomous coding agent — project browsing, plan decomposition, task execution, and agent management.

## Project structure

```
projects/coding-agent/frontend/
├── app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts                   # Root component (header, nav, chatbot widget)
│   │   │   ├── app.routes.ts            # Lazy-loaded feature routes
│   │   │   ├── app.config.ts
│   │   │   └── features/               # 18 feature modules (see below)
│   │   ├── assets/
│   │   │   └── config.json             # Runtime configuration
│   │   └── styles.scss                  # Global styles + Material theme
│   └── angular.json
├── dockerfiles/
│   └── prod.Dockerfile                  # Multi-stage: build + nginx
├── chart/                               # Helm chart for K8s
└── Taskfile.yml
```

## Routes

| Path | Feature | Description |
|------|---------|-------------|
| `/projects` | projects | Repository project/feature browser (default) |
| `/brainstorm` | brainstorm | Brainstorming sessions for new plans |
| `/decomposition` | decomposition | Feature → task decomposition workflows |
| `/backlog` | backlog | Plan tracking, execution, dev environment |
| `/command-center` | command-center | Git status, Docker services, task execution |
| `/agents` | agent-builder | Custom agent configuration |

## Features

| Feature | Purpose |
|---------|---------|
| **agent-builder** | Create/edit agent configs with prompt editor and context file picker |
| **agents** | Multi-agent chat interfaces with terminal-style output, WebSocket streaming |
| **backlog** | Plan list → project → feature → concern drill-down, execution sessions, dev environment controls |
| **brainstorm** | Brainstorming sessions for creating new plans with Claude |
| **chatbot** | Floating chat widget with scope-aware session persistence, screenshot capture for context |
| **claude-code-agent** | Claude Code session UI with transcript rendering |
| **command-center** | Git branch controls, Docker service grid, task execution bar |
| **decomposition** | Project → feature → concern decomposition with DAG visualization |
| **docs** | Documentation browser |
| **local-env** | Docker service cards with status indicators and control actions |
| **projects** | Hierarchical project/feature browser with breadcrumb navigation |
| **tasks** | Task dock and command runner drawer for Taskfile commands |

## Architecture

- **Standalone components** (Angular 14+ pattern)
- **Lazy-loaded routes** for each feature module
- **Signal-based UI state** (Angular Signals API)
- **WebSocket integration** via socket.io-client for real-time updates
- **Material Design** via Angular Material

## Common tasks

```bash
task coding-agent-frontend:local:install   # Install dependencies
task coding-agent-frontend:local:start     # Dev server on port 4200
task coding-agent-frontend:local:build     # Production build
task coding-agent-frontend:local:test      # Unit tests
task coding-agent-frontend:local:lint      # Lint
task coding-agent-frontend:local:clean     # Clean build artifacts
```

## Deployment

In K8s, the frontend is served by nginx with an API proxy that routes `/api/` requests to the coding-agent-backend service. Runtime configuration (`config.json`) is injected via a ConfigMap.

## Tech stack

Angular 21, TypeScript 5.9, Angular Material 21, Socket.io Client 4.8, ngx-markdown 21, Prism.js, html2canvas.
