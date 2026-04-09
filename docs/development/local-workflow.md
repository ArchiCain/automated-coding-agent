# Local Workflow

Day-to-day development patterns for the two main workflows in this repo:

1. **Working on application code** — backend, frontend, database, keycloak, docs
2. **Running THE Dev Team** — orchestrator + dashboard + sandbox environments

Everything runs in Kubernetes (Minikube locally, K3s in production) with the same topology.

## Starting the full stack

```bash
# First time only
task setup-secrets

# Start everything
task up

# In a separate terminal, enable ingress access
task minikube:tunnel
```

`task up` starts Minikube, builds all container images, and deploys everything via Helmfile. Once it completes, open:

| Service | URL |
|---------|-----|
| Dashboard | http://dashboard.localhost |
| Orchestrator API | http://agent-api.localhost |
| Application frontend | http://app.localhost |
| Keycloak | http://auth.localhost |
| Docs | http://docs.localhost |

## Login credentials

| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `admin` | user, admin |
| `testuser` | `password` | user |

## Working on an application service

Iterating on backend / frontend code has two modes:

### Fast-feedback (run outside the cluster)

Run the service directly against a Minikube-deployed database and Keycloak. Hot reload, debugger attached, no Docker rebuild cycle:

```bash
task backend:local:start       # NestJS dev server against Minikube DB/Keycloak
task frontend:local:start      # Vite dev server against Minikube API/Keycloak
```

The backend reads `DATABASE_HOST_LOCAL=localhost` when running this way and connects to the Minikube database via `kubectl port-forward` (automated by the task).

### In-cluster iteration

Rebuild the image and re-deploy the service into Minikube:

```bash
eval $(minikube docker-env)
task build:backend
task deploy:apply
task logs -- backend
```

Use this for changes that depend on cluster-specific behaviour (ingress, service discovery, cron jobs).

## Running THE Dev Team

```bash
# First time only: set up secrets
task setup-secrets

# Start the cluster and deploy everything
task up

# In a separate terminal, enable ingress access
task minikube:tunnel
```

Then open:

- Dashboard: http://dashboard.localhost
- Orchestrator API: http://agent-api.localhost

This deploys the full stack into Minikube — the same topology as production (K3s).

### Verify everything is healthy

```bash
task status
# Expect: all pods Running in app and the-dev-team namespaces
```

### Submit a test task

```bash
curl -X POST http://agent-api.localhost/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add /api/hello endpoint",
    "description": "Add a GET /api/hello endpoint to the backend that returns { greeting: \"hello, world\" }. Add a unit test that verifies the shape.",
    "source": "manual",
    "touchesFrontend": false
  }'
```

### Watch it execute via the dashboard

The dashboard immediately shows the new task in the **queued** column. Within seconds it moves to **implementing**. Click the card to open the live-stream view and watch the implementer write the code.

Phase transitions visible on the dashboard:

1. setting_up — worktree created
2. implementing — architect + implementer running
3. validating — build, unit-tests, deployment, and the rest of the gate sequence
4. submitting — PR being opened
5. completed — done

Along the way, the **Environment Map** view shows a new sandbox (`env-{task-id}`) appear and turn healthy.

### Inspect afterwards

```bash
task history:task -- {task-id}          # Markdown summary
task history:sessions -- {task-id}      # List session transcripts
task history:search -- 'hello'          # Search all transcripts
```

Or use the dashboard's history browser.

## Stopping and cleaning up

```bash
task down                # Stop Minikube (preserves state, fast resume)
task destroy             # Delete the cluster entirely
```

## Running tests

Unit tests run on your host machine (in the Nix shell) and don't require the stack:

```bash
task backend:local:test
task frontend:local:test
task devteam-backend:local:test
task devteam-frontend:local:test
```

Integration tests connect to the running Minikube stack:

```bash
task deploy:apply                         # Stack must be running
task backend:local:test:integration
task frontend:local:test:integration
```

E2E tests use Playwright against the full stack:

```bash
task e2e:install     # One-time setup
task e2e:test        # Run all E2E tests against app.localhost
```

## Rebuilding after Dockerfile / package.json changes

```bash
eval $(minikube docker-env)
task build:all                 # Rebuild everything
task deploy:apply              # Roll out
```

For a clean slate:

```bash
task destroy
task up
```

## Port conflicts and troubleshooting

Minikube's ingress runs on the host's port 80. If something else is using it:

```bash
sudo lsof -i :80           # Find the culprit
```

If a sandbox namespace is stuck:

```bash
task env:list                       # See all sandboxes
task env:status -- {task-id}        # Inspect one
task env:destroy -- {task-id}       # Force-destroy
```

Clean up stale sandboxes older than 24 hours:

```bash
task env:cleanup:stale -- 24
```
