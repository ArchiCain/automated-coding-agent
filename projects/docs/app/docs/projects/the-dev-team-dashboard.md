# THE Dev Team Dashboard

Real-time observability for THE Dev Team. A React + Material-UI SPA that consumes the orchestrator's REST API and WebSocket gateway to show what every agent is doing, the state of every sandbox environment, and a searchable archive of every task the system has ever run.

Source: `projects/the-dev-team-dashboard/`.

## Purpose

The dashboard is an internal tool. It gives you:

- At-a-glance view of every **agent slot** and what it is doing
- **Live streaming** of agent messages (text, tool calls, tool results) as they happen
- A **kanban board** of all tasks with their current phase
- A **map of active sandbox namespaces** with health, resources, and ingress URLs
- A **PR pipeline** showing open PRs with CI + review status
- A **history browser** that searches the JSONL archive
- A **session replay** view that steps through past transcripts chronologically
- **Metrics** — success rates, time per task, cost trends

It is explicitly not user-facing: it assumes you already trust the network it runs on (Tailscale or localhost).

## Stack

- **React 19** with TypeScript
- **Vite** for dev server + bundling
- **Material-UI 6** (`@mui/material`, `@mui/x-charts`, `@emotion/*`) — shared MUI 6 theme with the application frontend
- **socket.io-client** for the `/dashboard` WebSocket namespace
- **axios** for REST calls
- **react-router-dom 6** for routing

## Project layout

The dashboard follows the feature-based architecture used across the repo. All code lives inside `app/src/features/`:

```
projects/the-dev-team-dashboard/
├── app/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── features/
│   │       ├── overview/           # At-a-glance agent cards
│   │       ├── task-board/         # Kanban by status
│   │       ├── agent-detail/       # Live-stream terminal view
│   │       ├── environment-map/    # Active sandbox namespaces
│   │       ├── history-browser/    # Search + filter past tasks
│   │       ├── session-replay/     # Step through a JSONL transcript
│   │       ├── metrics/            # Charts and rollups
│   │       ├── layout/             # AppBar, Drawer, routing shell
│   │       ├── mui-theme/          # MUI theme, palette, typography
│   │       ├── api-client/         # axios + socket.io wrappers
│   │       └── shared/             # Reusable components and hooks
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── dockerfiles/
│   ├── local.Dockerfile
│   └── prod.Dockerfile
├── chart/                          # Helm chart (deployed to the-dev-team namespace)
└── Taskfile.yml
```

## The 8 views

### 1. Overview

Grid of agent-slot cards. Each card shows the slot id, the assigned task, the current role, the current phase, elapsed time, and cost so far. Idle slots are greyed out. Subscribes to `agent:progress` and `task:update`.

### 2. Task Board

Kanban-style columns keyed by `TaskStatus`: `queued`, `assigned`, `setting_up`, `implementing`, `validating`, `submitting`, `completed`, `failed`. Drag-and-drop is **not** supported — the board is read-only. Click a card to open the Agent Detail view for that task.

### 3. Agent Detail

A terminal-style stream of agent messages for a single task. Each message is rendered with a type-coloured prefix (`[text]`, `[tool_use]`, `[tool_result]`, `[error]`). Supports pausing, following the tail, and filtering by message type. Fed by `agent:progress` filtered by `taskId`.

### 4. Environment Map

Shows every active namespace labelled `managed-by=the-dev-team`. For each namespace: pod health, CPU/memory usage from the metrics-server, ingress URLs (api / app / auth), task it belongs to, and age. Click to open logs for any pod.

### 5. History Browser

Searches the orchestrator's history API (`/api/history/tasks`). Full-text search on title + description, filter by status, date range, or role. Each result links to the markdown summary and the list of session transcripts.

### 6. Session Replay

Step chronologically through a single `.jsonl` session transcript. A slider scrubs through events. Each event is rendered with its timestamp and content. Supports jumping to the next tool call, filtering by event type, and searching within a transcript.

### 7. Metrics

Charts (via `@mui/x-charts`) for:

- Tasks per day (stacked: completed vs failed vs escalated)
- Average cost per task over time
- Average duration per task over time
- Top 10 failure modes (grouped by failure reason in the index)
- Cost per role (which role eats the budget)

### 8. Layout

`AppBar` with environment indicator and connection status, `Drawer` with links to the other views, `Outlet` for the active route. Theme toggle, but defaults to the dark MUI theme.

## Routes

| Path | View |
|------|------|
| `/` | Overview |
| `/tasks` | Task Board |
| `/tasks/:taskId` | Agent Detail |
| `/environments` | Environment Map |
| `/history` | History Browser |
| `/history/:taskId/replay/:sessionFile` | Session Replay |
| `/metrics` | Metrics |

## WebSocket integration

A single socket is opened in `api-client/socket.ts` and connects to `${ORCHESTRATOR_URL}/dashboard`. A React context provides the live state and dispatches updates to the feature stores.

Events consumed:

| Event | Source | Used by |
|-------|--------|---------|
| `agent:progress` | Orchestrator role dispatcher | Overview, Agent Detail |
| `task:update` | Orchestrator execution loop | Overview, Task Board |
| `env:health` | Environment manager service | Environment Map |
| `gate:result` | Gate runner service | Task Board, Agent Detail |

The socket auto-reconnects with exponential backoff. The connection indicator in the AppBar turns red on disconnect.

## Common tasks

```bash
task the-dev-team-dashboard:local:start    # Vite dev server (default :5173)
task the-dev-team-dashboard:local:build    # Production bundle
task the-dev-team-dashboard:local:test     # Vitest unit tests
task the-dev-team-dashboard:local:lint     # ESLint
task the-dev-team-dashboard:remote:build   # Build Docker image (Minikube)
task the-dev-team-dashboard:remote:deploy  # Helm release into the-dev-team namespace
```

## Access URLs

The dashboard is routed via the cluster ingress and uses the repo-wide `DEV_HOSTNAME` pattern so it works both on localhost and on a Tailscale machine name.

| `DEV_HOSTNAME` | Dashboard URL |
|----------------|---------------|
| `localhost` (default) | `http://dashboard.the-dev-team.localhost` |
| `shawns-macbook` (Tailscale) | `http://dashboard.the-dev-team.shawns-macbook` |
| `mac-mini` (production) | `http://dashboard.the-dev-team.mac-mini` |

The orchestrator URL it connects to is derived the same way:

| `DEV_HOSTNAME` | Orchestrator URL |
|----------------|------------------|
| `localhost` | `http://the-dev-team.localhost` |
| `shawns-macbook` | `http://the-dev-team.shawns-macbook` |

See [Networking](../infrastructure/networking.md) for the hostname mechanism.

## Related reading

- [Orchestrator](coding-agent/backend.md)
- [Task State & History](coding-agent/backlog.md)
- [Networking](../infrastructure/networking.md)
