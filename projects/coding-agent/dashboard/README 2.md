# THE Dev Team Dashboard

React + Vite dashboard providing real-time observability for THE Dev Team autonomous coding agent system. Visualizes agent slots, task queues, live agent transcripts, ephemeral environments, run history, and cost/performance metrics.

## Project Structure

```
projects/the-dev-team-dashboard/
├── app/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── features/
│   │       ├── api-client/         # useApi (axios) + useSocket (socket.io)
│   │       ├── mui-theme/          # Dark MUI theme + ThemeProvider wrapper
│   │       ├── layout/             # App shell: sidebar + top bar
│   │       ├── shared/             # Shared types (Task, AgentSlot, etc.)
│   │       ├── overview/           # Overview page + AgentCard
│   │       ├── task-board/         # Kanban task board + TaskCard
│   │       ├── agent-detail/       # Live agent message stream
│   │       ├── environment-map/    # Ephemeral env list + destroy
│   │       ├── history-browser/    # Completed task history with search
│   │       ├── session-replay/     # Timeline scrubber for past sessions
│   │       └── metrics/            # Charts: throughput, cost, duration, success rate
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   └── vite.config.ts
├── dockerfiles/
│   ├── local.Dockerfile            # Dev image with hot reload
│   ├── prod.Dockerfile             # Multi-stage build + nginx runtime
│   └── nginx.conf                  # SPA-aware nginx config
├── chart/                          # Helm chart for K8s deploy
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
└── Taskfile.yml
```

## Routes

| Path | Page |
|------|------|
| `/` | Overview — agent slots + recent tasks |
| `/tasks` | Task Board — kanban view across lifecycle |
| `/agents/:taskId` | Agent Detail — live message stream |
| `/environments` | Environment Map — active ephemeral envs |
| `/history` | History Browser — past tasks with filters |
| `/history/:taskId` | Session Replay — timeline of a past run |
| `/metrics` | Metrics — charts and aggregates |

## Tasks

```bash
task dashboard:local:install       # Install dependencies
task dashboard:local:run           # Vite dev server (outside Docker)
task dashboard:local:start         # Start in Docker with hot reload
task dashboard:local:build         # Production vite build
task dashboard:local:type-check    # TypeScript type check
task dashboard:local:lint          # Lint (stub)
task dashboard:local:test          # Unit tests (stub)
```

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DASHBOARD_PORT` | `3002` | Vite dev server port |
| `VITE_BACKEND_URL` | `http://localhost:8086` | Proxy target for `/api` and `/socket.io` |

## Tech Stack

React 19, Vite 6, TypeScript 5.7, Material UI 6.5, MUI X Charts, React Router 7, Axios 1.7, Socket.io Client 4.8.

See the architecture plan in `projects/docs/` for a full description of THE Dev Team system.
