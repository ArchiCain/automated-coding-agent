# Local Workflow

Day-to-day development patterns. For how the Docker Compose stack is structured, see [Docker Compose](../infrastructure/docker-compose.md).

## Starting the stack

```bash
task start-local          # Start all services
task status               # Verify everything is healthy
```

Services and their local URLs:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8085 |
| Keycloak | http://localhost:8081 |
| Keycloak Admin | http://localhost:8081/admin/ |
| PGWeb | http://localhost:8082 |
| Coding Agent Frontend | http://localhost:3001 |
| Coding Agent Backend | http://localhost:8086 |
| Docs | http://localhost:8083 |

## Login credentials

| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `admin` | user, admin |
| `testuser` | `password` | user |

## Working on a service

Source code is volume-mounted, so changes are picked up automatically via hot reload. No rebuilds needed for code changes.

```bash
task backend:local:logs       # Tail logs for one service
task frontend:local:restart   # Restart if needed
task backend:local:shell      # Shell into container
```

## Running tests

Unit tests run on your host machine (not in Docker) and don't require the stack:

```bash
task backend:local:test
task frontend:local:test
```

Integration tests connect to the running stack:

```bash
task start-local                          # Stack must be running
task backend:local:test:integration
task frontend:local:test:integration
```

E2E tests use Playwright against the full stack:

```bash
task e2e:install    # One-time setup
task e2e:test       # Run all E2E tests
```

## Rebuilding

If you change a Dockerfile or `package.json`:

```bash
task start-local:build        # Rebuild and restart
```

For a clean slate:

```bash
task purge-and-restart-local  # Tear down volumes, rebuild, restart
```

## Port conflicts

```bash
lsof -i :8085                 # Find what's using a port
kill -9 $(lsof -t -i:8085)   # Kill it
```
