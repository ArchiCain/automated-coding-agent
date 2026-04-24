# Automated Coding Agent — Overview

## What This Is

A monorepo containing an autonomous software development system (**OpenClaw**) and the application it builds (**the benchmark app under `projects/application/`**). OpenClaw reads `.docs/` specifications and syncs code to match, deploys to sandbox environments, runs tests, creates PRs, and iterates — humans guide the specs.

Claude Code (running on the user's laptop) is the tool humans use to edit OpenClaw itself and everything around it (infrastructure, CI/CD, this docs tree).

## Division of labor

| Actor | Owns | How it's edited |
|---|---|---|
| **OpenClaw** (`projects/openclaw/`) | `projects/application/` — the benchmark app | Edited via Claude Code (rebuild gateway image, recreate container) |
| **Claude Code** (this CLI) | `projects/openclaw/`, `infrastructure/`, `scripts/`, `.github/`, repo-level docs | Edited in-session by a human + Claude |
| **THE Dev Team** (`projects/the-dev-team/`) | Nothing — frozen reference | Do not edit |

The full rationale is in the top of `CLAUDE.md`.

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `projects/application/` | The benchmark application — Angular frontend, NestJS backend, Keycloak auth, PostgreSQL. **OpenClaw edits this.** |
| `projects/openclaw/` | The OpenClaw agent runtime: gateway Dockerfile, git-sync sidecar, `openclaw.json`, skills, Taskfile. **Claude Code edits this.** |
| `projects/the-dev-team/` | Frozen reference. Prior orchestrator; non-runnable post-migration. |
| `infrastructure/` | Compose stacks (dev, openclaw, sandbox templates), Terraform for the EC2 host, Caddy reverse-proxy config |
| `.github/` | CI/CD workflows — PR checks, branch-based deployment |
| `scripts/` | Sandbox lifecycle helpers (`sandbox-*.sh`) + deploy helper (`deploy.sh`) |
| `.claude/commands/` | Claude Code slash commands — `/review-feature`, `/sync-feature`, `/write-tests`, `/review-spec`, `/document-code` |

## The `.docs/` Convention

Documentation is the specification. Every project and feature has a `.docs/` directory that defines what the code should do. The delta between docs and code defines all work.

See `.docs/standards/docs-driven-development.md` for the full standard.

### Documentation Hierarchy

```
repo/.docs/                         ← Repo-level: standards, conventions
.github/.docs/                      ← CI/CD: workflows, deployment targets
infrastructure/.docs/               ← Infrastructure overview + EC2 reverse-proxy ADR
infrastructure/compose/.docs/       ← Compose stack layout, ports, env files, sandboxes
infrastructure/terraform/.docs/     ← Terraform: EC2 provisioning
projects/application/
  ├── backend/.docs/                ← Project-level: overview, coding standards
  │   └── features/*/.docs/         ← Feature-level: spec, flows, contracts, test-plan
  ├── frontend/app/.docs/           ← Project-level: overview, coding + design standards
  │   └── features/*/.docs/         ← Feature-level: spec, flows, contracts, test-plan
  ├── database/.docs/               ← Database setup spec
  ├── keycloak/.docs/               ← Auth server config spec
projects/openclaw/.docs/            ← Gateway topology, skills, deploy model
```

## Deployment Model

Everything runs on docker-compose — locally on a developer laptop (Docker Desktop), in production on a single Ubuntu EC2 host behind Caddy. Same compose files, prod-specific overrides layered via `compose.prod.yml`.

```
task up → dev compose project + openclaw compose project
```

Locally, services are reachable at `http://localhost:{port}` (frontend 3000, backend 8080, keycloak 8081, openclaw 3001). On EC2, Caddy terminates TLS and routes by `Host` header to the same compose projects.

## Agent system (OpenClaw)

Four agent personas run inside the OpenClaw gateway. Each has a skill allowlist, a persistent workspace under `/workspace/.openclaw/`, and memory indexed by QMD.

| Agent | Job |
|-------|-----|
| **orchestrator** | Talks to the human. Parses requests, delegates to specialists, returns summaries. |
| **devops** | Sandbox lifecycle (`task env:*`), git worktrees, branches, PRs, logs. Read-only on source code. |
| **worker** | Writes code to match `.docs/` specs under `projects/application/`. Commits frequently. |
| **tester** | Runs tests in sandboxes (HTTP + browser via the OpenClaw browser plugin). |

Agent prompts live under `projects/openclaw/app/skills/`. OpenClaw reads them from the synced repo at `/workspace/repo/projects/openclaw/app/skills/` (refreshed by the git-sync sidecar every 60s) rather than from the baked-in image — so a skill edit lands on the next gateway restart without rebuilding.

## Standards

| Standard | Path | Description |
|----------|------|-------------|
| Docs-Driven Development | `.docs/standards/docs-driven-development.md` | The `.docs/` convention, file types, agent access matrix |
| Feature Architecture | `.docs/standards/feature-architecture.md` | Everything lives in `features/`, no separate pages/endpoints dirs |
| Project Architecture | `.docs/standards/project-architecture.md` | Project types, directory structure, container-first development |
| Environment Configuration | `.docs/standards/environment-configuration.md` | Single `.env`, no-defaults policy, fail-fast validation |
| Task Automation | `.docs/standards/task-automation.md` | Taskfile patterns, namespace hierarchy |
