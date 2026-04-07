# 09 — Sandbox Environments (Namespace-per-Task)

## Goal

Every active task gets its own K8s namespace with a full application stack (backend, frontend, database, Keycloak). These are ephemeral, fully isolated sandboxes that agents use to validate their work against a live environment.

## Current State

- Helm charts exist in `infrastructure/k8s/charts/` for individual services
- `helmfile.yaml.gotmpl` orchestrates chart deployments
- Production deploys to `app` namespace on K3s
- Docker Compose (`infrastructure/docker/compose.yml`) currently runs local dev — being replaced
- No umbrella chart for deploying the full stack to a single namespace
- No dynamic namespace creation/teardown

## Target State

- Umbrella Helm chart (`charts/full-stack`) that deploys all app services into one namespace
- Parameterized: image tags, ingress hosts, resource limits, namespace
- Agent can create/destroy environments via Taskfile commands
- Each environment is accessible via ingress: `app.{task-id}.localhost`, `api.{task-id}.localhost`
- Database bootstrapping: migrations + seed data on first deploy
- Keycloak realm import on first deploy
- Full teardown on task completion

## Implementation Steps

### Step 1: Create the Full-Stack Umbrella Chart

Create `infrastructure/k8s/charts/full-stack/`:

```
charts/full-stack/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── database-statefulset.yaml
│   ├── database-service.yaml
│   ├── database-pvc.yaml
│   ├── keycloak-deployment.yaml
│   ├── keycloak-service.yaml
│   ├── ingress.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── init-job.yaml           ← Database migrations + seed data
│   └── keycloak-realm-job.yaml ← Realm import
└── values/
    ├── sandbox.yaml            ← Minimal resources for agent sandboxes
    └── production.yaml         ← Production resource levels
```

Alternatively, use Helm chart dependencies to compose existing individual charts:

```yaml
# Chart.yaml
apiVersion: v2
name: full-stack
description: Full application stack for sandbox environments
version: 1.0.0
dependencies:
  - name: backend
    version: "1.0.0"
    repository: "file://../backend"
  - name: frontend
    version: "1.0.0"
    repository: "file://../frontend"
  - name: database
    version: "1.0.0"
    repository: "file://../database"
  - name: keycloak
    version: "1.0.0"
    repository: "file://../keycloak"
```

The dependency approach is cleaner if individual charts already exist. Otherwise, create a monolithic chart — it's simpler for sandbox use.

### Step 2: Parameterize the Chart

`values.yaml` for the full-stack chart:

```yaml
global:
  registry: localhost:30500
  imageTag: latest
  domain: localhost

backend:
  image: backend
  port: 8085
  replicas: 1
  env:
    DATABASE_HOST: database
    DATABASE_PORT: "5432"
    DATABASE_USERNAME: postgres
    DATABASE_PASSWORD: postgres
    DATABASE_NAME: application
    KEYCLOAK_URL: http://keycloak:8081
    KEYCLOAK_REALM: application

frontend:
  image: frontend
  port: 80
  replicas: 1
  env:
    VITE_BACKEND_URL: ""   # Set dynamically based on ingress

database:
  image: pgvector/pgvector:pg16
  port: 5432
  storage: 1Gi
  username: postgres
  password: postgres
  dbName: application

keycloak:
  image: keycloak
  port: 8081
  admin: admin
  adminPassword: admin
  realm: application

ingress:
  enabled: true
  className: nginx
  hostPrefix: ""   # Set to task-id for dynamic routing
  annotations: {}
```

### Step 3: Create Ingress Template

`templates/ingress.yaml`:

```yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ .Release.Name }}-ingress
  annotations:
    {{- toYaml .Values.ingress.annotations | nindent 4 }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  rules:
    - host: api.{{ .Values.ingress.hostPrefix }}.{{ .Values.global.domain }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Release.Name }}-backend
                port:
                  number: {{ .Values.backend.port }}
    - host: app.{{ .Values.ingress.hostPrefix }}.{{ .Values.global.domain }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Release.Name }}-frontend
                port:
                  number: {{ .Values.frontend.port }}
    - host: auth.{{ .Values.ingress.hostPrefix }}.{{ .Values.global.domain }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ .Release.Name }}-keycloak
                port:
                  number: {{ .Values.keycloak.port }}
{{- end }}
```

### Step 4: Create Database Init Job

`templates/init-job.yaml` — runs TypeORM migrations and seed data:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ .Release.Name }}-db-init
  annotations:
    helm.sh/hook: post-install
    helm.sh/hook-weight: "0"
    helm.sh/hook-delete-policy: hook-succeeded
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: {{ .Values.global.registry }}/{{ .Values.backend.image }}:{{ .Values.global.imageTag }}
          command: ["npm", "run", "migration:run"]
          env:
            - name: DATABASE_HOST
              value: {{ .Release.Name }}-database
            - name: DATABASE_PORT
              value: "5432"
            - name: DATABASE_USERNAME
              value: {{ .Values.database.username }}
            - name: DATABASE_PASSWORD
              value: {{ .Values.database.password }}
            - name: DATABASE_NAME
              value: {{ .Values.database.dbName }}
      restartPolicy: Never
  backoffLimit: 3
```

### Step 5: Create Keycloak Realm Import Job

Keycloak needs a realm with clients and test users. Two approaches:

**Option A: Volume-mount realm export JSON**
- Export the realm from the existing Keycloak
- Mount as a ConfigMap in the Keycloak deployment
- Keycloak auto-imports on first start via `--import-realm`

**Option B: Init container that calls Keycloak Admin API**
- Wait for Keycloak to be healthy
- Use `kcadm.sh` to create realm, clients, users

Option A is simpler. The existing `projects/application/keycloak/` likely has a realm export — use it.

### Step 6: Wire Environment Manager to Taskfile

The `EnvironmentManagerService` (Plan 04) calls Taskfile commands. The mapping:

```typescript
// Create environment
await this.taskfile.run('env:create', taskId);

// This runs:
// 1. kubectl create namespace env-{taskId}
// 2. helm install {taskId} --namespace env-{taskId} -f sandbox.yaml ./charts/full-stack
// 3. kubectl wait --for=condition=Ready pods --all -n env-{taskId}
```

### Step 7: Handle DNS/Ingress for Local Access

For Minikube, the agent accesses services via:
- **Cluster DNS**: `backend.env-{task-id}.svc.cluster.local:8085` (from within the cluster)
- **Ingress**: `api.{task-id}.localhost` (from outside, requires Minikube tunnel)

For tests running inside the agent pod (which is in the cluster), use cluster DNS directly. For Playwright tests (which run in the agent pod), access via cluster DNS too.

### Step 8: Create Sandbox Values Override

The `sandbox.yaml` values file (referenced in Step 1 of Plan 08) sets minimal resources:

- Backend: 100m CPU, 256Mi RAM
- Frontend: 50m CPU, 128Mi RAM
- Database: 100m CPU, 256Mi RAM, 1Gi storage
- Keycloak: 100m CPU, 512Mi RAM

These are enough to validate functionality but won't represent production performance.

## Verification

- [ ] `helm install test-env --namespace env-test -f sandbox.yaml ./charts/full-stack` deploys all services
- [ ] All pods reach Ready state within 120 seconds
- [ ] Backend health endpoint responds
- [ ] Frontend serves the SPA
- [ ] Keycloak has the application realm
- [ ] Database has migrated schema
- [ ] Ingress routes work (both cluster-internal DNS and external)
- [ ] `helm uninstall test-env --namespace env-test && kubectl delete namespace env-test` cleans up everything
- [ ] No PVCs or resources are leaked after teardown

## Open Questions

- **Umbrella chart vs Helmfile environment:** Using a Helmfile environment file instead of an umbrella chart would keep the existing individual charts and just compose them per-environment. This is simpler if the individual charts are already well-parameterized. Evaluate both approaches.
- **Keycloak startup time:** Keycloak is slow to start (~30-60 seconds). This is the bottleneck for environment creation time. Consider: shared Keycloak across sandboxes? Or pre-built Keycloak image with realm baked in?
- **Database seed data:** What data does the sandbox need? Empty database with just migrations? Or seed data for testing (test users, sample records)? This is project-specific.
- **Image caching:** Building Docker images for every task is slow. Can agents share images if they're on the same base branch? Use a common base tag and only rebuild what changed?
