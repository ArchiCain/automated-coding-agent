# Local Workflow

Day-to-day development patterns for the two main workflows in this repo:

1. **Working on application code** — backend, frontend, database, keycloak
2. **Running THE Dev Team** — agent backend + chat UI + sandbox environments

Everything runs in Kubernetes (Minikube locally, K3s in production) with the same topology. All access is via Tailscale hostnames — there is no localhost fallback.

## Starting the full stack

```bash
task up
```

This single command starts Minikube, builds all images, and deploys everything via Helmfile. With the Tailscale gateway configured (see [Environment Setup](../getting-started/environment-setup.md)), services are available at:

| Service | URL |
|---------|-----|
| THE Dev Team chat UI | `http://devteam.{DEV_HOSTNAME}` |
| THE Dev Team API | `http://agent-api.{DEV_HOSTNAME}` |
| Application frontend | `http://app.{DEV_HOSTNAME}` |
| Application API | `http://api.{DEV_HOSTNAME}` |
| Keycloak | `http://auth.{DEV_HOSTNAME}` |

These URLs work from any device on your tailnet — laptop, phone, etc.

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

Use this for changes that depend on cluster-specific behaviour (ingress, service discovery).

## Verify everything is healthy

```bash
task status
# Expect: all pods Running in app and the-dev-team namespaces
```

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
task e2e:test        # Run all E2E tests
```

## Rebuilding after Dockerfile / package.json changes

```bash
eval $(minikube docker-env)
task build:all                 # Rebuild everything
task deploy:apply              # Roll out
```

For a clean slate:

```bash
task reset:up
```
