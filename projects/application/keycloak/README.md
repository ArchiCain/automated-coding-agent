# Keycloak

Centralized authentication service with cookie-based session management, RBAC, and SSO support.

## Project Structure

```
projects/application/keycloak/
├── app/
│   ├── scripts/
│   │   └── startup.sh              # DB wait, schema create, realm import, role setup
│   └── realm-config/
│       └── realm-export.json        # Realm definition (auto-imported on startup)
├── dockerfiles/
│   └── Dockerfile                   # Multi-stage: keycloak 23.0.3 + psql + envsubst
├── chart/
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── deployment.yaml
│       ├── service.yaml
│       ├── ingress.yaml
│       ├── configmap.yaml
│       └── secret.yaml
└── Taskfile.yml
```

## Startup Process

The `startup.sh` script handles initialization:

1. Waits for PostgreSQL to be ready (30 retries)
2. Creates `keycloak` schema if it doesn't exist
3. Processes realm config with `envsubst` (substitutes `${FRONTEND_URL}`, etc.)
4. Starts Keycloak in the background
5. Waits for Keycloak to be fully ready
6. Assigns `manage-users`, `view-users`, `query-users` roles to the `backend-service` service account (idempotent via marker file)

## Realm Configuration

- **Realm:** `application`
- **Client:** `backend-service` (confidential, service account enabled)
- **Roles:** `user` (default), `admin`
- **Token lifespans:** access 300s, SSO idle 1800s, SSO max 36000s
- **Security:** brute force protection enabled, email verification required

## Test Users

| Username | Password | Roles |
|----------|----------|-------|
| `admin` | `admin` | user, admin |
| `testuser` | `password` | user |

Admin console: http://localhost:8081/admin/ (admin/admin)

## Tasks

```bash
task keycloak:local:start         # Start Keycloak
task keycloak:local:stop          # Stop
task keycloak:local:restart       # Rebuild and restart
task keycloak:local:logs          # View logs
task keycloak:local:export-realm  # Export current realm config
task keycloak:local:import-realm  # Force reimport realm
```

## Integration

The backend acts as an auth proxy — the frontend never talks to Keycloak directly. The backend exchanges credentials, validates JWTs, and manages tokens via HTTP-only cookies. See `features/keycloak-auth/` in the backend project for the integration code.
