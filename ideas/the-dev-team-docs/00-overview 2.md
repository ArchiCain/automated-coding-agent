# THE Dev Team — Plan Decomposition Overview

This directory contains actionable implementation plans decomposed from `ideas/the-dev-team.md`. Each document focuses on a specific workstream with concrete steps referencing the existing codebase.

## Plan Documents

| # | Document | Phase | Dependencies | Estimated Effort |
|---|----------|-------|-------------|-----------------|
| 01 | [Repo Cleanup & Migration](./01-repo-cleanup-and-migration.md) | 0 (Prep) | None | Small |
| 02 | [Infrastructure: Minikube + Nix](./02-infrastructure-minikube-nix.md) | 1 | 01 | Medium |
| 03 | [Security Model](./03-security-model.md) | 1 | 02 | Medium |
| 04 | [Orchestrator Core](./04-orchestrator-core.md) | 1 | 01 | Large |
| 05 | [Coding Agent Provider Abstraction](./05-provider-abstraction.md) | 1 | 04 | Medium |
| 06 | [Soul & Skills System](./06-soul-and-skills.md) | 1 | 04 | Medium |
| 07 | [Agent Execution Loop](./07-agent-execution-loop.md) | 1 | 04, 05, 06 | Large |
| 08 | [Taskfile Command Interface](./08-taskfile-command-interface.md) | 1 | 02 | Medium |
| 09 | [Sandbox Environments (env:*)](./09-sandbox-environments.md) | 1 | 02, 08 | Large |
| 10 | [Validation Gates](./10-validation-gates.md) | 1-2 | 07, 09 | Large |
| 11 | [Inter-Role Communication](./11-inter-role-communication.md) | 1 | 04, 07 | Medium |
| 12 | [History & Transcripts](./12-history-and-transcripts.md) | 1 | 04 | Medium |
| 13 | [PR Submission & Review Loop](./13-pr-submission-and-review.md) | 2-3 | 07, 10 | Medium |
| 14 | [Design Validation & Designer Role](./14-design-validation.md) | 2 | 10 | Large |
| 15 | [Performance Validation](./15-performance-validation.md) | 2-3 | 10 | Medium |
| 16 | [Dashboard](./16-dashboard.md) | 3 | 04, 12 | Large |
| 17 | [Task Decomposition & Concurrency](./17-task-decomposition-and-concurrency.md) | 3 | 04, 07 | Large |

## Dependency Graph

```
01 Repo Cleanup
├── 02 Infrastructure (Minikube + Nix)
│   ├── 03 Security Model
│   ├── 08 Taskfile Commands
│   │   └── 09 Sandbox Environments
│   │       └── 10 Validation Gates ──┐
│   └───────────────────────────────────┤
├── 04 Orchestrator Core                │
│   ├── 05 Provider Abstraction         │
│   ├── 06 Soul & Skills                │
│   ├── 07 Agent Execution Loop ────────┤
│   │   ├── 11 Inter-Role Communication │
│   │   ├── 13 PR Submission & Review   │
│   │   └── 17 Task Decomp & Concurrency│
│   └── 12 History & Transcripts        │
│       └── 16 Dashboard                │
└── 10 Validation Gates                 │
    ├── 14 Design Validation            │
    └── 15 Performance Validation       │
```

## Phasing

**Phase 0 (Prep):** 01 — Clean the repo, remove dead code
**Phase 1 (Foundation):** 02-09, 11, 12 — Core infrastructure + single-agent execution
**Phase 2 (Full Validation):** 10 (remaining gates), 13, 14, 15 — All validation + PR loop
**Phase 3 (Intelligence):** 16, 17 — Dashboard, multi-agent, decomposition
**Phase 4-5 (Scale + Self-Improvement):** Not decomposed yet — build after Phase 3 is stable

## How to Use These Plans

Each plan document follows this structure:
1. **Goal** — what this workstream delivers
2. **Current State** — what exists in the repo today
3. **Target State** — what it should look like after implementation
4. **Implementation Steps** — ordered, actionable steps with file paths
5. **Verification** — how to confirm the work is done
6. **Open Questions** — decisions to make during implementation
