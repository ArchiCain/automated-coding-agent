# THE Dev Team — Overview

THE Dev Team is an autonomous multi-role development system. It takes a task description, implements it, deploys it to a sandbox, tests it end-to-end, reviews it, fixes its own bugs, and opens a PR — then hands off to a human for the final merge.

This section explains the mental model. If you want to start submitting tasks, jump to [Submitting Tasks](submitting-tasks.md).

## The mental shift

Most AI coding tools are "one agent, one prompt, one file". THE Dev Team is closer to how a real software team works:

- Work is broken into **tasks**, each with a clear definition of done
- Different tasks are picked up by different **roles** — there's an architect, an implementer, a reviewer, a designer, a tester, a bugfixer, a devops, a documentarian, and a monitor
- Every task runs inside an **isolated sandbox** — its own git worktree, its own K8s namespace, its own copy of the full application stack
- Every change is **validated** through a fixed pipeline of gates (build, unit tests, deploy, integration, log audit, e2e, accessibility, design, performance) before it is allowed to exist as a PR
- **Humans merge PRs**. Nothing else can.

The outcome is a system where you can tell it "add a user profile page" and come back an hour later to a reviewed PR with passing tests, accessibility audit results, performance deltas, and screenshots at three breakpoints.

## The moving parts

```
                ┌──────────────────────────────┐
                │      Task submission          │
                │  (REST / GitHub issue /       │
                │   decomposition service)      │
                └──────────────┬───────────────┘
                               │
                      ┌────────▼────────┐
                      │   Orchestrator  │  ← projects/the-dev-team/backend
                      │   (NestJS)      │
                      └────────┬────────┘
                               │
      ┌────────────────────────┼───────────────────────┐
      │                        │                       │
┌─────▼─────┐           ┌──────▼──────┐         ┌──────▼──────┐
│ Agent     │           │ Sandbox env │         │ History &   │
│ Pool      │──spawns──▶│ env-{id}    │         │ Transcripts │
│ (N slots) │           │ (K8s ns)    │         │ (.the-dev-  │
└───────────┘           └─────────────┘         │  team/      │
                                                │  history/)  │
                                                └─────────────┘
                               │
                       ┌───────▼────────┐
                       │   Dashboard    │  ← projects/the-dev-team/frontend
                       │   (React+MUI)  │
                       └────────────────┘
```

- The **orchestrator** is the only process that makes decisions.
- The **agent pool** is a fixed number of slots (default 4). Each slot runs one task at a time through the execution loop.
- Each task gets a **sandbox namespace** (`env-{task-id}`) deployed from the `full-stack` umbrella Helm chart.
- Every session, event, and gate result is written to `.the-dev-team/history/` as JSONL.
- The **dashboard** reads REST + WebSocket from the orchestrator for live visibility.

Everything runs in Kubernetes — Minikube locally, K3s in production. The orchestrator and frontend are deployed to the `the-dev-team` namespace; sandbox environments get their own `env-{task-id}` namespaces.

## The nine roles

A role is a combination of: a system prompt (soul + role-specific skills), a restricted toolset, and a provider (today always Claude Code). See [Roles & Skills](roles-and-skills.md).

| Role | When it runs | Output |
|------|--------------|--------|
| architect | Phase 2 | Markdown plan for the implementer |
| implementer | Phase 2 | Code changes on the task branch |
| devops | Phase 3 | Built images + deployed sandbox namespace |
| tester | Phase 4 | New unit + integration tests |
| designer | Phase 4 (frontend only) | Frontend code + Playwright E2E + screenshots + a11y report |
| reviewer | Phase 5 | `findings/reviewer.md` |
| bugfixer | Phase 5, and after any gate failure | Fixes driven by findings + gate output |
| documentarian | Phase 5 | Doc updates for the change |
| monitor | Post-merge (scheduled) | CI failure tasks filed back into the queue |

## The 7-phase execution loop

See [Execution Loop](execution-loop.md) for the code-level detail.

1. **Setup** — fetch origin, create a worktree + branch `the-dev-team/{kind}/{task-id}`
2. **Implement** — architect plans, implementer writes
3. **Build + Deploy** — `build` gate, `unit-tests` gate, devops runs `task env:create`, `deployment` gate
4. **Test** — tester writes integration tests; designer runs if `touchesFrontend`; frontend gates run
5. **Review + Fix** — reviewer + bugfixer loop until findings are resolved or retry budget exhausted
6. **Submit** — commit, push, `pr-manager` opens a structured PR
7. **Cleanup** — optionally destroy sandbox, remove worktree, mark completed, generate summary

Any phase can fail. Gate failures trigger the bugfixer with a retry budget (default 3). Exhausting a retry budget **escalates** the task to a human.

## Validation gates

Gates are the system's immune response. Every task must pass the full sequence before its PR can be submitted.

See [Validation Gates](validation-gates.md) for the full list and the Phase 1 vs Phase 2 split.

Short version — the canonical order:

1. build
2. unit-tests
3. deployment
4. integration-tests
5. log-audit
6. api-validation
7. database-validation
8. e2e-tests (frontend only)
9. accessibility (frontend only)
10. design-review (frontend only)
11. performance

## Safety model

THE Dev Team is designed so that **an agent cannot accidentally ship broken code, leak secrets, or modify its own configuration**. The defences are layered:

- **GitHub branch protection** — the bot account can only push to `the-dev-team/**` branches
- **CODEOWNERS** — `.github/`, `infrastructure/terraform/`, `infrastructure/k8s/charts/the-dev-team/` require human approval
- **K8s RBAC** — the agent service account can only touch `env-*` namespaces
- **Secret isolation** — the agent pod has Anthropic + GitHub bot credentials and nothing else
- **Self-modification prevention** — the soul document forbids editing orchestrator code, skills, or deployment configs

See [Safety Model](safety-model.md).

## Where things live on disk

```
skills/                           <- Prompts (soul + SKILL.md files)
.the-dev-team/
├── config/
│   └── the-dev-team.config.yml   <- Role-to-provider mapping, budgets
├── state/                        <- Per-task working memory (ephemeral)
│   └── {task-id}/
├── history/                      <- Append-only record (synced to git)
│   ├── sessions/
│   ├── tasks/
│   ├── orchestrator/
│   └── index.jsonl
└── baselines/
    └── performance.json          <- Baseline metrics for the performance gate
```

## Where to go next

- [Roles & Skills](roles-and-skills.md) — the prompt system
- [Execution Loop](execution-loop.md) — the 7 phases in detail
- [Validation Gates](validation-gates.md) — the 11 gates
- [Sandbox Environments](sandbox-environments.md) — how namespaces are created and destroyed
- [Safety Model](safety-model.md) — the security boundary
- [PR Workflow](pr-workflow.md) — how tasks become PRs
- [Submitting Tasks](submitting-tasks.md) — three ways to give THE Dev Team work
- [Configuration](configuration.md) — the YAML schema
