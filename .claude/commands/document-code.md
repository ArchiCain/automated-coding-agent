Generate or update `.docs/` documentation for the code at $ARGUMENTS (or the current working directory if no path given). This is the reverse of `/sync-feature` — it makes docs match code, not code match docs.

This command works at any level: a single feature, a project, or an entire application. It creates the full `.docs/` structure from scratch if none exists, or updates existing docs to match the current code reality.

## Priorities (in order)

1. **Accuracy** — every claim must trace to actual source code you read. If you can't verify it, don't write it.
2. **Completeness** — cover every meaningful behavior, endpoint, and flow. Undocumented behavior is a bug.
3. **Digestibility & token efficiency** — docs are for humans too. Prefer tables, bullets, and terse prose over walls of text.

When these conflict, accuracy wins. When 1 and 2 are satisfied, trim ruthlessly for 3.

## Length guidance (not hard limits — cut if content is thin, extend if accuracy requires it)

| File | Target |
|---|---|
| `spec.md` | ~60–120 lines |
| `flows.md` | ~80–150 lines |
| `contracts.md` | as needed (code blocks don't count) |
| `test-plan.md` | ~50–100 lines |
| `test-data.md` | as needed |
| `overview.md` | ~80–120 lines |
| `standards/coding.md` | ~100–180 lines |

If you blow past the target by 2x, you're probably explaining instead of specifying. Cut.

## Source citations (required)

Every non-trivial claim in the docs must be traceable to a source file. Include inline references in the format `` `relative/path.ts:LINE` `` (or a line range `` `relative/path.ts:12-34` ``) anywhere a reader might ask "says who?":
- Behavior bullets in `spec.md`
- Steps in `flows.md` that branch or call something specific
- Every endpoint in `contracts.md`
- Every table row mapping components/services

Paths should be relative to the repo root. If a claim spans many files, cite the most authoritative one.

## Instructions

### Step 1: Determine scope and read the standard

Read `.docs/standards/docs-driven-development.md` from the repo root to understand the documentation convention — file types, structure templates, and when each file is required.

### Step 2: Detect what you're documenting

Examine the target directory to determine what level you're working at:

**Feature level** (directory contains source files like `.ts`, `.tsx`, `.py`, etc. and sits inside a `features/` parent):
- Will create: `spec.md`, and conditionally `flows.md`, `contracts.md`, `test-plan.md`, `test-data.md`

**Project level** (directory contains `src/`, `app/`, or similar top-level source structure):
- Will create: `overview.md`, `standards/coding.md`, and optionally `standards/design.md` (if frontend)
- Will then recurse into `features/` subdirectories and document each feature

**Application level** (directory contains multiple sub-projects like `backend/`, `frontend/`, `database/`):
- Will document each sub-project at the project level
- Will document shared infrastructure (database, auth server, etc.)

When in doubt about the level, check for `features/` directories, `package.json`, `tsconfig.json`, `Taskfile.yml`, or framework config files to orient yourself.

### Step 3: Read existing docs (if any)

If a `.docs/` directory already exists, read ALL files in it first. You'll preserve what's accurate, update what's stale, and add what's missing. Never discard accurate existing documentation — merge your findings into it.

### Step 4: Read project-level context (if documenting a feature)

Walk up from the target directory to find the nearest project-level `.docs/` with `overview.md` and/or `standards/`. Read these to understand:
- Tech stack and framework conventions
- Naming patterns
- Architecture patterns
- What other features exist (to understand relationships)

### Step 5: Read the source code thoroughly

This is the most important step. Read the code systematically:

**For a feature:**
1. Start with barrel/index files (`index.ts`, `index.tsx`) for the public API
2. Read module definitions (`.module.ts` for NestJS, route configs for React/Angular)
3. Read controllers/pages — these define the feature's external interface
4. Read services — these contain the business logic
5. Read types/interfaces/DTOs — these define the data shapes
6. Read guards/middleware/interceptors — these define access control
7. Read tests if they exist — they reveal intended behavior
8. Search for config, environment variables, and external dependencies

**For a project:**
1. Read `package.json` or equivalent for tech stack and dependencies
2. Read the main entry point (`main.ts`, `app.config.ts`, `App.tsx`)
3. Read the root module/config for how features are wired together
4. List the `features/` directory to enumerate all features
5. Read framework config (`tsconfig.json`, `vite.config.ts`, `nest-cli.json`, etc.)
6. Read Docker/deployment config if present

Be deliberate with your context window. Use search (`grep`, `find`) before reading entire directories. Use `offset`/`limit` on large files. Read the files that matter most first.

### Step 6: Generate the documentation

Create a `.docs/` directory (if needed) and write each file following the standard templates from `docs-driven-development.md`. Here's what to generate and when:

#### `spec.md` (always — every feature gets one)

```markdown
# {Feature Name} — Spec

## Purpose
{One paragraph derived from what the code actually does, not what you think it should do}

## Behavior
- {Each bullet is an observable behavior you found in the code}
- {Be specific — include routes, methods, status codes, UI behaviors}
- {Include error handling behavior you observed}

## Components / Endpoints / Services
{Table listing the actual parts of the feature — read from the code}

## Acceptance Criteria
- [ ] {Each criterion maps to a behavior you documented above}
- [ ] {These should be verifiable by a tester agent}
- [ ] {Include edge cases you found in the code}
```

**Key rule:** Document what the code DOES, not what you think it SHOULD do. If the code has a bug, document the intended behavior based on context clues (variable names, comments, test expectations) and note the discrepancy.

#### `flows.md` (when the feature has multi-step behavior, API calls, or user interaction)

Write numbered step-by-step flows by tracing the actual code execution path:
1. Start from the entry point (controller method, page component, event handler)
2. Follow the call chain through services, guards, interceptors
3. Document what happens at each step including error branches
4. Include the actual HTTP methods, routes, status codes, response shapes

#### `contracts.md` (when the feature crosses a boundary — has API endpoints, WebSocket events, or shared types)

Extract the actual request/response shapes from the code:
- Read DTOs, interfaces, type definitions
- Read controller method signatures and decorators
- Read the actual HTTP client calls on the frontend side
- Document auth requirements per endpoint (from guards/decorators)

#### `test-plan.md` (when the feature is testable — most features)

Derive test scenarios from the code:
- **Contract tests:** One per endpoint — verify response shapes match what the code produces
- **Behavior tests:** One per acceptance criterion — verify the behavior described in spec.md
- **E2E scenarios:** One per major flow — verify the end-to-end path from flows.md

#### `test-data.md` (when tests need specific data — auth, CRUD, forms)

Extract from the code:
- Hardcoded test credentials, seed data, fixture files
- Expected API response examples (copy from actual code/tests)
- Configuration values needed to run tests

#### `overview.md` (project-level only)

```markdown
# {Project Name} — Overview

## What This Is
{One paragraph — what this project does, derived from the code}

## Tech Stack
{Read from package.json / requirements.txt / go.mod — list actual dependencies}

## Features
| Feature | Route/Purpose | Auth | Description |
|---------|--------------|------|-------------|
{List every feature directory with its purpose derived from the code}

## Standards
| Standard | Description |
|----------|-------------|
| [Coding](standards/coding.md) | {framework} patterns, naming, structure |
{Add design.md row if frontend}

## Architecture
{Draw an ASCII diagram showing the request flow, guards, middleware, routing}
```

#### `standards/coding.md` (project-level only)

Derive from the actual codebase:
- File naming patterns (read actual filenames, don't guess)
- Directory structure (read the actual tree)
- Code patterns (read actual guards, decorators, hooks, services)
- Import conventions, module patterns
- Error handling patterns

#### `standards/design.md` (project-level, frontend only)

Derive from the actual codebase:
- Theme configuration (read actual theme files, CSS variables, SCSS)
- Component patterns (read actual component usage)
- Color palette (extract from theme config)
- Typography (extract from styles)

### Step 7: Validate your output

Before finishing, re-read each doc file you created and ask:
- Does every statement trace back to actual code I read?
- Would a syncing agent be able to recreate this code from these docs?
- Are the acceptance criteria specific enough to write tests against?
- Did I miss any significant behavior?

### Step 8: Report what you did

Summarize (keep it tight — this goes back to the orchestrator):

```
## Documentation Generated: {target path}

### Files created/updated
- .docs/spec.md — {created | updated: what changed}
- .docs/flows.md — {created | updated | skipped: why}
- ...

### Coverage
- {X} endpoints documented
- {Y} components/services documented
- {Z} flows traced

### Discrepancies (doc/code drift you found)
- {Claim in prior docs that no longer matches code — with file:line}
- {Behavior in code that was never documented}
- {Anything you couldn't verify and flagged as TODO in the doc}

### Open questions
- {Anything ambiguous you had to interpret — name the assumption}
- {Anything that needs human input}
```

Report Discrepancies and Open questions accurately even if short — they are the orchestrator's signal for follow-up work.

## Rules

- **Document reality, not intent.** Write what the code does. If it's broken, note it in the Discrepancies section but document the apparent intent in the doc body.
- **Cite sources.** Every non-trivial claim must reference the source file (and line when specific). See "Source citations" above.
- **Preserve existing accurate docs.** If `.docs/` exists and content is still correct, keep it. Update only what's stale. Add what's missing. Delete claims that no longer match code (and call them out in Discrepancies).
- **Skip `decisions.md`.** WHY-decisions cannot be reliably derived from code alone. Do not generate this file unless explicitly asked — leave it to humans.
- **Follow the standard templates exactly.** The doc structure must match `.docs/standards/docs-driven-development.md` so agents can parse it.
- **Be deliberate with context.** You have a limited context window. Read systematically — search first, then read targeted files. Don't try to read an entire large codebase at once.
- **Respect the length targets.** If you're over by 2x, you're probably over-explaining. Trim.
- **Create the `.docs/` directory if it doesn't exist.** Create files directly with the Write tool — the directory structure should match the standard.
- **Never modify source code.** This command only writes to `.docs/` directories. The code is the source of truth here.
- **Do NOT commit.** The orchestrator will commit in logical batches after reviewing your output. Just write files and report.
