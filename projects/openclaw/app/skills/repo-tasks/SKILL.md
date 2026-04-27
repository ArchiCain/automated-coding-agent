---
name: repo-tasks
description: Use the repo's Taskfile instead of raw commands. Run `task --list` first.
---

This repo's `Taskfile.yml` exposes every common operation as a task. Tasks encode known-good flags, environment setup, and the order of steps the team has already learned the hard way. Raw command invocations bypass that knowledge and frequently break in ways that are hard to debug.

# Rule

Before any shell command, check whether a task covers it.

1. Run `task --list` or `task --list-all` once per session to see what's available.
2. Use `task <name>` when one exists.
3. Fall back to raw commands ONLY when no task covers the need, and explain why in your reasoning.

# Common mappings (not exhaustive)

| Instead of | Use |
|------------|-----|
| `docker compose -f infrastructure/compose/dev/compose.yml up -d` | `task up` |
| `docker compose ... down` | `task down` |
| `docker compose build` | `task build` |
| Launching a sandbox by hand | `task env:create -- {id}` |
| Tearing down a sandbox by hand | `task env:destroy -- {id}` |
| `docker compose logs -f {service}` | `task dev:logs` / `task openclaw:logs` / `task env:logs -- {id}` |
| `curl` each service to check health | `task env:health -- {id}` |
| Per-service image build with raw `docker build` | `task {project}:local:build` or `task build` |

# Stop signal

If you see yourself about to run one of these commands directly — `docker compose up/down`, `docker build`, `git worktree` — stop and check the Taskfile first. These are the highest-risk raw invocations.
