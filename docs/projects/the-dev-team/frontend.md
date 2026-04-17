# THE Dev Team -- Frontend

The agent frontend lives at `projects/the-dev-team/frontend/`. It provides an environment-centric UI for managing the autonomous agent platform: viewing environments and sandboxes, chatting with agents, running tasks, and browsing cluster state.

## Stack

- **React 19** -- UI framework
- **Vite 6** -- Build tool
- **MUI (Material UI)** -- Component library
- **WebSocket (socket.io-client)** -- Real-time agent message streaming + task output

## Pages

The app uses an environment-based routing hierarchy where environments are the top-level organizing principle.

### Environments Overview (`/`)

Landing page showing all environments as cards:

- **main** -- The primary application environment (prominent card at top)
- **platform** -- THE Dev Team's own infrastructure (backend, frontend, headless Chrome)
- **sandbox-\*** -- Ephemeral sandbox environments created by agents for issue work

Each card shows: name, namespace, health chip, pod count, and mini status dots per pod. Click a card to navigate to the environment detail page.

### Environment Detail (`/env/:name`)

Deep dive into a single environment:

- **Left panel** -- Service table showing pods with status, ready count, restarts, age, node, CPU/memory. Click a service row to navigate to the application detail page.
- **Right panel** -- Embedded chat panel for the DevOps agent context.

### Application Detail (`/env/:name/app/:appName`)

Deep dive into a specific application within an environment:

- **Left panel** -- Pod details (status, containers, resource usage), service endpoints with clickable URLs. Tabbed: Overview | Logs.
- **Right panel** -- Embedded chat panel with role selector (Designer, Frontend Owner, General Agent). Sessions are scoped to the application context.

### Cluster (`/cluster`)

Full cluster observability dashboard with three tabs:

- **Deployments** -- Namespace cards showing all pods. App namespaces shown directly; infrastructure namespaces collapsed in an accordion.
- **Metrics** -- Prometheus-backed graphs for CPU, memory, network, and HTTP request rates.
- **Log Search** -- Loki-backed log search across all namespaces.

### Docs (`/docs`)

Embedded documentation viewer that renders the project's markdown docs within the frontend.

## Global features

### Task Runner Drawer

A persistent bottom drawer (survives navigation) for running and monitoring Taskfile tasks:

- Collapsible: ~300px expanded, ~36px collapsed bar
- Tab per task with status indicator (spinner/check/error)
- Scrollable monospace output per tab, auto-scrolls to bottom
- Cancel button for running tasks, dismiss for completed
- Powered by `TaskRunnerProvider` context at the app root

### Chat Panel

Reusable right-side panel embedded in environment and application detail pages:

- 350px wide, uses the shared `useChat` hook
- Session list with role selector (combobox) and new session button
- Message list with markdown rendering, tool use blocks, error states
- Real-time streaming via WebSocket

## Key source files

| File | Purpose |
|------|---------|
| `app/src/App.tsx` | Routes: `/`, `/env/:name`, `/env/:name/app/:appName`, `/cluster`, `/docs` |
| `app/src/features/environments/environments-overview.page.tsx` | Landing page with environment cards |
| `app/src/features/environments/environment-detail.page.tsx` | Env deep dive with services + chat |
| `app/src/features/environments/application-detail.page.tsx` | App deep dive with pod info + chat |
| `app/src/features/environments/environment-chat-panel.tsx` | Reusable embedded chat panel |
| `app/src/features/environments/use-environments.ts` | Groups K8s namespaces into environments |
| `app/src/features/chat/use-chat.ts` | WebSocket hook -- sessions, messages, streaming |
| `app/src/features/chat/chat.page.tsx` | Standalone full-page chat (used by environment pages) |
| `app/src/features/cluster/cluster.page.tsx` | DevOps dashboard: deployments, metrics, logs |
| `app/src/features/cluster/service-table.tsx` | Reusable service/pod table component |
| `app/src/features/cluster/namespace-card.tsx` | Pod table with status dots, ports, CPU/memory |
| `app/src/features/cluster/log-drawer.tsx` | Bottom drawer showing pod logs |
| `app/src/features/cluster/metrics-panel.tsx` | Prometheus metrics graphs |
| `app/src/features/cluster/logs-panel.tsx` | Loki log search interface |
| `app/src/features/task-runner/task-runner-drawer.tsx` | Global task runner bottom drawer |
| `app/src/features/task-runner/task-runner-context.tsx` | React context for task runner state |
| `app/src/features/task-runner/use-task-runner.ts` | Socket.io + REST hook for task lifecycle |
| `app/src/features/navigation/nav-bar.tsx` | Top nav bar (Environments, Cluster, Docs) |

## Deployment

Deployed to the `the-dev-team` K8s namespace. Built as a static bundle, served by nginx with API proxy.

## Commands

```bash
task devteam-frontend:local:start      # Vite dev server
task devteam-frontend:local:build      # Production bundle
task devteam-frontend:local:test       # Unit tests
task devteam-frontend:local:lint       # ESLint
```

## Related reading

- [Backend](backend.md)
- [Sandbox Environments](../../the-dev-team/sandbox-environments.md)
- [Kubernetes](../../infrastructure/kubernetes.md)
