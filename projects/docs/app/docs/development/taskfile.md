# Taskfile Conventions

All automation uses [go-task](https://taskfile.dev) with a hierarchical Taskfile structure.

## Command pattern

```
service-name:environment:action
```

| Segment | Meaning | Examples |
|---------|---------|----------|
| Service | Which project | `backend`, `frontend`, `e2e`, `coding-agent-backend` |
| Environment | Where it runs | `local` |
| Action | What to do | `start`, `stop`, `test`, `build`, `lint` |

## Taskfile hierarchy

```
Taskfile.yml (root)
├── projects/backend/Taskfile.yml
├── projects/frontend/Taskfile.yml
├── projects/database/Taskfile.yml
├── projects/keycloak/Taskfile.yml
├── projects/e2e/Taskfile.yml
├── projects/coding-agent-backend/Taskfile.yml
├── projects/coding-agent-frontend/Taskfile.yml
├── projects/docs/Taskfile.yml
└── infrastructure/Taskfile.yml
    ├── infrastructure/docker/Taskfile.yml
    ├── infrastructure/k8s/Taskfile.yml
    └── infrastructure/terraform/Taskfile.yml
```

The root Taskfile includes all project Taskfiles and delegates infrastructure commands to the `infra:` namespace.

## Common commands

### Local development

```bash
task start-local              # Start all services (Docker Compose)
task start-local:build        # Start with rebuild
task stop-local               # Stop all services
task purge-local              # Teardown + remove volumes
task logs-local               # Follow all logs
task status                   # Show service status
```

### Testing

```bash
task run-all-tests                        # Full test suite
task backend:local:test                   # Backend unit tests
task frontend:local:test                  # Frontend unit tests
task backend:local:test:integration       # Backend integration tests
task frontend:local:test:integration      # Frontend integration tests
task e2e:test                             # E2E tests
```

### Build & deploy

```bash
task build:all                # Build and push all images
task build:backend            # Build one service
task deploy:diff              # Preview cluster changes
task deploy:apply             # Deploy all services
task deploy:status            # Pod status
task deploy:logs -- backend   # Tail service logs
```

### Infrastructure

```bash
task infra:init               # Initialize Terraform
task infra:plan               # Plan changes
task infra:apply              # Provision EC2 + K3s
```

## Environment variable loading

The root Taskfile uses `dotenv: ['.env']` to automatically load all environment variables. Every task has access to the full `.env` without manual sourcing.

## Adding tasks for a new project

1. Create `projects/myproject/Taskfile.yml` with your project's tasks
2. Add the include in the root `Taskfile.yml`:
   ```yaml
   includes:
     myproject: ./projects/myproject/Taskfile.yml
   ```
3. Tasks are now available as `task myproject:local:start`, etc.
