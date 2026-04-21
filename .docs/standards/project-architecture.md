# Project Architecture

High-level organizational patterns for consistent project structure across technologies.

## Overview

This monorepo uses consistent project organization patterns that work across any technology stack. Each project maintains independence while sharing common structural and operational patterns.

### Key Principles

- **Project Independence**: Each project owns its functionality and configuration
- **Consistent Patterns**: Same structure across all technologies and project types
- **Kubernetes-First**: All projects deploy to K8s via Helm charts — Minikube locally, K3s in production
- **Task Automation**: Standardized build, test, and deployment workflows via Taskfile
- **Docs-Driven**: Every project and feature has `.docs/` specifications

### Project Types

| Type | Purpose | Examples | Deployment |
|------|---------|----------|------------|
| **Applications** | User-facing interfaces | Angular frontend, React frontend | Docker image → Helm → K8s |
| **Services** | Backend logic and APIs | NestJS backend, Mastra agents | Docker image → Helm → K8s |
| **Infrastructure** | Supporting services | PostgreSQL, Keycloak | Docker image → Helm → K8s |
| **E2E Tests** | End-to-end testing | Playwright test suites | Run locally or in CI |

## Directory Structure

```
projects/
├── application/                   # The benchmark app
│   ├── backend/                   # NestJS REST API
│   │   ├── .docs/                 # Project-level docs (overview, standards)
│   │   ├── app/                   # Source code
│   │   │   └── src/features/      # Feature-based code organization
│   │   ├── chart/                 # Helm chart for K8s deployment
│   │   ├── dockerfiles/           # Container definitions
│   │   └── Taskfile.yml           # Project automation
│   ├── frontend/                  # Angular frontend
│   │   ├── app/
│   │   │   ├── .docs/             # Project-level docs
│   │   │   └── src/app/features/  # Feature-based code organization
│   │   ├── chart/
│   │   ├── dockerfiles/
│   │   └── Taskfile.yml
│   ├── database/                  # PostgreSQL setup + migrations
│   │   ├── .docs/
│   │   ├── chart/
│   │   └── dockerfiles/
│   ├── keycloak/                  # Auth server configuration
│   │   ├── .docs/
│   │   ├── app/                   # Realm config + startup scripts
│   │   ├── chart/
│   │   └── dockerfiles/
│   └── e2e/                       # Playwright E2E tests
│       ├── .docs/
│       └── app/
│           ├── fixtures/          # Test data
│           └── tests/             # Test suites (each with .docs/)
│
└── the-dev-team/                  # The agent orchestration system
    ├── backend/                   # NestJS + Mastra agents
    │   ├── app/src/features/
    │   ├── chart/
    │   ├── dockerfiles/
    │   └── Taskfile.yml
    └── frontend/                  # React docs page + agent bubbles
        ├── app/src/features/
        ├── chart/
        ├── dockerfiles/
        └── Taskfile.yml
```

### Standard Project Layout

Every project follows the same structure:

```
project-name/
├── .docs/                         # Documentation (overview, standards, feature specs)
├── app/                           # Application source code
│   └── src/
│       └── features/              # Feature-based code organization
├── chart/                         # Helm chart (Chart.yaml, values.yaml, templates/)
├── dockerfiles/                   # Container definitions (prod.Dockerfile, etc.)
└── Taskfile.yml                   # Project-specific automation
```

## Deployment Model

All projects deploy to Kubernetes via Helm charts orchestrated by Helmfile:

```
Source code → Docker image → In-cluster registry → Helm chart → K8s deployment
```

- **Local**: Minikube cluster, images built with `eval $(minikube docker-env)`
- **Production**: K3s cluster, images pushed via CI/CD
- **Sandboxes**: Per-feature namespaces (`env-{feature}`) with the full app stack

The root `Taskfile.yml` includes all project Taskfiles and provides orchestration:
- `task up` — start Minikube, build all images, deploy everything
- `task build:all` — build and push all Docker images
- `task deploy:apply` — deploy all services via Helmfile

## Key Management Principles

### 1. Consistent Project Structure
- **Standard Layout**: All projects follow `app/` + `chart/` + `dockerfiles/` + `Taskfile.yml`
- **Feature Architecture**: All source code lives in `features/` — see [Feature Architecture](feature-architecture.md)
- **Helm Charts**: Every deployable project has its own chart
- **Environment Parity**: Same Helm charts deploy to Minikube and K3s

### 2. Configuration
- **Single `.env`**: One env file at repo root — see [Environment Configuration](environment-configuration.md)
- **Helm Values**: Non-sensitive config lives in chart values, environment-specific overrides in Helmfile
- **No defaults**: All required env vars must be explicit — fail fast on missing config

### 3. Project Communication
- **Traefik Ingress**: Services communicate via hostname-based routing
- **API Contracts**: Cross-boundary interfaces documented in `.docs/contracts.md`
- **Health Endpoints**: Every service exposes `/health` for liveness checks

### 4. Code Organization
All projects follow the [Feature Architecture](feature-architecture.md) pattern. All code lives inside `features/`. Features can be full-stack (with pages/endpoints) or shared utilities (components/services/clients).
