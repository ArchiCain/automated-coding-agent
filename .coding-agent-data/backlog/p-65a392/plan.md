---
id: p-65a392
created: 2026-02-12T03:12:45.878Z
updated: 2026-02-12T04:30:00.000Z
---

# Migration to Dokploy-style Deployment

Research and notes for adapting automated-repo to a simpler, Dokploy-based deployment model inspired by the illume-main project.

---

## AUTOMATED-REPO: Current State

### Overall Structure

```
automated-repo/
├── projects/
│   ├── backend/           (NestJS API, port 8085)
│   │   ├── Dockerfile     (local dev, hot reload)
│   │   ├── dockerfiles/
│   │   │   └── dev.Dockerfile  (multi-stage for AWS)
│   │   ├── docker-compose.yml  (service-level compose)
│   │   └── Taskfile.yml
│   ├── frontend/          (React/Vite, port 3000)
│   │   ├── Dockerfile
│   │   ├── dockerfiles/
│   │   │   └── dev.Dockerfile
│   │   ├── docker-compose.yml
│   │   └── Taskfile.yml
│   ├── database/          (PostgreSQL 16 + pgvector, port 5437)
│   │   ├── docker-compose.yml
│   │   └── Taskfile.yml
│   ├── keycloak/          (Auth, port 8081)
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── Taskfile.yml
│   ├── e2e/               (Playwright tests)
│   │   └── Taskfile.yml
│   ├── local-only/
│   │   ├── coding-agent-backend/   (NestJS, port 1086)
│   │   └── coding-agent-frontend/  (Angular, port 4200)
│   ├── docker-compose.yml          (orchestrator for all services)
│   └── shared/                     (shared TypeScript code)
├── terraform/
│   ├── aws/
│   │   ├── environments/dev/       (dev env terraform)
│   │   └── remote-state/           (S3 + DynamoDB state)
│   └── Taskfile.yml
├── Taskfile.yml           (root task orchestrator)
├── .env.template
├── flake.nix              (Nix dev environment)
└── .envrc                 (direnv integration)
```

### Docker Architecture

**Nested Docker Compose Pattern:**
- Each service has its own `docker-compose.yml` in its project directory
- A root-level `projects/docker-compose.yml` orchestrates everything
- Services reference their own Dockerfiles locally
- Designed so each project could be "plucked" and run independently (acknowledged as unnecessary)

**Local Dev Dockerfiles** (per service):
- Simple `FROM node:20-alpine`
- Runtime npm install (not baked in)
- Volume mounts for hot reload
- Dev-specific CMD (e.g., `npm run start:dev`)

**AWS Dockerfiles** (`dockerfiles/dev.Dockerfile`):
- Multi-stage builds (deps -> builder -> runtime)
- Production dependencies only in final stage
- Platform: linux/amd64 for AWS compatibility
- Optimized for image size

**Docker Network:** `projects_app_network` (bridge)
- Services communicate by container hostname: `backend`, `database`, `keycloak`, `frontend`
- Ports exposed to host for local access

**Service Startup Order (health-check driven):**
1. Database (pg_isready)
2. Keycloak (depends on database)
3. Backend (depends on database + keycloak)
4. Frontend (depends on backend + keycloak)

### Terraform (AWS Infrastructure)

**What Terraform manages:**
- VPC (10.0.0.0/16) with public/private subnets across 2 AZs
- ECS Fargate cluster (serverless containers)
- ECR repositories (one per service: backend, frontend, keycloak)
- Application Load Balancer with SSL (ACM certificates)
- RDS PostgreSQL 16 (db.t4g.micro, free tier)
- Route53 DNS records (separate AWS account)
- CloudWatch log groups per service
- AWS Secrets Manager (DB creds, LLM API keys)
- NAT Gateway for private subnet internet access
- Bastion host (t3.micro) for DB tunnel access
- Security groups (ALB, ECS, RDS, Bastion)
- ECS Service Discovery (private DNS namespace `local`)

**State Management:**
- S3 bucket: `terraform-state-automated-repo`
- DynamoDB lock table: `terraform-locks-automated-repo`
- State key: `dev/terraform.tfstate`

**Resource Naming:** `{project_name}-{environment}-{resource_type}`
- Example: `automated-repo-dev-cluster`, `backend-automated-repo-dev`

**Terraform Outputs (auto-synced to .env):**
- Infrastructure URLs (INFRA_BACKEND_URL, INFRA_FRONTEND_URL, INFRA_KEYCLOAK_URL)
- ECR repository URLs
- ECS cluster/service names
- CloudWatch log groups
- Database endpoint + credentials secret
- ALB details, VPC ID, NAT Gateway IP

### Deployment Pipeline (Current)

**Manual, task-driven process per service:**

1. `task backend:dev:build` - Build Docker image (multi-stage, linux/amd64)
2. `task backend:dev:push` - Authenticate with ECR, push image
3. `task backend:dev:update-service` - `aws ecs update-service --force-new-deployment`
4. (Or `task backend:dev:deploy` to run all 3)

**Full stack:** `task deploy-dev` runs backend -> keycloak -> frontend in sequence

**No CI/CD pipeline - all manual via Taskfile commands**

### Taskfile Inventory

**Root Taskfile includes:**
- terraform, backend, frontend, database, keycloak, e2e, coding-agent-backend, coding-agent-frontend

**Task count by area:**
- Root: ~10 tasks (start-local, stop-local, purge-local, deploy-dev, etc.)
- Backend: ~25 tasks (local:*, dev:*, migrations, tests, lint, format)
- Frontend: ~20 tasks (local:*, dev:*, tests, lint, type-check)
- Database: ~15 tasks (local:*, dev:*, pgweb, backup, reset)
- Keycloak: ~12 tasks (local:*, dev:*, realm export/import)
- E2E: ~10 tasks (test variants, traces, reports)
- Terraform: ~12 tasks (init, plan, apply, destroy, remote-state)

**Total: ~100+ tasks** across all Taskfiles

### Environment Variables

**Root .env sections:**
- Project identity (PROJECT_NAME, COMPOSE_PROJECT_NAME)
- DNS config (DNS_POSTFIX, DNS_DOMAIN_SUFFIX)
- Local ports (BACKEND_PORT, KEYCLOAK_PORT, FRONTEND_PORT, DATABASE_PORT, PGWEB_PORT)
- Local URLs (VITE_BACKEND_URL, CORS_ORIGINS)
- Database config (host, user, pass, name, ssl, logging)
- Keycloak config (realm, client ID, client secret, admin password)
- AWS credentials (profile, region, access key, secret key)
- Route53 credentials (separate account for DNS)
- Terraform variables (TF_VAR_*)
- LLM API keys (OpenAI, Anthropic, Google)
- Terraform outputs (INFRA_* - auto-generated, read-only)

**No-Defaults Policy:** Missing env vars cause startup errors, never silently fall back

### AWS Networking

```
Internet
    │
    ▼
ALB (public subnets, ports 80/443)
    │
    ▼
ECS Services (private subnets, Fargate)
    ├── backend.local:8080
    ├── frontend.local:8080
    └── keycloak.local:8080
    │
    ▼
RDS PostgreSQL (private subnet)
    │
Bastion Host (public subnet, for DB tunnel)
```

**DNS:**
- api.automated-repo.rtsdev.co -> ALB -> Backend
- app.automated-repo.rtsdev.co -> ALB -> Frontend
- auth.automated-repo.rtsdev.co -> ALB -> Keycloak

---

## ILLUME-MAIN: Dokploy Reference Implementation

### Overall Structure

```
illume-main/
├── services/
│   ├── api/              (Node.js/Express backend)
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   ├── scripts/
│   │   │   ├── start-dev.sh
│   │   │   └── start-prod.sh
│   │   ├── drizzle/      (migrations)
│   │   └── src/
│   └── db/
│       └── init.sql      (CREATE EXTENSION vector)
├── apps/
│   └── iq-ui/            (Vue 3 frontend)
├── infrastructure/       (Terraform for Dokploy EC2)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── dokploy-install.sh
├── e2e/                  (Playwright E2E tests)
├── compose.dev.yml       (dev environment)
├── compose.prod.yml      (prod environment)
├── compose.common.yml    (shared config)
├── compose.e2e.yml       (testing)
├── Makefile              (simple commands)
├── .env.example
└── package.json
```

### Dokploy: How It Works

**What is Dokploy:**
- Self-hosted PaaS (Platform as a Service)
- Manages Docker containers on a single server
- Built-in reverse proxy via Traefik
- Automatic SSL via Let's Encrypt
- Git-push-to-deploy workflow
- Web UI for monitoring and management
- Accessible at http://<server_ip>:3000

**Infrastructure Terraform (minimal):**
- Single EC2 instance (t3.medium)
- 50GB encrypted EBS volume (gp3)
- Elastic IP for stable address
- Security group (ports 22, 80, 443, 3000, 8000-9000)
- User data script installs Dokploy automatically

**That's it for infrastructure.** No VPC, no ECS, no ECR, no ALB, no NAT Gateway, no RDS, no CloudWatch, no Secrets Manager, no Service Discovery.

**Deployment Flow:**
1. Terraform creates EC2 + installs Dokploy
2. Access Dokploy UI at http://<elastic_ip>:3000
3. Connect git repository in Dokploy
4. Dokploy reads compose.prod.yml
5. On git push: Dokploy pulls, builds, deploys automatically
6. Traefik handles SSL + reverse proxy
7. Containers managed by Dokploy's Docker orchestration

### Docker Compose (Simpler Pattern)

**Three compose files with extends pattern:**

`compose.common.yml` (shared base):
```yaml
services:
  api:
    init: true
    platform: linux/amd64
    ports: [API_HTTP_PORT, API_WS_PORT]
    depends_on:
      postgres:
        condition: service_healthy
  postgres:
    image: pgvector/pgvector:pg16
    healthcheck: pg_isready
```

`compose.dev.yml` (development):
```yaml
services:
  api:
    extends: { file: compose.common.yml, service: api }
    build: { context: ., dockerfile: services/api/Dockerfile.dev }
    volumes: [live code mounts]
    command: npm run dev
  postgres:
    extends: { file: compose.common.yml, service: postgres }
  minio:
    image: minio/minio  # S3 substitute for local dev
```

`compose.prod.yml` (production):
```yaml
services:
  api:
    extends: { file: compose.common.yml, service: api }
    build: { context: ., dockerfile: services/api/Dockerfile.prod }
    command: npm run start  # no volumes, immutable
  postgres:
    extends: { file: compose.common.yml, service: postgres }
```

**Key differences from automated-repo:**
- Single set of compose files at repo root (not nested per service)
- Compose extends pattern for DRY config
- No service-level compose isolation
- MinIO for local S3 (swapped for real S3 in prod)
- Database runs alongside app on same server (not RDS)

### Makefile (Simple Commands)

```makefile
up            # docker compose -f compose.dev.yml up -d
up-build      # docker compose -f compose.dev.yml up -d --build
down          # docker compose -f compose.dev.yml down
down-volumes  # docker compose -f compose.dev.yml down -v
db:push       # drizzle-kit push
db:migrate    # drizzle-kit migrate
db:seed       # npm run db:seed
db:generate   # drizzle-kit generate
db:reset      # npm run db:reset
```

**Total: ~10 commands** vs ~100+ in automated-repo

### Environment Variables (Simpler)

```env
PROJECT_NAME=illumeiq
PROJECT_VERSION=0.0.1
API_HTTP_PORT=4000
API_WS_PORT=4111
POSTGRES_HOST=postgres
POSTGRES_DB=illume
POSTGRES_USER=illume
POSTGRES_PASSWORD=illume123
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
OPENAI_API_KEY=abcd
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

**No infrastructure outputs, no AWS credentials in .env, no Terraform variables**

### No CI/CD Pipelines

- .github/ is gitignored (no GitHub Actions)
- Deployments triggered by git push to Dokploy-connected repo
- No automated testing in pipeline
- Simple and manual but effective for small teams

### Database (Same Approach, Simpler Tooling)

- PostgreSQL 16 + pgvector (same as automated-repo)
- Drizzle ORM instead of TypeORM
- Migrations auto-run on container start via start scripts
- Database runs as Docker container alongside app (not managed RDS)
- Seeding built into start scripts

---

## COMPARISON: Side by Side

| Aspect | automated-repo | illume-main |
|--------|---------------|-------------|
| **Infrastructure IaC** | ~500+ lines Terraform (VPC, ECS, ECR, ALB, RDS, Route53, Secrets, NAT, Bastion) | ~100 lines Terraform (EC2 + security group) |
| **Cloud Services Used** | ECS Fargate, ECR, ALB, RDS, ACM, Route53, CloudWatch, Secrets Manager, NAT Gateway | EC2 + Dokploy |
| **Deployment Method** | Manual: build -> push ECR -> update ECS service | Git push -> Dokploy auto-deploys |
| **SSL/TLS** | ACM certificates + ALB | Let's Encrypt via Traefik (automatic) |
| **Reverse Proxy** | ALB (managed) | Traefik (built into Dokploy) |
| **Database (prod)** | RDS PostgreSQL (managed) | PostgreSQL container on same server |
| **Docker Compose Files** | Nested per service (5+ files) | 3 files at root (common/dev/prod) |
| **Task Automation** | ~100+ Taskfile tasks | ~10 Makefile targets |
| **CI/CD** | None (manual tasks) | None (Dokploy auto-deploy on push) |
| **Env Vars** | ~50+ vars including INFRA_* outputs | ~15 vars, simple |
| **Cost (estimated)** | Higher (NAT Gateway ~$30/mo, ALB ~$15/mo, RDS, Fargate) | Lower (single EC2 t3.medium ~$30/mo total) |
| **Scaling** | Horizontal via ECS (add replicas) | Vertical (upgrade EC2) or manual |
| **Dev Environment** | direnv + Nix + Docker Compose | Docker Compose + Makefile |
| **Auth** | Keycloak (full IdP) | @eaccess/auth (library-level) |
| **Monitoring** | CloudWatch | Server-level + Dokploy UI |

---

## ANALYSIS: What Changes for Migration

### What's Overkill in automated-repo

1. **Full AWS infrastructure via Terraform** - VPC, subnets, NAT Gateway, ALB, ECS Fargate, ECR, Service Discovery, Bastion host, CloudWatch. This is production-grade multi-AZ architecture for what could be a single-server deployment.

2. **Nested docker-compose per service** - Each service has its own docker-compose.yml designed for independent operation. Acknowledged as unnecessary since services won't be plucked.

3. **~100+ Taskfile tasks** - Many exist solely to wrap AWS CLI commands for the ECS deployment pipeline (build, push ECR, update service, get logs, empty ECR). With Dokploy, the entire deploy pipeline is just `git push`.

4. **Manual deployment pipeline** - Building Docker images locally, pushing to ECR, updating ECS services one at a time. This is what CI/CD or Dokploy solves automatically.

5. **Environment variable complexity** - ~50+ env vars, half of which are Terraform output syncs (INFRA_*) needed for the ECS deployment pipeline.

6. **Two AWS accounts** - One for infrastructure, one for Route53 DNS. Dokploy handles DNS/SSL itself via Traefik.

### What's Well-Done in automated-repo (Keep These)

1. **Service separation** - Clean project boundaries (backend, frontend, keycloak, database)
2. **Multi-stage Dockerfiles** - Efficient production images
3. **Health checks** - Proper service dependency ordering
4. **Environment variable validation** - No-defaults policy is good practice
5. **Shared code** - projects/shared for cross-service TypeScript
6. **E2E testing setup** - Playwright integration
7. **Dev tooling** - direnv + Nix for consistent dev environments
8. **Database migrations** - TypeORM migration workflow

### What to Adopt from illume-main

1. **Dokploy for deployments** - Single EC2, git-push-to-deploy, auto SSL
2. **Flat compose structure** - compose.common.yml + compose.dev.yml + compose.prod.yml at repo root
3. **Compose extends pattern** - DRY config without nested files
4. **Makefile simplicity** - 10 clear commands instead of 100+ tasks
5. **Start scripts** - migrations/seeding run automatically on container start
6. **Minimal Terraform** - Just the server + Dokploy, not the entire AWS stack

### What to Do Differently (automated-repo has things illume-main doesn't)

1. **Keycloak** - illume-main uses a library for auth. Automated-repo runs a full Keycloak server. Dokploy runs it as another container. Bonus: Keycloak + Traefik ForwardAuth secures the entire platform (pgweb, admin tools, etc.) with one auth system.
2. **Multiple services** - illume-main is effectively a single API + frontend. Automated-repo has backend + frontend + keycloak + coding agents. Dokploy handles multiple containers fine.
3. **pgweb** - On-demand in any environment, secured behind Keycloak via Traefik ForwardAuth + oauth2-proxy. Default in dev, opt-in elsewhere.
4. **Coding agent services** - Stay local-only, tmux-based. Not containerized or deployed.
5. **Database in production** - Container on Dokploy EC2 (same as illume), with production hardening (see Decision #3). Encrypted EBS, automated backups, WAL archiving.
6. **Object storage** - MinIO as self-hosted S3-compatible storage in production (illume uses real AWS S3 in prod). Keeps everything self-contained on the Dokploy server.
7. **Backup strategy** - Full 3-layer backup: Dokploy pg_dump → MinIO, EBS snapshots, optional external S3. Illume-main has no backup strategy at all.
8. **Ad-hoc environments** - Terraform-based ephemeral environments for feature branch demos. Illume-main doesn't have this.

---

## MIGRATION PLAN (Draft)

### Phase 1: Flatten Docker Compose

**Current:** 5+ nested docker-compose.yml files
**Target:** 3 files at repo root

```
compose.common.yml   - Shared service definitions, health checks, platform
compose.dev.yml      - Dev builds, volumes for hot reload, pgweb, dev ports
compose.prod.yml     - Production builds, no volumes, production CMD
```

This is straightforward since the repo structure is already well-organized. The service Dockerfiles stay where they are, just referenced from the root compose files.

### Phase 2: Simplify Taskfiles

**Remove:** All `*:dev:build`, `*:dev:push`, `*:dev:update-service`, `*:dev:deploy`, `*:dev:empty-ecr`, `*:dev:logs`, `*:dev:get-url` tasks (the entire ECS deployment pipeline).

**Remove:** All terraform tasks (replaced by simple `tofu apply` in infrastructure/).

**Keep:** Local development tasks (start, stop, logs, shell, tests, migrations, lint, format).

**Consider:** Converting remaining tasks to a Makefile for consistency with the simpler pattern.

**Estimated reduction:** ~100+ tasks -> ~30-40 tasks (or ~15-20 Makefile targets)

### Phase 3: Replace Terraform Infrastructure

**Remove:** `terraform/aws/environments/dev/` (VPC, ECS, ECR, ALB, RDS, etc.)
**Remove:** `terraform/aws/remote-state/` (S3 + DynamoDB for state)

**Replace with:** Minimal Terraform similar to illume-main
```
infrastructure/
├── main.tf              (EC2 + Dokploy)
├── variables.tf
├── outputs.tf
└── dokploy-install.sh   (user data script)
```

**Resources created:**
- EC2 instance (t3.medium or larger depending on services)
- EBS volume (encrypted, sized for postgres data)
- Elastic IP
- Security group (22, 80, 443, 3000 for Dokploy UI)

### Phase 4: Set Up Dokploy

1. Run `tofu apply` to create EC2 with Dokploy
2. Access Dokploy UI
3. Connect git repository
4. Configure compose.prod.yml as the deployment file
5. Set environment variables in Dokploy UI
6. Configure domain + automatic SSL
7. Test git-push-to-deploy workflow

### Phase 5: Simplify Environment Variables

**Remove:** All `INFRA_*` variables (no more ECS/ECR/CloudWatch)
**Remove:** AWS credentials for deployment (Dokploy handles deploy)
**Remove:** Route53 credentials (Traefik handles DNS/SSL)
**Remove:** `TF_VAR_*` variables (minimal Terraform needs fewer vars)
**Keep:** Application config (ports, DB, Keycloak, API keys, CORS)

**Estimated reduction:** ~50+ vars -> ~20-25 vars

### Phase 6: Cleanup

- Remove `sync-tf-outputs-to-env.sh` script
- Remove ECR-related Dockerfile patterns (no more ECR)
- Update README with new deployment flow
- Remove AWS CLI dependencies from dev workflow
- Simplify `.env.template`

---

## OPEN QUESTIONS (Original - All Resolved)

> All 8 original questions have been resolved. See "DECISIONS" section above for full details.
>
> 1. ~~Database strategy in prod~~ → Container on Dokploy EC2 + production hardening (Decision #3)
> 2. ~~Keycloak in Dokploy~~ → Start at 4GB, monitor, scale up (Decision #4)
> 3. ~~Multiple environments~~ → Separate EC2s + ad-hoc environments (Decision #5)
> 4. ~~Backups~~ → Dokploy built-in + MinIO + EBS snapshots (Decision #7)
> 5. ~~Monitoring/Logging~~ → Dokploy built-in + CloudWatch Agent + alerts (Decision #4)
> 6. ~~Coding agent services~~ → Stay local only (Decision #2)
> 7. ~~CI/CD~~ → Dokploy git integration, no GitHub Actions for deploy (Decision #8)
> 8. ~~Domain/DNS~~ → Still need Route53 for A records, but much simpler (Decision #9)

---

## RAW NOTES

### Dokploy Key Features (from research)
- Docker Compose native support
- Auto-builds from git repos
- Traefik reverse proxy (automatic)
- Let's Encrypt SSL (automatic)
- Environment variable management in UI
- Multiple projects per server
- Database backups (built-in)
- Monitoring dashboard
- Webhook support for CI/CD
- Open source, self-hosted

### automated-repo Service Resource Requirements
- Backend (NestJS): ~256-512MB RAM
- Frontend (React/Nginx): ~128-256MB RAM
- Keycloak: ~512MB-1GB RAM
- PostgreSQL: ~256-512MB RAM
- pgweb: ~64MB RAM (on-demand, any env, behind Keycloak auth)

**Minimum for all services:** ~1.5-2.5GB RAM -> t3.medium (4GB) is probably fine, t3.large (8GB) gives headroom

### Dokploy vs ECS Cost Comparison (rough)
| Resource | ECS Setup | Dokploy Setup |
|----------|-----------|---------------|
| Compute | Fargate (pay per vCPU/RAM) ~$30-50/mo | EC2 t3.medium ~$30/mo |
| Load Balancer | ALB ~$16/mo + data | Included (Traefik) |
| NAT Gateway | ~$32/mo + data | Not needed |
| Database | RDS db.t4g.micro ~$13/mo | Container (free, on EC2) |
| Container Registry | ECR ~$1-5/mo | Not needed (local builds) |
| DNS | Route53 ~$0.50/mo | Domain registrar (existing) |
| SSL | ACM (free) | Let's Encrypt (free) |
| Secrets | Secrets Manager ~$1-2/mo | Dokploy UI (free) |
| **Total** | **~$95-120/mo** | **~$30/mo** |

### illume-main Startup Script Pattern (worth adopting)

```bash
# start-dev.sh
#!/bin/bash
npm install          # Ensure deps
npm run db:migrate   # Run pending migrations
npm run db:seed      # Seed data (idempotent)
npm run dev          # Start with hot reload

# start-prod.sh
#!/bin/bash
npm install --production
npm run db:migrate   # Always run migrations on deploy
npm run start        # Start production server
```

This eliminates the need for separate migration tasks - migrations always run on startup, ensuring the DB schema is always current after a deploy.

---

## DECISIONS (Resolved Open Questions)

### 1. pgweb: On-Demand in Any Environment, Secured via Keycloak

**Decision:** pgweb stays as a dev-only default in compose.dev.yml, but can be spun up on-demand in any environment (including production) for debugging. It will be secured behind Keycloak authentication using the Traefik ForwardAuth + oauth2-proxy pattern.

**How it works:**

Since Dokploy uses Traefik as its reverse proxy, we can leverage Traefik's ForwardAuth middleware to put Keycloak SSO in front of pgweb (or any service that doesn't have its own auth). The architecture:

```
User Request → Traefik → ForwardAuth Middleware → oauth2-proxy → Keycloak
                                                       ↓
                                              (authenticated?)
                                               yes ↓    no → Keycloak login page
                                              pgweb service
```

**Components:**
1. **oauth2-proxy** - Sits between Traefik and pgweb, validates authentication
2. **Traefik ForwardAuth** - Middleware that intercepts requests and delegates auth to oauth2-proxy
3. **Keycloak** - The identity provider (already in our stack)

**Traefik labels for pgweb (in compose):**
```yaml
pgweb:
  image: sosedoff/pgweb:latest
  labels:
    - traefik.enable=true
    - traefik.http.routers.pgweb.rule=Host(`db.${DOMAIN}`)
    - traefik.http.routers.pgweb.entryPoints=https
    - traefik.http.routers.pgweb.middlewares=sso@file
    - traefik.http.routers.pgweb.tls=true
    - traefik.http.routers.pgweb.tls.certresolver=letsencrypt
```

**Safety measures:**
- pgweb is NOT in compose.prod.yml by default - must be explicitly enabled
- When enabled, it's behind Keycloak auth (same users/roles as the app)
- Can restrict to specific Keycloak roles (e.g., `admin` role only)
- Traefik ForwardAuth means pgweb itself doesn't need to know about auth at all
- Can be torn down immediately after debugging

**On-demand activation approach:**
- Create a `compose.debug.yml` overlay that adds pgweb + the ForwardAuth config
- Enable with: `docker compose -f compose.prod.yml -f compose.debug.yml up -d pgweb`
- Or manage via Dokploy UI (add service temporarily)

**Broader vision:** This same ForwardAuth pattern secures the entire platform with one Keycloak auth system. Any internal tool (pgweb, monitoring dashboards, admin panels) can be protected by adding Traefik labels pointing to the SSO middleware. One auth system to rule them all.

**Reference implementations:**
- [traefik-keycloak-sso-reverse-proxy](https://github.com/BlackBeltTechnology/traefik-keycloak-sso-reverse-proxy) - Complete working example
- [Traefik + OAuth2 Proxy + Keycloak guide](https://medium.com/@nsalexamy/securing-web-applications-with-sso-using-traefik-oauth2-proxy-and-keycloak-a-jaeger-example-7eb2ed31109a)

---

### 2. Coding Agent Services: Local Only, Not in Docker

**Decision:** Coding agent services (backend + frontend) stay local-only, run directly on the host machine. They will not be containerized or deployed to Dokploy.

No changes needed - they stay in `projects/` with their tmux-based workflow.

---

### 3. Database in Production: Dokploy Container Approach + Production Hardening

**Decision:** Run PostgreSQL as a Docker container on the Dokploy EC2 instance (same as illume-main), with production hardening.

**How illume-main does it:**
- PostgreSQL 16 + pgvector runs as a container in compose.prod.yml
- Data stored in a Docker named volume (`postgres_data`)
- The volume sits on the 50GB encrypted EBS gp3 volume attached to the EC2 instance
- No RDS, no managed service - it's just a container with persistent storage

**Production Hardening Checklist:**

**Storage & Durability:**
- [ ] EBS volume: encrypted gp3, sized appropriately (start 50GB, auto-expand)
- [ ] EBS snapshots: automated daily via AWS Backup or cron + aws cli
- [ ] Docker named volumes (not bind mounts) for Dokploy backup compatibility
- [ ] Separate EBS volume for DB data (not the root volume) - survives instance replacement

**PostgreSQL Configuration:**
- [ ] Strong passwords (not `postgres`/`postgres` like local dev)
- [ ] Connection pooling (PgBouncer or built-in) for connection management
- [ ] `max_connections` tuned for container memory
- [ ] `shared_buffers` set to ~25% of available memory
- [ ] `work_mem` and `maintenance_work_mem` tuned
- [ ] `wal_level = replica` (enables point-in-time recovery)
- [ ] WAL archiving enabled (ship WAL files to S3/MinIO for PITR)
- [ ] `log_min_duration_statement` for slow query logging
- [ ] SSL enabled for connections (even within Docker network for defense in depth)

**Access Control:**
- [ ] pg_hba.conf: restrict connections to app containers only
- [ ] Separate DB users per service (backend user, keycloak user) with minimal privileges
- [ ] No superuser access from application code
- [ ] Database port NOT exposed to host (only accessible via Docker network)

**Health & Monitoring:**
- [ ] Health checks in compose (pg_isready)
- [ ] Connection count monitoring
- [ ] Disk usage alerts (EBS volume)
- [ ] Replication lag monitoring (if we add a read replica later)

**Recovery:**
- [ ] Tested backup restore procedure (documented and verified)
- [ ] Point-in-time recovery capability via WAL archiving
- [ ] Automated failover plan (even if manual for now, documented)

---

### 4. Instance Sizing: Start at 4GB, Monitor, Scale Up

**Decision:** Start with t3.medium (4GB RAM, 2 vCPU) and monitor metrics to find the right size.

**Monitoring approach:**
- **Dokploy built-in:** CPU, memory, disk usage per container visible in Dokploy UI
- **CloudWatch Agent:** Install on EC2 for system-level metrics (memory, disk, swap) - this is free tier eligible and doesn't require the full CloudWatch setup we're removing
- **Container-level:** `docker stats` available via SSH for quick checks
- **Alerts:** Dokploy supports notification providers (Slack, Discord, Email, Webhook) - set up alerts for:
  - Memory usage > 80%
  - Disk usage > 70%
  - Container restart events
  - Deployment failures

**Scaling path (updated - observability stack needs ~1.5-3GB on top of app):**
1. t3.medium (4GB) - dev only, app + minimal monitoring (~$30/mo)
2. t3.large (8GB) - staging/prod with full observability (~$60/mo) **← likely starting point for prod**
3. t3.xlarge (16GB) - if load demands it (~$120/mo)

**Instance resize process:** Stop instance -> change type -> start instance. Brief downtime (~2-5 min). Can also use a new instance + DNS switch for zero-downtime resize.

**NOTE:** Add a task/reminder to build a **performance testing suite** (see section below) to systematically find the optimal instance size at lowest cost.

---

### 5. Two Environments: Local + Prod (Ad-Hoc for Everything Else)

**Decision:** Only two permanent environments exist: **local** (Docker on laptop) and **prod** (Dokploy on AWS EC2). These projects are simple enough to develop locally and deploy directly to prod. Any additional environments (staging, demo, feature branch testing) are spun up ad-hoc and torn down when no longer needed.

**Permanent environments:**
```
local   → Docker Compose on developer laptop → localhost
prod    → EC2 (t3.large) + Dokploy           → app.rtsdev.co
```

**Everything else is ad-hoc** (spun up on demand, torn down when done).

**Ad-Hoc Feature Environments (the exciting part):**

Goal: Run a single command, get a deployed feature branch with a URL to share with clients.

**How it would work:**

```bash
# Developer runs:
task env:create --branch feature/cool-thing

# Behind the scenes:
# 1. Terraform creates a new EC2 + Dokploy (from a pre-baked AMI for speed)
# 2. Dokploy is configured to deploy the specified branch
# 3. DNS record created: feature-cool-thing.rtsdev.co
# 4. SSL auto-provisioned by Traefik/Let's Encrypt
# 5. Database seeded with test data
# 6. URL printed: https://feature-cool-thing.rtsdev.co
# 7. Developer sends URL to client

# When done:
task env:destroy --branch feature/cool-thing
# EC2 terminated, DNS record removed, costs stop immediately
```

**Implementation approach:**

1. **Pre-baked AMI:** Create an AMI with Dokploy already installed. This cuts provisioning time from ~10 min (fresh Ubuntu + install) to ~3 min (just boot + configure).

2. **Terraform workspace per environment:**
   ```bash
   terraform workspace new feature-cool-thing
   terraform apply -var="branch=feature/cool-thing" -var="subdomain=feature-cool-thing"
   ```

3. **DNS:** Wildcard DNS record `*.rtsdev.co` pointing to... (see DNS section). For ad-hoc envs, each gets its own A record pointing to its Elastic IP.

4. **Auto-cleanup:** Optional TTL on ad-hoc environments. After N days, auto-destroy if not renewed. Prevents forgotten instances running up costs.

5. **Cost control:** Ad-hoc envs use t3.small ($15/mo) or even t3.micro ($8/mo) since they're temporary and low-traffic.

**Estimated cost per ad-hoc env:** ~$0.50-1.00/day (t3.small + EBS). Show client for 3 days = ~$3.

---

### 6. Performance Testing Suite

**Decision:** Build a dedicated performance testing suite/environment to find the highest performant setup at lowest cost.

**TODO - Add to backlog:**

- Build a performance test suite using k6 or Artillery (both work well for HTTP + WebSocket)
- Test scenarios:
  - API throughput (requests/sec at various concurrencies)
  - WebSocket connection limits
  - Database query performance under load
  - Keycloak auth token throughput
  - File upload / processing pipelines
  - Memory pressure testing (find the ceiling)
- Run against each instance size to find the sweet spot
- Automate as a task: `task perf:test --target staging`
- Store results for comparison over time
- Include in CI/CD: run perf tests after deploy to staging, alert on regression

**Environment for perf testing:**
- Dedicated ad-hoc environment (use the ad-hoc env feature above)
- Spin up, run tests, capture metrics, tear down
- Compare results across instance types to find optimal cost/performance ratio

---

### 7. Backup & Recovery: Full Setup with Dokploy + MinIO as S3-Compatible Storage

**Decision:** Full backup and recovery using Dokploy's built-in backup features, with MinIO as the storage provider.

**How illume-main handles storage (research findings):**
- **Local dev:** MinIO container in compose.dev.yml, stores files in Docker volume (`minio_data`)
- **Production:** Real AWS S3 (no MinIO in compose.prod.yml)
- **Code:** The S3 client (`@aws-sdk/client-s3`) connects to either MinIO or AWS S3 based on the `S3_ENDPOINT` env var. When `S3_ENDPOINT` is set (e.g., `http://minio:9000`), it talks to MinIO. When omitted, it defaults to real AWS S3.
- **No backup scripts exist** in illume-main - it's a gap there too.

**Our approach (improving on illume-main):**

**For file/object storage (uploaded files, documents, etc.):**
- Local dev: MinIO container (same as illume)
- Production: MinIO container on Dokploy (self-hosted S3-compatible)
  - MinIO runs as a Docker container alongside the app
  - Data stored in a Docker named volume on the encrypted EBS
  - This avoids AWS S3 costs and keeps everything self-contained
  - If we outgrow MinIO, we can switch to real S3 by changing `S3_ENDPOINT`

**For database backups:**

Dokploy has built-in backup features:

1. **Database Backups (built-in):**
   - Dokploy can automatically back up PostgreSQL using `pg_dump`
   - Backups uploaded to S3-compatible destinations (including our MinIO!)
   - Scheduled via Dokploy UI (e.g., daily at 3am)
   - Restore via Dokploy UI: select backup file, target database, click restore
   - Commands used: `pg_dump -Fc --no-acl --no-owner` (custom format, compressed)

2. **Volume Backups (built-in):**
   - Dokploy can backup Docker named volumes to S3 destinations
   - Works with any named volume (postgres_data, minio_data, etc.)
   - Scheduled or on-demand

3. **Backup Destinations:**
   - Dokploy supports: AWS S3, Azure Blob, Google Cloud Storage, and S3-compatible (MinIO, DigitalOcean Spaces, Backblaze B2, etc.)
   - Configure MinIO as a backup destination in Dokploy UI
   - Or use a separate S3 bucket for off-site backup redundancy

**Recommended backup strategy:**
```
┌─────────────────────────────────────────────┐
│ Dokploy EC2 Instance                         │
│                                              │
│  PostgreSQL ──pg_dump──→ MinIO (on-server)   │
│  (daily at 3am)         (immediate storage)  │
│                              │               │
│                              ▼               │
│                         EBS Volume           │
│                         (encrypted)          │
└──────────────────────────┬───────────────────┘
                           │
                    EBS Snapshots (daily)
                           │
                           ▼
                    AWS (off-instance,
                     survives EC2 failure)

Optional: Cross-region replication for disaster recovery
```

**Backup layers:**
1. **Layer 1 - Dokploy pg_dump to MinIO** (on-server, fast restore, daily)
2. **Layer 2 - EBS Snapshots** (instance-level, survives disk failure, daily)
3. **Layer 3 - Optional: pg_dump to external S3 bucket** (off-site, survives AWS region failure)

**Recovery scenarios:**
| Scenario | Recovery Method | RTO |
|----------|----------------|-----|
| Accidental data deletion | Restore from Dokploy backup (MinIO) | ~5 min |
| Container crash | Docker auto-restart + named volumes | ~30 sec |
| EBS volume failure | Restore from EBS snapshot | ~15 min |
| EC2 instance failure | New EC2 + attach EBS snapshot + restore | ~30 min |
| Full AZ failure | New EC2 in different AZ + restore from snapshot | ~45 min |

---

### 8. CI/CD: Dokploy Git Integration (No GitHub Actions Needed)

**Decision:** Use Dokploy's built-in git integration for automatic deployments. No GitHub Actions needed for deploy (may add later for tests only).

**How Dokploy Git Integration Works:**

1. **Connect repo:** In Dokploy UI, add your GitHub/GitLab/Bitbucket repository
2. **Configure branch:** Tell Dokploy which branch to track (e.g., `main` for prod, `develop` for staging)
3. **Webhook auto-setup:** Dokploy creates a webhook in your repo automatically
4. **Push-to-deploy:** When you push to the tracked branch:
   - GitHub sends webhook to Dokploy
   - Dokploy pulls latest code
   - Reads compose.prod.yml
   - Builds new images
   - Deploys containers (rolling update)
   - Runs health checks
   - Notifies via Slack/Discord/Email on success/failure

**Branch tracking (two-environment model):**
```
prod EC2/Dokploy    → tracks `main` branch
ad-hoc envs         → tracks whatever branch they were created for
```

**Deployment flow:**
```
Developer pushes to main
    → GitHub webhook fires
    → Dokploy pulls code
    → docker compose build
    → docker compose up (rolling)
    → start-prod.sh runs migrations automatically
    → Health checks pass
    → Slack notification: "Deploy successful"
```

**Future consideration:** Add GitHub Actions for running tests on PR (not for deployment). Tests pass → merge to main → Dokploy auto-deploys. This gives us test-before-deploy without Dokploy needing to know about tests.

---

### 9. Domain/DNS: Still Need Route53, But Simpler

**Decision:** You still need DNS management (Route53 or domain registrar), but the setup is much simpler. You can likely eliminate the second AWS account.

**What Traefik/Dokploy handles:**
- SSL certificate provisioning (Let's Encrypt, automatic)
- SSL certificate renewal (automatic)
- Reverse proxy routing (subdomain -> container)
- HTTP -> HTTPS redirect

**What Traefik/Dokploy does NOT handle:**
- DNS resolution (pointing `rtsdev.co` to your server's IP)
- You still need DNS A records pointing your domain/subdomains to the EC2 Elastic IP

**Simplified DNS setup:**
```
# In Route53 (or any DNS provider):
*.rtsdev.co    → A record → <Dokploy EC2 Elastic IP>

# That's it. One wildcard record covers everything:
# app.rtsdev.co, api.rtsdev.co, auth.rtsdev.co, db.rtsdev.co, etc.
# Traefik routes based on Host header to the right container.
```

**Can you eliminate the second AWS account?**
- The second account was used because Route53 DNS management was separated from infrastructure for permission isolation
- With Dokploy, you could:
  - **Option A:** Keep Route53 in the main account (add the A record there)
  - **Option B:** Move DNS to the domain registrar itself (no AWS needed for DNS at all)
  - **Option C:** Keep the second account if you want the separation (it's $0.50/mo)
- The key simplification: You no longer need Route53 Terraform modules, ACM certificate resources, or ALB DNS integration. Just one wildcard A record.

**For ad-hoc environments:**
- Each ad-hoc env gets its own Elastic IP
- Add an A record: `feature-cool-thing.rtsdev.co → <ad-hoc Elastic IP>`
- This can be automated in the Terraform that creates the ad-hoc env
- Alternatively, use a service like nip.io or traefik.me for zero-DNS ad-hoc URLs (e.g., `app-52-20-77-153.traefik.me`)

---

## UPDATED OPEN QUESTIONS (All Resolved)

> All 6 follow-up questions resolved:

1. ~~oauth2-proxy vs traefik-forward-auth~~ → **oauth2-proxy**. Industry standard, actively maintained, battle-tested role-based filtering (e.g., restrict pgweb to `admin` role). ~50MB RAM. thomseddon/traefik-forward-auth has maintenance concerns.

2. ~~MinIO sizing in production~~ → **Start with 20-30GB** within the existing 50GB EBS volume. Primary use: user document uploads + database backups + WAL archives. EBS gp3 volumes can be resized live (no downtime) if a client needs more. Scale up as needed per client.

3. ~~Ad-hoc environment automation priority~~ → **Low priority, but fully detailed and ready to implement.** Build after the core migration (flatten compose, replace Terraform, set up Dokploy prod). Keep the full implementation plan in the document so it's ready to pick up when needed.

4. ~~Performance testing tool choice~~ → **k6 (Grafana Labs)**. JavaScript scripting fits our JS/TS stack. Native Grafana integration — perf test results pipe directly into Prometheus/Grafana dashboards alongside the rest of our observability data. HTTP + WebSocket support. Same vendor as our observability stack.

5. ~~WAL archiving destination~~ → **Local MinIO + EBS snapshots (Option C)**. WAL files ship to MinIO on the same server for fast point-in-time recovery (common case: accidental data issues). EBS snapshots (already Layer 2 in backup strategy) provide off-instance durability for the disaster case. No separate S3 bucket needed — avoids extra complexity when EBS snapshots already cover instance/volume failure.

6. ~~Keycloak memory optimization~~ → **Production mode + JVM heap limits**. Run `start --optimized` in prod (not `start-dev`). Set `-Xms256m -Xmx512m` to cap memory at 512MB. Two config changes, keeps Keycloak under control. No need for lighter alternatives — Keycloak is the industry standard and already in the stack.

---

## DEEP DIVE: Preview Deployments for PR Review

### How It Works (Full Flow)

```
1. Developer opens PR against `main` branch
2. GitHub sends webhook to Dokploy
3. Dokploy pulls the PR branch code
4. Dokploy builds and deploys containers for that branch
5. Dokploy auto-comments on the PR with the preview URL
6. Reviewer clicks the URL → live running app with the PR changes
7. Developer pushes more commits → Dokploy auto-redeploys
8. PR merged or closed → Dokploy auto-tears down the preview
```

**The reviewer experience:** They open the PR on GitHub, see a comment like "Preview deployed to https://preview-myapp-abc123.traefik.me", click it, and test the actual running app. No setup, no local checkout, no docker commands. Just click and test.

### Configuration

**In Dokploy UI per application:**
- **Wildcard Domain:** Custom domain or use free `traefik.me` (HTTP-only for free domains)
- **Preview Path:** Base path for the preview
- **Port:** Default 3000 (configurable)
- **Preview Limit:** Max concurrent previews per app (default: 3, configurable)
- **Label Filtering:** Optional - only deploy previews for PRs with specific GitHub labels (e.g., `needs-preview`)

### URL Formats

**Option 1 - traefik.me (zero config, free, HTTP only):**
```
http://preview-${appName}-${uniqueId}.traefik.me
```

**Option 2 - Custom wildcard domain (requires DNS setup, HTTPS):**
```
https://pr-123.preview.rtsdev.co
```
Requires: `*.preview.rtsdev.co` wildcard DNS record + wildcard SSL cert via DNS challenge

### Environment Variables in Previews

- Previews inherit the app's environment variables
- `DOKPLOY_DEPLOY_URL` is auto-injected with the preview's URL
- Can use it for dynamic config: `APP_URL=https://${{DOKPLOY_DEPLOY_URL}}`
- Variables can reference other variables: `DATABASE_URL=postgresql://${{DB_USER}}:${{DB_PASS}}@host/db`

### Database Handling for Previews

**Important consideration:** Preview deployments need a database strategy.

**Options:**
1. **Shared database** - All previews connect to the same dev/staging DB. Simple but previews can interfere with each other.
2. **Per-preview database** - Each preview gets its own DB. Isolated but requires automation.
3. **Ephemeral database** - Preview compose includes its own postgres container. Fully isolated, starts fresh, migrations run on startup. **This is the recommended approach for our stack** since our start scripts auto-run migrations.

For our stack with the start-script pattern (migrations + seeding on startup), option 3 is natural: each preview boots its own postgres, runs migrations, seeds data, and is fully isolated.

### Docker Compose Projects & Previews

Preview deployments work best for single-application deploys. For Docker Compose projects (like ours with backend + frontend + keycloak + postgres), the approach is:
- Dokploy treats the compose project as a unit
- Each preview deploys the full compose stack
- Resource usage per preview: full stack (~1.5-2.5GB RAM)
- This limits concurrent previews on a single instance (2-3 max on t3.large)

**Alternative for lighter previews:** Deploy only the backend + frontend as preview (Keycloak shared from staging). Reduces per-preview RAM to ~500MB-1GB.

### Security Notes

- **Critical:** A vulnerability (CVE-2025-53825, patched in v0.24.3) allowed arbitrary code execution via PRs on public repos. **Ensure Dokploy is >= v0.24.3.**
- For private repos, this is not a concern.
- Label filtering can restrict which PRs trigger previews.
- Consider: enable previews only on the staging Dokploy instance, not production.

### GitHub Integration Details

- Dokploy uses a GitHub App for integration (not just webhooks)
- Webhook payloads are cryptographically verified via `@octokit/webhooks`
- Auto-deploy only fires for the configured branch
- **Watch Paths:** Can configure selective deploys based on changed files
- **Skip Keywords:** Standard GitHub skip keywords work (`[skip ci]`, `[no deploy]`)

---

## DEEP DIVE: Observability & Monitoring Stack

### Research Summary

Evaluated five observability approaches for running on a single Dokploy EC2 instance:

| Stack | Logs | Metrics | Traces | RAM Required | Fits t3.medium? | Fits t3.large? |
|-------|------|---------|--------|-------------|-----------------|----------------|
| **ELK (Elastic Stack 9.x)** | Excellent | Good | Good | 10-12GB | No | No |
| **PLG + Tempo** | Good | Excellent | Good | 1.5-3GB | Tight | Yes |
| **Full LGTM (with Mimir)** | Good | Excellent | Excellent | 2.5-5GB | No | Tight |
| **Beszel** | No | Basic | No | <100MB | Yes | Yes |
| **Uptime Kuma** | No | Uptime only | No | <100MB | Yes | Yes |

### Decision: PLG + Tempo Stack (Prometheus + Loki + Grafana + Tempo)

**The industry standard for cloud-native monitoring in 2025-2026.** Prometheus is a CNCF graduated project. Grafana is the dominant dashboard platform. Loki is the lightweight log aggregation standard. Together they provide logs, metrics, traces, and alerting in ~1.5-3GB RAM.

### Why NOT ELK

ELK has evolved into Elastic Stack 9.x but the core problem remains: **Elasticsearch alone needs 8GB+ RAM for production.** With Logstash and Kibana, the full stack requires 10-12GB minimum. On a t3.large (8GB) that leaves zero RAM for the actual application. ELK is designed for dedicated clusters or large servers, not for a single-instance deployment alongside application containers.

The license situation also hurt adoption - the SSPL/AGPL changes pushed many organizations toward Grafana's stack.

### Why PLG + Tempo

1. **Lightweight** - Loki's label-only indexing uses a fraction of ELK's resources
2. **Industry standard** - Prometheus + Grafana is the most widely adopted open-source monitoring stack
3. **Dokploy-compatible** - [dokploy-grafana-compose](https://github.com/quochuydev/dokploy-grafana-compose) exists for this exact setup
4. **Future-proof** - Built on OpenTelemetry standards
5. **Every service has native integration** (see below)
6. **Pre-built dashboards** for everything we run
7. **Unified alerting** to Slack/Discord

### Architecture

```
Application Containers
  │
  ├── NestJS (instrumented with nestjs-otel)
  │     └──→ Grafana Alloy ──→ Prometheus (metrics)
  │                          ──→ Loki (logs)
  │                          ──→ Tempo (traces)
  │
  ├── Keycloak (/metrics endpoint, native Prometheus support)
  │     └──→ Prometheus (scrapes directly)
  │
  ├── PostgreSQL
  │     └──→ postgres_exporter ──→ Prometheus
  │
  ├── All Docker Containers
  │     └──→ Alloy (loki.source.docker) ──→ Loki (auto-discovers all containers)
  │     └──→ cAdvisor ──→ Prometheus (container CPU/memory/network)
  │
  └── Host System
        └──→ node_exporter ──→ Prometheus (CPU, memory, disk, network)

Everything visualized in ──→ Grafana (dashboards + alerting → Slack/Discord)
```

### Components & Resource Usage

| Component | RAM | Purpose |
|-----------|-----|---------|
| **Grafana** | ~250MB | Dashboards, alerting, unified UI |
| **Prometheus** | ~300-500MB | Metrics collection & storage |
| **Loki** | ~500MB-1GB | Log aggregation (monolithic mode) |
| **Tempo** | ~200-300MB | Distributed trace storage |
| **Grafana Alloy** | ~200-400MB | Collection agent (replaces Promtail, is an OTel Collector) |
| **node_exporter** | ~20MB | Host system metrics |
| **postgres_exporter** | ~20MB | PostgreSQL metrics |
| **cAdvisor** | ~100MB | Docker container metrics |
| **Total** | **~1.5-3GB** | |

### What is Grafana Alloy?

Alloy is Grafana's unified telemetry collector. It replaces Promtail (which is EOL March 2026) and is actually a distribution of the **OpenTelemetry Collector**. So by using Alloy, we're building on OTel standards.

Key capability: `loki.source.docker` - Alloy connects to the Docker socket, auto-discovers all running containers, and tails their logs directly into Loki. No per-container log configuration needed. New containers are automatically picked up.

### NestJS Integration

The `nestjs-otel` package provides deep auto-instrumentation:
- HTTP request duration, error rates, active connections
- Custom metrics via `@Counter` and `@Observer` decorators
- Distributed tracing (see request flow across services)
- Prometheus metrics endpoint at `/metrics` (port 9464)
- Zero-config for basic instrumentation, decorators for custom metrics

### Keycloak Integration

Keycloak natively exposes Prometheus metrics:
- Enable with `metrics-enabled=true` in Keycloak config
- Metrics available at `https://keycloak-url/metrics`
- Covers: JVM stats, HTTP requests, authentication events, token issuance rates
- Pre-built Grafana dashboard: [keycloak-grafana-dashboard](https://github.com/keycloak/keycloak-grafana-dashboard)

### Pre-Built Grafana Dashboards

No need to build dashboards from scratch. Import these:

| Service | Dashboard | Grafana ID |
|---------|-----------|------------|
| **Host system** | Node Exporter Full | ID: 1860 (most popular dashboard on Grafana) |
| **PostgreSQL** | PostgreSQL Exporter Quickstart | ID: 14114 (includes alert rules) |
| **Docker containers** | cAdvisor + Prometheus | Multiple available |
| **Keycloak** | Official Keycloak dashboard | [GitHub repo](https://github.com/keycloak/keycloak-grafana-dashboard) |
| **NestJS** | Custom from nestjs-otel metrics | Build from OTel HTTP metrics |
| **Loki logs** | Built-in Explore view | N/A (native) |

All dashboards can be pre-provisioned via Grafana's file-based provisioning in Docker Compose volumes - they survive container restarts.

### Alerting

Grafana Alerting (unified since Grafana 9):
- Define alert rules based on Prometheus metrics or Loki log queries
- **Contact Points:** Slack, Discord, PagerDuty, Email, Webhooks, 20+ integrations
- **Notification Policies:** Routing, grouping, silencing
- **File-provisioned:** Alert rules stored as YAML in Docker volumes, fully reproducible

**Example alerts:**
- Container memory > 80% → Slack
- HTTP 5xx error rate > 5% for 5 min → Slack
- PostgreSQL connection count > 80% of max → Slack
- Disk usage > 70% → Slack
- Container restart count > 3 in 10 min → Slack
- Keycloak auth failure rate spike → Slack

### Supplementary Tools (Optional, Lightweight)

**Uptime Kuma** (~50MB RAM):
- Simple uptime monitoring + status page
- Checks: HTTP, TCP, DNS, Docker containers
- Native Slack/Discord alerts
- Beautiful status page you can share with clients
- Useful as a "is everything up?" quick check separate from Grafana

**Beszel** (~50MB RAM):
- Quick-glance server health dashboard
- CPU, memory, disk, network at a glance
- Docker container overview
- Useful as a secondary "server health" view

### Instance Sizing Impact

**Updated recommendation:** With observability stack, t3.large (8GB) becomes the minimum for production:

```
Application stack:     ~2.5-3.5GB (postgres + keycloak + backend + frontend)
Observability stack:   ~1.5-3GB (prometheus + loki + grafana + tempo + alloy + exporters)
OS + Docker overhead:  ~500MB-1GB
─────────────────────────────────────
Total:                 ~4.5-7.5GB → t3.large (8GB) is tight but workable
                                  → t3.xlarge (16GB) gives comfortable headroom
```

**Staging/dev instances can skip Tempo and cAdvisor** to save ~300-400MB.

**Cost update:**
| Instance | RAM | Monthly | Use For |
|----------|-----|---------|---------|
| t3.medium | 4GB | ~$30 | Dev (app only, minimal monitoring) |
| t3.large | 8GB | ~$60 | Staging + prod (app + full observability) |
| t3.xlarge | 16GB | ~$120 | Prod if load demands it |

### Docker Compose for Observability

The full observability stack would be a separate compose file: `compose.observability.yml`

```yaml
# compose.observability.yml
services:
  grafana:
    image: grafana/grafana:latest
    ports: ["3001:3000"]  # 3001 to avoid conflict with Dokploy UI on 3000
    volumes:
      - grafana_data:/var/lib/grafana
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      - ./observability/grafana/dashboards:/var/lib/grafana/dashboards

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - prometheus_data:/prometheus
      - ./observability/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml

  loki:
    image: grafana/loki:latest
    volumes:
      - loki_data:/loki
      - ./observability/loki/loki-config.yml:/etc/loki/local-config.yaml

  tempo:
    image: grafana/tempo:latest
    volumes:
      - tempo_data:/tmp/tempo
      - ./observability/tempo/tempo-config.yml:/etc/tempo.yaml

  alloy:
    image: grafana/alloy:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro  # Docker log collection
      - ./observability/alloy/config.alloy:/etc/alloy/config.alloy

  node-exporter:
    image: prom/node-exporter:latest
    pid: host
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    environment:
      DATA_SOURCE_NAME: "postgresql://..."

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro

  # Optional lightweight additions:
  uptime-kuma:
    image: louislam/uptime-kuma:latest
    volumes:
      - uptime_data:/app/data
    ports: ["3002:3001"]

volumes:
  grafana_data:
  prometheus_data:
  loki_data:
  tempo_data:
  uptime_data:
```

Deploy via Dokploy alongside the app, or as a separate Dokploy project on the same instance.

### References

- [dokploy-grafana-compose](https://github.com/quochuydev/dokploy-grafana-compose) - Dokploy-specific Grafana setup
- [Grafana Alloy Docker monitoring docs](https://grafana.com/docs/alloy/latest/monitor/monitor-docker-containers/)
- [nestjs-otel](https://github.com/pragmaticivan/nestjs-otel) - NestJS OpenTelemetry module
- [Keycloak Grafana Dashboard](https://github.com/keycloak/keycloak-grafana-dashboard)
- [PostgreSQL Exporter Dashboard (Grafana ID: 14114)](https://grafana.com/grafana/dashboards/14114-postgres-overview/)
- [Node Exporter Full Dashboard (Grafana ID: 1860)](https://grafana.com/grafana/dashboards/1860)
- [Dokploy Security & Monitoring Guide (CrowdSec + Traefik + Grafana)](https://catcat.blog/en/2025/12/dokploy-security-monitoring-guideen)
