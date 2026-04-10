# THE Dev Team -- Frontend

The agent frontend lives at `projects/the-dev-team/frontend/`. It provides a chat interface for interacting with the agent, a DevOps dashboard for cluster observability, and an embedded docs viewer.

## Stack

- **React 19** -- UI framework
- **Vite 6** -- Build tool
- **MUI (Material UI)** -- Component library
- **WebSocket** -- Real-time streaming from the backend

## Pages

The app has three routes, accessible via the top navigation bar.

### Chat (`/`)

Full-page chat interface for interacting with the Claude Code agent.

- **Sidebar** -- Session list with create/resume/delete
- **Message list** -- Terminal-style rendering with markdown, tool use blocks, and error states
- **Input** -- Text input that sends messages via WebSocket

The `use-chat` hook manages the WebSocket connection, session lifecycle, and message state. Messages stream in real-time as Claude Code processes tool calls.

### DevOps (`/devops`)

Cluster observability dashboard with three tabs:

- **Deployments** -- Namespace cards showing pod status (name, status dot, ports, CPU/memory). App namespaces (`app`, `the-dev-team`, `env-*`) are shown directly; infrastructure namespaces (`dns`, `traefik`, `registry`, `monitoring`) are collapsed in an accordion. Click any pod row to open the log drawer.
- **Metrics** -- Prometheus-backed graphs for CPU, memory, network, and HTTP request rates. Proxied through the backend's cluster controller.
- **Log Search** -- Loki-backed log search across all namespaces. Query by text, filter by namespace/service, view results in a scrollable list.

### Docs (`/docs`)

Embedded documentation viewer that renders the project's markdown docs within the frontend.

## Key source files

| File | Purpose |
|------|---------|
| `app/src/App.tsx` | Routes: `/` (chat), `/devops` (DevOps), `/docs` (docs viewer) |
| `app/src/features/chat/use-chat.ts` | WebSocket hook -- sessions, messages, streaming |
| `app/src/features/chat/chat.page.tsx` | Full-page chat: sidebar + message list + input |
| `app/src/features/cluster/cluster.page.tsx` | DevOps dashboard: tabs for deployments, metrics, logs |
| `app/src/features/cluster/namespace-card.tsx` | Pod table with status dots, ports, CPU/memory |
| `app/src/features/cluster/log-drawer.tsx` | Bottom drawer showing pod logs |
| `app/src/features/cluster/metrics-panel.tsx` | Prometheus metrics graphs |
| `app/src/features/cluster/logs-panel.tsx` | Loki log search interface |
| `app/src/features/docs/` | Docs viewer page |
| `app/src/features/navigation/` | Top navigation bar |

## Deployment

Deployed to the `the-dev-team` K8s namespace. Served as a static build behind the ingress.

## Commands

```bash
task devteam-frontend:local:start      # Vite dev server
task devteam-frontend:local:build      # Production bundle
task devteam-frontend:local:test       # Unit tests
task devteam-frontend:local:lint       # ESLint
```

## Related reading

- [Backend](backend.md)
- [Kubernetes](../../infrastructure/kubernetes.md)
