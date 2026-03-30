# rlm-execute

Execute an atomic task by writing code, running tests, and creating a PR.

## When to Use

- A decomposed task has status `ready` and no blockers
- The operator approves a task for execution via the Web UI
- The catchup cron finds ready tasks in the backlog

## Input

A `task.md` file containing:
- What to implement (feature, concern type, acceptance criteria)
- Which project and feature it belongs to
- Any dependencies on other completed tasks

## Process

1. **Read the task** and all parent context (feature task.md, project task.md, plan.md).

2. **Create a feature branch** from `main`:
   - Format: `openclaw/{plan-id}/{project}/{feature}/{concern}`
   - Example: `openclaw/p-a075b3/backend/auth/service`

3. **Clone the repo** into the workspace if not already present. Pull latest `main`.

4. **Scan related code** before writing anything:
   - Read existing files in the target feature directory
   - Check imports, types, and interfaces that the new code must conform to
   - Read test files for patterns to follow

5. **Implement the task** using a Claude Code ACP session:
   - Write the code following existing patterns exactly
   - Add tests following existing test patterns
   - Update module imports if adding new NestJS providers
   - Keep changes minimal and focused on the task

6. **Run tests** to validate:
   - Unit tests: `npm test` in the project directory
   - Lint: `npm run lint` in the project directory
   - If tests fail, fix them before proceeding

7. **Commit and push** the feature branch.

8. **Create a PR** targeting `main`:
   - Title: concise description of what was implemented
   - Body: link to the task, summary of changes, test results
   - Label: `openclaw`, project name, feature name

9. **Update task status** to `completed` or `failed` with details.

## Output

- A PR with the implementation
- Updated task status
- Test results logged to the Web UI

## Rules

- One PR per atomic task. Don't combine multiple concerns.
- Never modify files outside the scope of the task unless absolutely necessary (and document why).
- If the task requires changes to shared types or interfaces, note this in the PR description.
- If tests fail and you can't fix them within the task scope, mark the task as `failed` with details.
- Always run the linter before pushing. Fix all lint errors.
- Follow the NestJS module pattern: every feature must have its own module.
- Follow the feature-based architecture: no files outside `src/features/`.
