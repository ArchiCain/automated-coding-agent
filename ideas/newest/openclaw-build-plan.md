# OpenClaw Build Plan: All-In-One Implementation

## Items Needed Before Starting

Provide these before kicking off the build.

### 1. Anthropic API Key

- [ ] API key from console.anthropic.com (for OpenClaw Gateway orchestration)
- [ ] Set a spending limit on the account to prevent runaway costs

### 2. Confirm Existing Secrets

These should already be in `ENV_FILE_MAC_MINI` GitHub Actions secret:
- [ ] `CLAUDE_CODE_OAUTH_TOKEN` — for Claude Code ACP sessions
- [ ] `GITHUB_TOKEN` — for git operations
- [ ] `ANTHROPIC_API_KEY` — add the new key here too

### 3. One-Time Decisions

- [ ] Max parallel coding sessions? (suggest `4` to start)
- [ ] Generate a GitHub webhook secret: `openssl rand -hex 32`

That's it. No Discord bot, no pairing, no third-party accounts.

---

## Architecture: OpenClaw in K8s

OpenClaw deploys exactly like the coding-agent-backend it replaces — same patterns, same pipeline, same secrets flow.

```
Mac Mini K3s Cluster
|
+-- app namespace (existing, unchanged)
|   +-- database, backend, frontend, keycloak, docs
|
+-- openclaw namespace (new, replaces coding-agent)
    +-- openclaw-gateway (Deployment)
        +-- Nix-based Docker image (same pattern as coding-agent-backend)
        +-- OpenClaw Gateway daemon (replaces NestJS app)
        +-- Built-in Web UI (served on same port as Gateway)
        +-- Claude Code CLI (for ACP sessions)
        +-- Playwright + headless Chromium (for E2E testing)
        +-- git, go-task, gh CLI
        +-- Skills baked into image (SKILL.md files)
        +-- Secrets from K8s Secret:
        |   - ANTHROPIC_API_KEY (Gateway orchestration)
        |   - CLAUDE_CODE_OAUTH_TOKEN (Claude Code ACP)
        |   - GITHUB_TOKEN (git operations)
        |   - OPENCLAW_WEBHOOK_SECRET (webhook auth)
        +-- Workspace PVC (50Gi, for repo clones)
        +-- Ingress: openclaw.mac-mini (Web UI + webhook receiver)
        +-- Can reach app services via K8s DNS:
            - frontend.app.svc.cluster.local:8080
            - backend.app.svc.cluster.local:8080 (API)
            - keycloak.app.svc.cluster.local:8080 (auth)
            - database.app.svc.cluster.local:5432
```

### Web UI Access

OpenClaw ships a built-in browser-based dashboard (Control UI) on the Gateway port. Accessible via Traefik ingress + Tailscale:

- **Deployed**: `https://openclaw.mac-mini` (from any device on your tailnet)
- **Local dev**: `http://localhost:18789`

Features: live chat with the agent, session monitoring, cron job management, configuration editing, exec approvals, cost tracking. Auth is token-based at the WebSocket handshake.

No Discord, no Telegram, no external messaging service required.

### How It Deploys

Identical to existing services:
1. Merge to `mac-mini` branch
2. GitHub Action connects to Tailscale
3. Builds Docker image, pushes to `mac-mini:30500`
4. Helmfile applies to K3s cluster
5. Pod rolls out with new image

### How Secrets Flow

Same as coding-agent-backend:
```
ENV_FILE_MAC_MINI (GitHub Actions secret)
  -> written to .env at deploy time
  -> sourced by Helmfile
  -> populates K8s Secret via Helm chart
  -> mounted as env vars in pod
```

No new secret management. Just add the new vars to `ENV_FILE_MAC_MINI`.

---

## What Gets Built

One PR containing everything below. Merge to `mac-mini` to deploy.

### New Files

```
projects/openclaw/
  dockerfiles/
    prod.Dockerfile                 # Nix-based image with OpenClaw + Claude Code + Playwright
    flake.nix                       # Nix dev shell (Node.js, git, go-task, gh, helm)
    entrypoint.sh                   # Git credentials + OpenClaw startup
  app/
    openclaw.json                   # Gateway config (providers, agents, webhooks, cron, auth)
    SOUL.md                         # OpenClaw agent identity and behavioral rules
    skills/
      rlm-decompose/SKILL.md       # Decomposition skill
      rlm-execute/SKILL.md         # Task execution skill
      rlm-github/SKILL.md          # GitHub operations skill
      rlm-monitor/SKILL.md         # CI monitoring skill
      rlm-e2e-tester/SKILL.md      # Post-merge E2E validation skill
  chart/
    Chart.yaml                      # Helm chart metadata
    values.yaml                     # Default values
    templates/
      deployment.yaml               # Pod spec (matches coding-agent-backend pattern)
      service.yaml                  # ClusterIP service
      ingress.yaml                  # Traefik ingress (Web UI + webhook receiver)
      configmap.yaml                # Non-secret env vars
      secret.yaml                   # Secret env vars
      pvc.yaml                      # Workspace volume
      serviceaccount.yaml           # K8s service account
      rbac.yaml                     # Cluster role
  Taskfile.yml                      # Local dev tasks (build, start, logs)
  README.md                         # Project documentation

CLAUDE.md                           # Root monorepo context for Claude Code workers
projects/application/backend/CLAUDE.md
projects/application/frontend/CLAUDE.md
infrastructure/CLAUDE.md
```

### Modified Files

```
.env.template                       # Add: ANTHROPIC_API_KEY, OPENCLAW_WEBHOOK_SECRET,
                                    #       OPENCLAW_PORT, OPENCLAW_HOST, OPENCLAW_AUTH_TOKEN
.gitignore                          # Add OpenClaw runtime files if any
Taskfile.yml                        # Add openclaw namespace (build, local start, logs)
infrastructure/docker/compose.yml   # Add openclaw-gateway service for local dev
infrastructure/k8s/helmfile.yaml.gotmpl  # Add openclaw-gateway release in openclaw namespace
.github/workflows/deploy-mac-mini.yml    # Add: build/push openclaw image, deploy openclaw namespace
```

---

## File Details

### Dockerfile (projects/openclaw/dockerfiles/prod.Dockerfile)

Same Nix-based pattern as coding-agent-backend, but runs OpenClaw instead of NestJS. Includes Playwright + headless Chromium for E2E testing (~400MB added to image).

```dockerfile
FROM nixos/nix:latest

# Nix flakes setup (same as coding-agent-backend)
RUN mkdir -p /etc/nix && printf "experimental-features = nix-command flakes\nsandbox = false\n" >> /etc/nix/nix.conf

WORKDIR /build
COPY dockerfiles/flake.nix ./flake.nix
RUN nix flake update && nix develop --command true
RUN nix develop --command bash -c 'echo "NIX_PATHS=$PATH"' > /etc/nix-env

# Git credential config (same as coding-agent-backend)
RUN nix develop --command bash -c "\
    git config --global credential.helper 'store' \
    && git config --global url.\"https://github.com/\".insteadOf 'git@github.com:' \
    "

WORKDIR /app

# Install OpenClaw globally
RUN nix develop --command bash -c "npm install -g openclaw@latest"

# Install Claude Code CLI
RUN nix develop --command bash -c "npm install -g @anthropic-ai/claude-code@latest"

# Install acpx plugin
RUN nix develop --command bash -c "openclaw plugins install @openclaw/acpx"

# Install Playwright + headless Chromium for E2E testing
# --with-deps installs system libraries (libglib, libnss, libatk, etc.)
RUN nix develop --command bash -c "npx playwright install --with-deps chromium"

# Copy OpenClaw config, skills, and soul
COPY app/ ./

# Symlink CLIs to stable PATH
RUN mkdir -p /usr/local/bin \
    && ln -sf $(nix develop --command bash -c "which openclaw") /usr/local/bin/openclaw \
    && ln -sf $(nix develop --command bash -c "which claude") /usr/local/bin/claude

# Copy entrypoint
COPY dockerfiles/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Non-root user (same pattern as coding-agent-backend)
RUN echo "agent:x:1000:1000:agent:/home/agent:/bin/bash" >> /etc/passwd \
    && echo "agent:x:1000:" >> /etc/group \
    && mkdir -p /home/agent/.claude /home/agent/.config /home/agent/.openclaw /workspace \
    && cp /root/.gitconfig /home/agent/.gitconfig \
    && chown -R 1000:1000 /app /home/agent /workspace

USER agent

# Link OpenClaw workspace to /app (where config and skills live)
RUN ln -sf /app /home/agent/.openclaw/workspace

EXPOSE 18789

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["openclaw", "gateway"]
```

### Entrypoint (projects/openclaw/dockerfiles/entrypoint.sh)

Same as coding-agent-backend:

```bash
#!/usr/bin/env bash
set -e

# Load Nix PATH
if [ -f /etc/nix-env ]; then
  source /etc/nix-env
  export PATH="/usr/local/bin:$NIX_PATHS"
fi

# Git credentials from GITHUB_TOKEN
if [ -n "$GITHUB_TOKEN" ]; then
  echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
fi

git config --global user.name "${GIT_USER_NAME:-openclaw-agent}"
git config --global user.email "${GIT_USER_EMAIL:-openclaw-agent@localhost}"

exec "$@"
```

### Docker Compose Service (added to infrastructure/docker/compose.yml)

```yaml
  openclaw-gateway:
    init: true
    build:
      context: ../../projects/openclaw
      dockerfile: dockerfiles/prod.Dockerfile
    ports:
      - "${OPENCLAW_PORT:-18789}:18789"
    env_file:
      - ../../.env
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - OPENCLAW_WEBHOOK_SECRET=${OPENCLAW_WEBHOOK_SECRET}
      # E2E testing URLs (Docker Compose service names)
      - E2E_FRONTEND_URL=http://frontend:8080
      - E2E_BACKEND_URL=http://backend:8080
      - E2E_KEYCLOAK_URL=http://keycloak:8080
    volumes:
      - ../../:/workspace
    depends_on:
      backend:
        condition: service_healthy
      frontend:
        condition: service_healthy
      keycloak:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    restart: unless-stopped
```

Local Web UI at `http://localhost:18789`.

### Helmfile Release (added to infrastructure/k8s/helmfile.yaml.gotmpl)

```yaml
  - name: openclaw-gateway
    namespace: {{ env "OPENCLAW_NAMESPACE" | default "openclaw" }}
    chart: ../../projects/openclaw/chart
    installed: {{ ne .Environment.Name "prod" }}
    createNamespace: true
    values:
      - image:
          repository: {{ env "OPENCLAW_IMAGE" | default (print (env "REGISTRY" | default "localhost:30500") "/openclaw-gateway") }}
          tag: {{ env "IMAGE_TAG" | default "latest" }}
        ingress:
          enabled: true
          host: {{ env "OPENCLAW_HOST" | default "openclaw.localhost" }}
          tls: {{ .Values | get "ingressTLS" false }}
        env:
          NODE_ENV: {{ env "NODE_ENV" | default "production" }}
          # App service URLs for E2E testing (K8s DNS)
          E2E_FRONTEND_URL: http://frontend.app.svc.cluster.local:8080
          E2E_BACKEND_URL: http://backend.app.svc.cluster.local:8080
          E2E_KEYCLOAK_URL: http://keycloak.app.svc.cluster.local:8080
          # Also available via Traefik ingress hostnames
          FRONTEND_HOST: {{ env "FRONTEND_HOST" | default "app.mac-mini" }}
          BACKEND_HOST: {{ env "BACKEND_HOST" | default "api.mac-mini" }}
          KEYCLOAK_HOST: {{ env "KEYCLOAK_HOST" | default "auth.mac-mini" }}
        secretEnv:
          ANTHROPIC_API_KEY: {{ env "ANTHROPIC_API_KEY" | default "" }}
          CLAUDE_CODE_OAUTH_TOKEN: {{ env "CLAUDE_CODE_OAUTH_TOKEN" | default "" }}
          GITHUB_TOKEN: {{ env "GITHUB_TOKEN" | default "" }}
          OPENCLAW_WEBHOOK_SECRET: {{ env "OPENCLAW_WEBHOOK_SECRET" | default "" }}
          OPENCLAW_AUTH_TOKEN: {{ env "OPENCLAW_AUTH_TOKEN" | default "" }}
        workspace:
          enabled: true
          size: {{ env "OPENCLAW_WORKSPACE_SIZE" | default "50Gi" }}
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
```

Note: `installed: {{ ne .Environment.Name "prod" }}` excludes OpenClaw from production environments automatically.

### GitHub Actions Changes (deploy-mac-mini.yml)

Add after the existing build steps:

```yaml
      - name: Build and push openclaw-gateway
        run: |
          docker build \
            -t $REGISTRY/openclaw-gateway:$IMAGE_TAG \
            -t $REGISTRY/openclaw-gateway:latest \
            -f projects/openclaw/dockerfiles/prod.Dockerfile \
            projects/openclaw
          docker push $REGISTRY/openclaw-gateway:$IMAGE_TAG
          docker push $REGISTRY/openclaw-gateway:latest
```

Add to the verify step:

```yaml
          kubectl rollout status deployment/openclaw-gateway -n openclaw --timeout=180s
          echo ""
          echo "=== OpenClaw Namespace ==="
          kubectl get pods -n openclaw
          kubectl get ingress -n openclaw
```

### OpenClaw Config (projects/openclaw/app/openclaw.json)

```json
{
  "version": 1,
  "gateway": {
    "port": 18789,
    "bind": "0.0.0.0",
    "auth": {
      "token": { "source": "env", "id": "OPENCLAW_AUTH_TOKEN" }
    }
  },
  "providers": {
    "default": "anthropic",
    "anthropic": {
      "apiKey": { "source": "env", "id": "ANTHROPIC_API_KEY" }
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-6",
      "maxConcurrent": 4,
      "subagents": {
        "maxSpawnDepth": 2,
        "maxChildrenPerAgent": 8,
        "maxConcurrent": 4,
        "runTimeoutSeconds": 1800
      }
    }
  },
  "hooks": {
    "enabled": true,
    "token": { "source": "env", "id": "OPENCLAW_WEBHOOK_SECRET" },
    "mappings": {
      "github": {
        "match": { "source": "github" },
        "agentId": "default"
      }
    }
  },
  "cron": [
    {
      "id": "monitor-ci",
      "schedule": "*/5 * * * *",
      "message": "Run rlm-monitor: check CI status on all open implementation PRs and handle failures"
    },
    {
      "id": "e2e-check",
      "schedule": "*/10 * * * *",
      "message": "Run rlm-e2e-tester: check for merged implementation PRs needing E2E validation"
    },
    {
      "id": "catchup-scan",
      "schedule": "*/15 * * * *",
      "message": "Run rlm-execute catchup: scan backlog for approved plans with unexecuted tasks"
    }
  ],
  "skills": {
    "load": {
      "extraDirs": ["./skills"]
    }
  },
  "plugins": {
    "entries": {
      "acpx": {
        "enabled": true
      }
    }
  },
  "acp": {
    "defaultAgent": "claude-code"
  }
}
```

### E2E Testing: Playwright Inside the Pod

The OpenClaw pod runs on the same K8s cluster as the application services. Playwright + headless Chromium is baked into the Docker image. This means the rlm-e2e-tester skill can run full browser-based E2E tests against the live deployed app without any additional infrastructure.

**How it works:**

```
openclaw pod (openclaw namespace)
    |
    +-- Playwright launches headless Chromium
    +-- Browser navigates to http://frontend.app.svc.cluster.local:8080
    +-- Logs in via Keycloak (http://keycloak.app.svc.cluster.local:8080)
    +-- Exercises the implemented feature
    +-- Takes screenshots on failure
    +-- Reports results back to orchestrator
```

**The existing E2E test suite** at `projects/application/e2e/app/` already uses Playwright. The rlm-e2e-tester sub-agent runs these tests with the K8s service URLs:

```bash
cd /workspace/projects/application/e2e/app
npm ci
E2E_BASE_URL=http://frontend.app.svc.cluster.local:8080 \
E2E_BACKEND_URL=http://backend.app.svc.cluster.local:8080 \
E2E_KEYCLOAK_URL=http://keycloak.app.svc.cluster.local:8080 \
npx playwright test --reporter=json
```

Or via Traefik ingress hostnames (goes through the full ingress path, closer to real user experience):

```bash
E2E_BASE_URL=http://app.mac-mini \
E2E_BACKEND_URL=http://api.mac-mini \
npx playwright test --reporter=json
```

**On failure**, the skill:
1. Captures Playwright JSON report + screenshots
2. Creates a GitHub issue with failure details, test names, error messages, and screenshots
3. Notifies in the Web UI with a link to the issue

**What this enables that CI can't do:**
- Test against the **actually deployed** app (not a CI-specific build)
- Validate that K8s deployment, Traefik routing, and service communication all work
- Catch deployment-specific issues (missing env vars, broken ingress rules, database migration failures)
- Run continuously via cron, not just on PR events

**Image size impact:** Playwright + Chromium + system deps adds ~400MB to the Docker image. The total image will be larger than coding-agent-backend but well within reason for a deployment that includes a full testing runtime.

---

## Post-Deploy: One-Time Manual Steps

After the first merge to `mac-mini` and successful deploy:

### 1. Configure GitHub Webhook

In the GitHub repo Settings > Webhooks:
- **URL**: `https://openclaw.mac-mini/hooks/github` (via Tailscale + Traefik ingress)
- **Secret**: your `OPENCLAW_WEBHOOK_SECRET` value
- **Events**: Push, Pull Request
- **Content type**: `application/json`

### 2. Validate via Web UI

Open `https://openclaw.mac-mini` from any device on your Tailscale network. Authenticate with the `OPENCLAW_AUTH_TOKEN` value. In the chat interface, send:

> What's in the root README of the workspace?

If it responds with a summary, the full stack works.

---

## Environment Variables (add to .env.template and ENV_FILE_MAC_MINI)

| Variable | Purpose | New? |
|---|---|---|
| `ANTHROPIC_API_KEY` | OpenClaw Gateway LLM provider | Needs value from console.anthropic.com |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code ACP sessions | Already exists |
| `GITHUB_TOKEN` | Git operations, GitHub API | Already exists |
| `OPENCLAW_WEBHOOK_SECRET` | Authenticate GitHub webhook payloads | New (`openssl rand -hex 32`) |
| `OPENCLAW_AUTH_TOKEN` | Web UI authentication | New (`openssl rand -hex 32`) |
| `OPENCLAW_PORT` | Gateway port (default 18789) | New |
| `OPENCLAW_HOST` | Ingress hostname (default openclaw.mac-mini) | New |
| `OPENCLAW_NAMESPACE` | K8s namespace (default openclaw) | New |
| `OPENCLAW_WORKSPACE_SIZE` | PVC size (default 50Gi) | New |

---

## Local Development

With the Docker Compose service, local testing works the same as all other services:

```bash
# Start everything including OpenClaw
task start-local

# Or start just OpenClaw
docker compose -f infrastructure/docker/compose.yml up openclaw-gateway

# View logs
docker compose -f infrastructure/docker/compose.yml logs -f openclaw-gateway

# Web UI available at http://localhost:18789
```

Local dev mounts the entire repo as `/workspace`, so OpenClaw can read plans, task trees, and CLAUDE.md files directly.

---

## What This Replaces

| Old (coding-agent) | New (openclaw) |
|---|---|
| `projects/coding-agent/backend/` (NestJS, 50+ source files) | `projects/openclaw/` (~15 files) |
| `projects/coding-agent/frontend/` (Angular app) | Built-in OpenClaw Web UI (ships with Gateway) |
| Custom session management, job queue, decomposition service | OpenClaw Gateway + skills |
| Custom WebSocket gateways | OpenClaw Web UI live chat |
| `coding-agent` K8s namespace | `openclaw` K8s namespace |
| coding-agent-backend Helm chart | openclaw-gateway Helm chart (same templates) |
| coding-agent-frontend Helm chart | Removed (Web UI is built into Gateway) |

The Helm chart templates are nearly identical to coding-agent-backend. The Dockerfile follows the same Nix pattern. The deploy workflow adds two steps (build + verify). The compose file adds one service. This is not a new system — it's a replacement that fits the existing patterns.

---

## Migration Path

### Phase 1: Build and Deploy (this PR)
- All new files created
- Merge to mac-mini, verify pod starts
- Configure GitHub webhook
- Open Web UI at `https://openclaw.mac-mini`, verify chat works
- Test: send message via Web UI -> get response

### Phase 2: Test Skills
- Push a test plan.md to plans/test branch
- Verify decomposition runs and PR opens
- Merge decomp PR, verify execution picks up tasks
- Validate Claude Code ACP sessions work inside the pod
- Validate E2E tests run via Playwright against deployed app

### Phase 3: Retire coding-agent
- Remove coding-agent-backend and coding-agent-frontend from Helmfile
- Remove from GitHub Actions build steps
- Remove from Docker Compose
- Leave source code intact in case we need to reference it

### Phase 4: Iterate
- Tune skill prompts based on decomposition and execution quality
- Adjust max-parallel based on API rate limits and pod resources
- Add OpenCode + self-hosted LLM when ready (Phase 6 from restructure doc)
- Optionally add Discord channel later if mobile access is desired
