# Coding Agent Frontend

Angular frontend for the autonomous coding agent system — project browsing, plan decomposition, task execution, and agent management.

## Project Structure

```
projects/coding-agent/frontend/
├── app/
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts                   # Root component (header, nav, chatbot widget)
│   │   │   ├── app.routes.ts            # Lazy-loaded feature routes
│   │   │   ├── app.config.ts
│   │   │   └── features/
│   │   │       ├── agent-builder/       # Custom agent config UI
│   │   │       ├── agents/              # Agent chat interfaces
│   │   │       ├── backlog/             # Plan tracking + execution
│   │   │       ├── brainstorm/          # Brainstorming sessions
│   │   │       ├── chatbot/             # Floating chat widget
│   │   │       ├── claude-code-agent/   # Claude Code session UI
│   │   │       ├── command-center/      # Git + Docker + Task dashboard
│   │   │       ├── decomposition/       # Feature → task decomposition UI
│   │   │       ├── docs/                # Documentation browser
│   │   │       ├── layout/              # Header + nav drawer
│   │   │       ├── local-env/           # Docker service status + controls
│   │   │       ├── playground/          # Dev sandbox
│   │   │       ├── projects/            # Repo project/feature browser
│   │   │       ├── tasks/               # Task execution dock + drawer
│   │   │       └── ui-components/       # Shared: confirm dialog, slide-over
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

## Key Features

| Feature | Purpose |
|---------|---------|
| **agent-builder** | Create/edit agent configs with prompt editor and context file picker |
| **agents** | Multi-agent chat interfaces with terminal-style output, WebSocket streaming |
| **backlog** | Plan list → project → feature → concern drill-down, execution sessions, dev environment controls |
| **brainstorm** | Brainstorming sessions for creating new plans with Claude |
| **chatbot** | Floating chat widget with scope-aware session persistence (localStorage), screenshot capture for context |
| **command-center** | Git branch controls, Docker service grid with start/stop/restart, task execution bar |
| **decomposition** | Project → feature → concern decomposition workflow with DAG visualization |
| **local-env** | Docker service cards with status indicators and control actions |
| **projects** | Hierarchical project/feature browser with breadcrumb navigation |
| **tasks** | Task dock and command runner drawer for executing Taskfile commands |

## Tasks

```bash
task coding-agent-frontend:local:install   # Install dependencies
task coding-agent-frontend:local:start     # Dev server on port 4200
task coding-agent-frontend:local:build     # Production build
task coding-agent-frontend:local:test      # Unit tests
task coding-agent-frontend:local:lint      # Lint
task coding-agent-frontend:local:clean     # Clean build artifacts
```

## Architecture

- **Standalone components** (Angular 14+ pattern)
- **Lazy-loaded routes** for each feature module
- **Signal-based UI state** (Angular Signals API)
- **WebSocket integration** via socket.io-client for real-time updates
- **Material Design** via Angular Material

## Tech Stack

Angular 21, TypeScript 5.9, Angular Material 21, Socket.io Client 4.8, ngx-markdown 21, Prism.js (syntax highlighting), html2canvas (screenshot capture).
