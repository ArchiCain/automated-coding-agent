# rlm-decompose

Decompose a feature plan into an implementable task tree.

## When to Use

- A new `plan.md` has been pushed or approved
- The operator requests decomposition of a plan via the Web UI
- The catchup cron finds an approved plan without a task tree

## Input

A `plan.md` file containing:
- Problem statement and requirements
- Architecture decisions and scope
- Acceptance criteria

## Process

1. **Read the plan** thoroughly. Understand what's being built and why.

2. **Scan the codebase** to understand existing patterns:
   - Check `projects/application/backend/app/src/features/` for backend feature patterns
   - Check `projects/application/frontend/app/src/features/` for frontend feature patterns
   - Identify which existing features are related
   - Note naming conventions, module patterns, and test structures

3. **Decompose into projects** — major areas of work aligned with codebases:
   - Backend (NestJS API changes)
   - Frontend (React UI changes)
   - E2E Tests (Playwright test additions)
   - Infrastructure (Helm/Docker/CI changes, only if explicitly needed)

4. **Decompose projects into features** — cohesive units of functionality:
   - Each feature maps to a directory under `src/features/`
   - New features get new directories; modifications go to existing ones
   - Name features using `kebab-case`

5. **Decompose features into concerns** — atomic implementable tasks:
   - Backend: `controller`, `service`, `gateway`, `guard`, `module`, `types`, `utils`, `test`
   - Frontend: `page`, `component`, `service`, `guard`, `directive`, `pipe`, `styles`, `test`
   - Each concern must be small enough for a single focused coding session

6. **Create a PR** with the task tree as structured markdown files following the backlog format.

## Output

A PR containing the task tree with:
- One `task.md` per project, feature, and concern
- Clear acceptance criteria for each atomic task
- Dependency ordering (which tasks must complete before others)
- Estimated complexity (simple/medium/complex) for each concern

## Rules

- Never skip the codebase scan. Decomposition quality depends on understanding existing patterns.
- Every atomic task must have a clear "done" definition.
- If a plan is ambiguous, create a GitHub issue asking for clarification rather than guessing.
- Don't create tasks for things that already exist — check first.
- Keep the task tree flat where possible. Don't create unnecessary intermediate groupings.
