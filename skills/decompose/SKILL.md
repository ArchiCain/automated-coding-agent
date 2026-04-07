# Skill: Decompose

You are operating as an **architect**. Your job is to analyze a codebase and produce
a structured task tree that other agents can execute independently.

---

## Codebase Analysis

Before creating any plan, you must understand the current state:

### Step 1 — Map the Structure

```bash
# Get the top-level layout
find . -maxdepth 3 -type f -name '*.ts' | head -100

# Identify all NestJS modules
grep -r '@Module' --include='*.ts' -l

# Identify all entities
grep -r '@Entity' --include='*.ts' -l

# Identify all controllers and their routes
grep -r '@Controller' --include='*.ts' -l

# Find existing migrations
ls -la src/**/migrations/ 2>/dev/null || ls -la migrations/ 2>/dev/null
```

### Step 2 — Understand Dependencies

- Read `package.json` for external dependencies and scripts.
- Read `tsconfig.json` for path aliases and compilation targets.
- Read `Taskfile.yml` for available automation commands.
- Check for existing `.env.example` or config files for required environment variables.

### Step 3 — Identify Patterns

Look at 2-3 existing features to understand the established patterns:
- How are modules structured?
- What patterns do services follow?
- How are tests organized?
- What naming conventions are in use?

Document any deviations from the standard patterns in your plan.

---

## Task Tree Structure

Decomposition follows a four-level hierarchy:

```
Project
  └── Feature (a user-facing capability or system component)
        └── Concern (backend, frontend, infrastructure, testing)
              └── Task (a single atomic unit of work for one agent)
```

### Feature Definition

A feature is a cohesive unit of functionality. Examples:
- "User authentication flow"
- "Invoice generation pipeline"
- "Real-time notification system"

Each feature gets its own directory under `src/features/`.

### Concern Breakdown

Every feature is broken into concerns:

| Concern | Typical Tasks |
|---------|--------------|
| **backend** | Entity, migration, service, controller, DTOs, unit tests |
| **frontend** | Components, hooks, pages, component tests |
| **infrastructure** | Taskfile entries, deployment config, environment setup |
| **testing** | Integration tests, E2E tests, performance tests |
| **documentation** | API docs, architecture decision records |

### Atomic Task Requirements

A task is atomic if:
1. It can be completed by a single agent in a single session.
2. It has clear inputs (what files/context to read) and outputs (what files to create/modify).
3. It can be validated independently (tests pass, types check, etc.).
4. It produces exactly one logical commit.

If a task requires more than ~500 lines of new code, split it further.

---

## Dependency Identification

Tasks have dependencies. Map them explicitly:

```
feat/user-profile-backend-entity       → (no deps, can start immediately)
feat/user-profile-backend-migration    → depends on: entity
feat/user-profile-backend-service      → depends on: entity, migration
feat/user-profile-backend-controller   → depends on: service, DTOs
feat/user-profile-frontend-components  → depends on: controller (needs API contract)
feat/user-profile-e2e-tests            → depends on: frontend, backend deployed
```

Rules:
- Backend entity/migration tasks have no feature dependencies (they may depend on shared infrastructure).
- Frontend tasks depend on the API contract being defined (controller + DTOs).
- E2E tests depend on both frontend and backend being deployed.
- Integration tests depend on backend being deployed.
- Tasks within the same concern can often run in parallel.

---

## Plan Document Format

Your output is a plan document (Markdown) stored in `docs/plans/`:

```markdown
# Plan: {Feature Name}

## Overview
{1-2 paragraph description of what this feature does and why}

## Task Tree

### 1. {task-id}: {short description}
- **Role:** implementer | tester | designer | devops
- **Depends on:** {task-ids or "none"}
- **Inputs:** {files to read, context needed}
- **Outputs:** {files to create/modify}
- **Validation:** {how to verify this task is done correctly}
- **Estimated scope:** {small | medium | large}

### 2. {task-id}: {short description}
...

## Dependency Graph
{ASCII or mermaid diagram showing task ordering}

## Risks & Decisions
{Any architectural decisions made, risks identified, or ambiguities resolved}
```

---

## Quality Checklist

Before submitting your plan:

- [ ] Every task has a clear, unique task ID
- [ ] Dependencies form a DAG (no circular dependencies)
- [ ] Every task specifies its role
- [ ] Every task has measurable validation criteria
- [ ] No task requires more than ~500 lines of new code
- [ ] The plan covers all concerns (backend, frontend, tests, infra)
- [ ] Existing patterns and conventions are documented and followed
- [ ] Risks and architectural decisions are called out
