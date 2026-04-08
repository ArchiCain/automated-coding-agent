# 08 — Taskfile Command Interface

## Goal

Extend the existing Taskfile hierarchy to support all THE Dev Team operations. The Taskfile is the single interface for every infrastructure, build, deploy, and history operation. No raw kubectl/helm/docker commands.

## Current State

The root `Taskfile.yml` (214 lines) already includes 8 project-specific taskfiles:

```
Root Taskfile.yml
├── backend:*              → Application backend tasks
├── frontend:*             → Application frontend tasks
├── database:*             → Database tasks
├── keycloak:*             → Auth provider tasks
├── e2e:*                  → E2E test tasks
├── infra:docker:*         → Docker Compose tasks
├── infra:terraform:*      → Terraform provisioning
├── infra:k8s:*            → Cluster-wide Helm deployments
├── build:*                → Docker image builds
└── deploy:*               → Cluster deployment operations
```

## Target State

Add three new task namespaces:

```
├── (existing tasks...)
├── env:*                  → Agent sandbox environment lifecycle (NEW)
├── history:*              → History search, viewing, sync, cleanup (NEW)
└── minikube:*             → Local K8s cluster management (NEW)
```

## Implementation Steps

### Step 1: Create Agent Environment Taskfile

Create `infrastructure/agent-envs/Taskfile.yml`:

```yaml
version: '3'

tasks:
  # === Environment Lifecycle ===

  create:
    desc: Create a sandbox environment for a task
    summary: |
      Creates namespace env-{task-id} and deploys the full application stack.
      Usage: task env:create -- {task-id}
    cmds:
      - kubectl create namespace env-{{.CLI_ARGS}} --dry-run=client -o yaml | kubectl apply -f -
      - kubectl label namespace env-{{.CLI_ARGS}} managed-by=the-dev-team --overwrite
      - >
        helm install {{.CLI_ARGS}}
        --namespace env-{{.CLI_ARGS}}
        --set global.imageTag={{.IMAGE_TAG | default "latest"}}
        --set global.registry={{.REGISTRY | default "localhost:30500"}}
        --set ingress.hostPrefix={{.CLI_ARGS}}
        -f infrastructure/k8s/values/sandbox.yaml
        infrastructure/k8s/charts/full-stack
      - task: wait-healthy
        vars: { TASK_ID: "{{.CLI_ARGS}}" }

  destroy:
    desc: Tear down a sandbox environment
    summary: |
      Removes the Helm release and deletes the namespace.
      Usage: task env:destroy -- {task-id}
    cmds:
      - helm uninstall {{.CLI_ARGS}} --namespace env-{{.CLI_ARGS}} --wait || true
      - kubectl delete namespace env-{{.CLI_ARGS}} --wait=false || true

  status:
    desc: Show pod and ingress status for a sandbox environment
    cmds:
      - kubectl get pods -n env-{{.CLI_ARGS}} -o wide
      - kubectl get ingress -n env-{{.CLI_ARGS}} 2>/dev/null || echo "No ingress resources"

  list:
    desc: List all active sandbox environments
    cmds:
      - kubectl get namespaces -l managed-by=the-dev-team -o custom-columns=NAME:.metadata.name,AGE:.metadata.creationTimestamp,STATUS:.status.phase

  health:
    desc: Check health of all services in a sandbox
    cmds:
      - |
        NS="env-{{.CLI_ARGS}}"
        echo "=== Pod Status ==="
        kubectl get pods -n $NS -o wide
        echo ""
        echo "=== Backend Health ==="
        kubectl exec -n $NS deployment/backend -- curl -sf http://localhost:8085/health 2>/dev/null || echo "UNHEALTHY"
        echo ""
        echo "=== Frontend Health ==="
        kubectl exec -n $NS deployment/frontend -- curl -sf http://localhost:80 2>/dev/null || echo "UNHEALTHY"

  wait-healthy:
    desc: Wait for all pods to be ready in a sandbox
    internal: true
    cmds:
      - kubectl wait --for=condition=Ready pods --all -n env-{{.TASK_ID}} --timeout=120s

  # === Logs ===

  logs:
    desc: "Stream logs from a service. Usage: task env:logs TASK_ID=x SERVICE=backend"
    cmds:
      - kubectl logs -n env-{{.TASK_ID}} deployment/{{.SERVICE}} -f --tail=200

  logs:all:
    desc: Stream logs from all services in a sandbox
    cmds:
      - kubectl logs -n env-{{.CLI_ARGS}} -l managed-by=the-dev-team -f --tail=100

  logs:errors:
    desc: Show error-level logs from a sandbox
    cmds:
      - kubectl logs -n env-{{.CLI_ARGS}} -l managed-by=the-dev-team --tail=500 | grep -i '"level":"error"\|ERROR\|error' || echo "No errors found"

  # === Builds ===

  build:
    desc: Build all images from a worktree
    cmds:
      - task: build:backend
        vars:
          IMAGE_TAG: "{{.CLI_ARGS}}"
          BUILD_CONTEXT: "{{.WORKTREE_PATH | default '.'}}/projects/application/backend"
      - task: build:frontend
        vars:
          IMAGE_TAG: "{{.CLI_ARGS}}"
          BUILD_CONTEXT: "{{.WORKTREE_PATH | default '.'}}/projects/application/frontend"
      - task: build:keycloak
        vars:
          IMAGE_TAG: "{{.CLI_ARGS}}"

  # === Database ===

  db:shell:
    desc: Open psql shell in a sandbox database
    cmds:
      - kubectl exec -it -n env-{{.CLI_ARGS}} statefulset/database -- psql -U postgres -d application

  db:query:
    desc: "Run a query. Usage: task env:db:query TASK_ID=x QUERY='SELECT 1'"
    cmds:
      - kubectl exec -n env-{{.TASK_ID}} statefulset/database -- psql -U postgres -d application -c "{{.QUERY}}"

  # === Debugging ===

  exec:
    desc: "Exec into a pod. Usage: task env:exec TASK_ID=x SERVICE=backend"
    cmds:
      - kubectl exec -it -n env-{{.TASK_ID}} deployment/{{.SERVICE}} -- /bin/sh

  port-forward:
    desc: "Port-forward a service. Usage: task env:port-forward TASK_ID=x SERVICE=backend PORT=8085"
    cmds:
      - kubectl port-forward -n env-{{.TASK_ID}} deployment/{{.SERVICE}} {{.PORT}}:{{.PORT}}

  restart:
    desc: "Restart a service. Usage: task env:restart TASK_ID=x SERVICE=backend"
    cmds:
      - kubectl rollout restart -n env-{{.TASK_ID}} deployment/{{.SERVICE}}

  # === Cleanup ===

  cleanup:stale:
    desc: "Tear down sandboxes older than N hours. Usage: task env:cleanup:stale -- 24"
    cmds:
      - |
        kubectl get namespaces -l managed-by=the-dev-team \
          --sort-by=.metadata.creationTimestamp -o json \
          | jq -r '.items[] | select(
              (now - (.metadata.creationTimestamp | fromdateiso8601)) > ({{.CLI_ARGS}} * 3600)
            ) | .metadata.name' \
          | xargs -I{} task env:destroy -- {}
```

### Step 2: Create History Taskfile

Create `infrastructure/history/Taskfile.yml`:

```yaml
version: '3'

tasks:
  search:
    desc: "Search transcripts for a pattern. Usage: task history:search -- 'TypeError'"
    cmds:
      - grep -rn "{{.CLI_ARGS}}" .the-dev-team/history/sessions/ | head -50

  task:
    desc: "Show summary for a task. Usage: task history:task -- abc123"
    cmds:
      - cat .the-dev-team/history/tasks/*/task-{{.CLI_ARGS}}-*.md 2>/dev/null || echo "Task not found"

  sessions:
    desc: "List session transcripts for a task. Usage: task history:sessions -- abc123"
    cmds:
      - ls -la .the-dev-team/history/sessions/*/*/task-{{.CLI_ARGS}}-* 2>/dev/null || echo "No sessions found"

  tail:
    desc: Follow the latest orchestrator events
    cmds:
      - tail -f .the-dev-team/history/orchestrator/$(date +%Y/%m/%d).jsonl | jq . 2>/dev/null || echo "No events today"

  costs:
    desc: "Show costs for a date. Usage: task history:costs -- 2026-04-01"
    cmds:
      - |
        DATE={{.CLI_ARGS | default "$(date +%Y-%m-%d)"}}
        grep "$DATE" .the-dev-team/history/index.jsonl 2>/dev/null | jq -s '{
          tasks: length,
          totalCost: ([.[].cost] | add),
          avgDurationMinutes: (([.[].durationMs] | add) / length / 60000 | floor),
          completed: ([.[] | select(.status == "completed")] | length),
          failed: ([.[] | select(.status == "failed")] | length)
        }' || echo "No data for $DATE"

  failures:
    desc: Show recent failures with reasons
    cmds:
      - grep '"status":"failed"' .the-dev-team/history/index.jsonl 2>/dev/null | tail -10 | jq '{taskId, title, failureReason, cost}' || echo "No failures recorded"

  sync:
    desc: Trigger an immediate history sync to git
    cmds:
      - |
        curl -X POST \
          -H "Authorization: token ${GITHUB_TOKEN}" \
          -H "Accept: application/vnd.github.v3+json" \
          "https://api.github.com/repos/${GITHUB_REPO}/dispatches" \
          -d '{"event_type":"history-sync"}'

  cleanup:
    desc: "Remove transcripts older than N days from PVC. Usage: task history:cleanup -- 90"
    cmds:
      - find .the-dev-team/history/sessions/ -name "*.jsonl" -mtime +{{.CLI_ARGS}} -delete 2>/dev/null
      - echo "Cleaned up transcripts older than {{.CLI_ARGS}} days"
```

### Step 3: Include New Taskfiles in Root

Edit the root `Taskfile.yml` to include the new taskfiles:

```yaml
includes:
  # ... existing includes ...
  env:
    taskfile: infrastructure/agent-envs/Taskfile.yml
    dir: .
  history:
    taskfile: infrastructure/history/Taskfile.yml
    dir: .
  minikube:
    taskfile: infrastructure/minikube/Taskfile.yml
    dir: .
```

### Step 4: Update Build Tasks for Worktree Support

The existing `build:*` tasks need to accept a `WORKTREE_PATH` variable so they can build from agent worktrees instead of the main repo:

```yaml
build:backend:
  desc: Build backend Docker image
  vars:
    BUILD_CONTEXT: "{{.BUILD_CONTEXT | default 'projects/application/backend'}}"
    IMAGE_TAG: "{{.IMAGE_TAG | default 'latest'}}"
  cmds:
    - docker build -t localhost:30500/backend:{{.IMAGE_TAG}} -f {{.BUILD_CONTEXT}}/Dockerfile {{.BUILD_CONTEXT}}
    - docker push localhost:30500/backend:{{.IMAGE_TAG}}
```

### Step 5: Create Sandbox Values File

Create `infrastructure/k8s/values/sandbox.yaml` — minimal resource values for agent sandbox environments:

```yaml
# Sandbox environments use minimal resources
# These values override the defaults for agent-created namespaces

global:
  resourceProfile: sandbox

backend:
  replicas: 1
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi

frontend:
  replicas: 1
  resources:
    requests:
      cpu: 50m
      memory: 128Mi
    limits:
      cpu: 200m
      memory: 256Mi

database:
  replicas: 1
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
    limits:
      cpu: 500m
      memory: 512Mi
  storage: 1Gi    # Small, ephemeral

keycloak:
  replicas: 1
  resources:
    requests:
      cpu: 100m
      memory: 512Mi
    limits:
      cpu: 500m
      memory: 1Gi
```

## Verification

- [ ] `task --list` shows all new `env:*`, `history:*`, and `minikube:*` commands
- [ ] `task env:create -- test-123` creates a namespace with the full stack
- [ ] `task env:status -- test-123` shows pod and ingress status
- [ ] `task env:health -- test-123` reports service health
- [ ] `task env:destroy -- test-123` cleanly removes everything
- [ ] `task env:build -- test-123` builds images with the correct tag
- [ ] `task history:costs` reports cost data from the index
- [ ] Build tasks accept `WORKTREE_PATH` for agent worktree builds

## Open Questions

- **CLI_ARGS vs named vars:** Taskfile supports both `{{.CLI_ARGS}}` (positional) and named variables. Some commands need multiple args (e.g., `env:logs` needs task-id + service). Decide on a consistent pattern — named vars are clearer but more verbose.
- **Error handling in tasks:** What happens if `helm install` fails? The task should return non-zero but the orchestrator needs to handle this gracefully.
- **Dry-run mode:** Should tasks support a `--dry-run` flag that shows what commands would run without executing? Useful for debugging.
