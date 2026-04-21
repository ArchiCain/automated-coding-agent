# Automated Coding Agent — Overview

## What This Is

A monorepo containing an autonomous software development system and the application it builds. Agents read `.docs/` specifications and sync code to match, deploy to sandbox environments, run tests, create PRs, and iterate — with humans guiding the specs.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `projects/application/` | The benchmark application — Angular frontend, NestJS backend, Keycloak auth, PostgreSQL, Playwright E2E tests |
| `projects/the-dev-team/` | The agent orchestration system — Mastra agents, WebSocket streaming, docs page UI, sandbox management |
| `infrastructure/` | Kubernetes deployment — Helm charts, Helmfile, Terraform, Minikube setup, agent sandbox environments |
| `ideas/` | Vision docs, brainstorming, build plan — input that becomes `.docs/` when ready to build |
| `scripts/` | Shell scripts for K8s secrets, Minikube setup, Tailscale detection |
| `.claude/commands/` | Claude Code slash commands — `/review-feature`, `/sync-feature`, `/write-tests`, `/review-spec` |

## The `.docs/` Convention

Documentation is the specification. Every project and feature has a `.docs/` directory that defines what the code should do. The delta between docs and code defines all work.

See `.docs/standards/docs-driven-development.md` for the full standard.

### Documentation Hierarchy

```
repo/.docs/                     ← Repo-level: standards, conventions
infrastructure/.docs/           ← Infrastructure: K8s, networking, CI/CD, Terraform
projects/application/
  ├── backend/.docs/            ← Project-level: overview, coding standards
  │   └── features/*/.docs/     ← Feature-level: spec, flows, contracts, test-plan
  ├── frontend/app/.docs/       ← Project-level: overview, coding + design standards
  │   └── features/*/.docs/     ← Feature-level: spec, flows, contracts, test-plan
  ├── database/.docs/           ← Database setup spec
  ├── keycloak/.docs/           ← Auth server config spec
  └── e2e/.docs/                ← E2E test overview + per-suite specs
```

## Deployment Model

Everything runs in Kubernetes — Minikube locally, K3s in production. Same Helm charts, same Helmfile, different environment values.

```
task up → Minikube + build + deploy + tunnel
```

Services are accessed via Tailscale hostnames (e.g., `app.shawns-macbook-pro`). No localhost fallback.

## Agent System (THE Dev Team)

Five agent types work the doc-driven development loop:

| Agent | Job |
|-------|-----|
| **Doc Assistant** | Curates `.docs/` — compares docs against code, flags gaps |
| **Test Writer** | Writes tests from spec + flows + contracts |
| **Syncing Agent** | Makes code match `.docs/` spec, runs tests, commits frequently |
| **Tester Agent** | Tests features in deployed sandboxes (Playwright + HTTP) |
| **PR Reviewer** | Reviews PRs against `.docs/` spec + code quality |

See `ideas/build-plan.md` for the full implementation roadmap.

## Standards

| Standard | Path | Description |
|----------|------|-------------|
| Docs-Driven Development | `.docs/standards/docs-driven-development.md` | The `.docs/` convention, file types, agent access matrix |
| Feature Architecture | `.docs/standards/feature-architecture.md` | Everything lives in `features/`, no separate pages/endpoints dirs |
| Project Architecture | `.docs/standards/project-architecture.md` | Project types, directory structure, container-first development |
| Environment Configuration | `.docs/standards/environment-configuration.md` | Single `.env`, no-defaults policy, fail-fast validation |
| Task Automation | `.docs/standards/task-automation.md` | Taskfile patterns, namespace hierarchy |
