# Environment Setup

## Create your .env file

Copy the template and fill in your values:

```bash
cp .env.template .env
```

The `.env` file is the single source of truth for all configuration. It is gitignored and never committed.

## .env structure

The file is organized into sections:

### Local development ports

```bash
BACKEND_PORT=8085
KEYCLOAK_PORT=8081
FRONTEND_PORT=3000
DATABASE_PORT=5437
PGWEB_PORT=8082
CODING_AGENT_BACKEND_PORT=8086
CODING_AGENT_FRONTEND_PORT=3001
DOCS_PORT=8083
```

### Database

```bash
DATABASE_HOST=database           # Docker service name
DATABASE_HOST_LOCAL=localhost     # For running tests on the host
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres        # Change for production
DATABASE_NAME=postgres
DATABASE_SSL=false
```

### Keycloak

```bash
KEYCLOAK_REALM=application
KEYCLOAK_CLIENT_ID=backend-service
KEYCLOAK_CLIENT_SECRET=backend-service-secret
KEYCLOAK_ADMIN_PASSWORD=admin
```

### API keys

```bash
ANTHROPIC_API_KEY=               # Required for coding agent
OPENAI_API_KEY=                  # Optional
GOOGLE_GENERATIVE_AI_API_KEY=    # Optional
```

### Coding agent

```bash
CLAUDE_CODE_OAUTH_TOKEN=         # From `claude setup-token` (Max plan)
GITHUB_TOKEN=                    # Fine-grained PAT with repo write access
```

### K8s deployment

These are only needed when deploying to a cluster. See [Kubernetes](../infrastructure/kubernetes.md) for details.

```bash
DEPLOY_ENV=dev
NAMESPACE=app
REGISTRY=localhost:30500
BACKEND_HOST=api.localhost
FRONTEND_HOST=app.localhost
KEYCLOAK_HOST=auth.localhost
DOCS_HOST=docs.localhost
```

## direnv integration

The `.envrc` file contains `use flake`, which tells direnv to activate the Nix dev shell. The root `Taskfile.yml` loads `.env` via its `dotenv` directive, so all task commands automatically have access to environment variables.

## No-defaults policy

Application code must never provide fallback defaults for environment variables:

```typescript
// Bad - hides misconfiguration
const host = process.env.DATABASE_HOST || "localhost";

// Good - fails fast if not set
const host = process.env.DATABASE_HOST;
if (!host) throw new Error('DATABASE_HOST must be set in .env');
```

Defaults belong in `.env.template` and Docker Compose, not in application code.
