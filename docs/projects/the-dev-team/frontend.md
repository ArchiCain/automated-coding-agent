# THE Dev Team — Frontend

The frontend is the chat UI and cluster visualization for THE Dev Team. It lives at `projects/the-dev-team/frontend/`.

## Stack

- **React 19** — UI framework
- **Vite 6** — Build tool
- **WebSocket** — Real-time streaming from the backend

## Responsibilities

- Chat interface for interacting with the agent
- Cluster visualization (namespace cards, pod status, CPU/memory)
- Log viewer (click any service row to stream logs)
- Session management UI

## Key source files

| File | Purpose |
|------|---------|
| `app/src/App.tsx` | Routes: / (chat), /cluster (cluster view), shared NavBar |
| `app/src/features/chat/use-chat.ts` | WebSocket hook — sessions, messages, streaming |
| `app/src/features/chat/chat.page.tsx` | Full-page chat: sidebar + message list + input |
| `app/src/features/cluster/cluster.page.tsx` | K8s visualization: namespace cards, infra accordion |
| `app/src/features/cluster/log-drawer.tsx` | Bottom drawer showing pod logs |

## Deployment

Deployed to the `the-dev-team` K8s namespace as the `the-dev-team-frontend` release. See [Kubernetes](../../infrastructure/kubernetes.md) for the Helmfile configuration.

## Commands

```bash
task devteam-frontend:local:start      # Vite dev server
task devteam-frontend:local:build      # Production bundle
task devteam-frontend:local:test       # Unit tests
task devteam-frontend:local:lint       # ESLint
```

## Related reading

- [THE Dev Team Overview](../../the-dev-team/overview.md)
- [Backend](backend.md)
