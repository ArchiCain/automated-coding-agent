# Roles & Skills

Every agent session in THE Dev Team is a combination of:

1. A **role** — what you are and what you are allowed to do
2. A **soul** — the behavioural rules that apply to every role
3. One or more **skills** — domain-specific knowledge loaded based on the role

The orchestrator's `SkillLoaderService` assembles a system prompt from these pieces before dispatching work to a provider.

## The nine roles

| Role | Purpose | Allowed tools |
|------|---------|---------------|
| **architect** | Analyse the codebase, produce a markdown plan, decompose a feature into a task tree | `Read`, `Grep`, `Glob` |
| **implementer** | Write code following the architect's plan | `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` |
| **reviewer** | Review the full diff, write `findings/reviewer.md` | `Read`, `Write`, `Grep`, `Glob` |
| **tester** | Write and run unit + integration tests against the live sandbox | `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` |
| **designer** | Build UI, write Playwright E2E, capture screenshots, enforce the design system | `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` |
| **bugfixer** | Read findings + gate failures and fix the underlying issues | `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` |
| **documentarian** | Update documentation to reflect the change | `Read`, `Write`, `Edit`, `Grep`, `Glob` |
| **monitor** | Check CI state after merge, file fix tasks on failures | `Read`, `Bash`, `Grep` |
| **devops** | Run `task env:*` to build, deploy, inspect sandboxes | `Bash`, `Read` |

Three roles (`architect`, `reviewer`, `monitor`) are **read-only** — they cannot modify source code or run arbitrary code. This is the orchestrator's strongest guarantee against the architect "helpfully" starting to implement things itself.

## The soul

`skills/soul.md` is the single file loaded for **every** session, regardless of role. It encodes:

- **Identity** — "you are a member of THE Dev Team, assigned role `X`, working on task `Y` in worktree `Z` and namespace `env-Y`"
- **Code style** — feature-based directories, NestJS modules, MUI components, TypeScript strict mode, conventional commits
- **Architecture rules** — where code must live, how modules must be structured
- **Git workflow** — branch naming, never pushing to protected branches, one logical change per commit
- **Safety rules** — never modify `.github/workflows/`, never touch orchestrator code, never run raw `kubectl`/`helm`/`docker`, always go through `task env:*`
- **Self-validation** — don't submit until all gates pass, fix your own bugs, read logs to diagnose, respect the retry budget

The soul is the first line of defence against self-modification. See [Safety Model](safety-model.md) for the defences that back it up at the GitHub, K8s, and secret layers.

## The ten skills

Skills live under `skills/{name}/SKILL.md`. Each is a self-contained markdown document with concrete commands, patterns, and file paths for a specific domain. Roles load one or more skills depending on what they need to do.

```
skills/
├── soul.md                     ← Always loaded
├── decompose/SKILL.md          ← Codebase analysis, task trees
├── execute/SKILL.md            ← Implementation workflow, git, conventions
├── infrastructure/SKILL.md     ← task env:* reference, K8s/Docker/Helm
├── api-test/SKILL.md           ← Jest/Vitest unit + integration patterns
├── e2e-test/SKILL.md           ← Playwright patterns
├── design-review/SKILL.md      ← MUI design system rules
├── monitor/SKILL.md            ← CI monitoring, failure diagnosis
├── github/SKILL.md             ← PR creation, issue reading, review handling
├── database/SKILL.md           ← TypeORM migrations, entities
└── performance/SKILL.md        ← autocannon, Playwright metrics
```

### What each skill is for

| Skill | Contents |
|-------|----------|
| **decompose** | How to analyse the existing codebase, produce a project → feature → concern → task tree, identify dependencies, decide when a task is atomic |
| **execute** | The concrete implementation workflow — reading the plan, where files go, how to write tests, commit message format |
| **infrastructure** | Complete reference for `task env:*` commands (build, create, destroy, health, logs, db queries, port-forward). "Never run raw kubectl/helm/docker." |
| **api-test** | Jest/Vitest patterns for the repo: test file naming, how to spin up Nest test modules, integration tests against the live sandbox |
| **e2e-test** | Playwright page object pattern, `data-testid` convention, running tests against `app.env-{task-id}.svc.cluster.local`, console + network monitoring |
| **design-review** | The full MUI design system: spacing, typography, colour, layout, component rules, "things that are always wrong", breakpoints for screenshots, axe-core WCAG AA |
| **monitor** | How to check CI status via `gh`, how to diagnose pipeline failures, when to file a fix task |
| **github** | `gh pr create` template, review comment handling, how to update a PR after rework |
| **database** | TypeORM migration creation, entity definition patterns, how to validate schema state, seed data |
| **performance** | autocannon usage, Playwright performance metrics, comparing to `.the-dev-team/baselines/performance.json`, the 20% regression threshold |

## Role → skill mapping

The `SkillLoaderService` hard-codes the map from role to skills:

```typescript
const roleSkillMap: Record<TaskRole, string[]> = {
  architect:     ['decompose'],
  implementer:   ['execute', 'database'],
  reviewer:      ['execute'],
  tester:        ['api-test'],
  designer:      ['design-review', 'e2e-test'],
  bugfixer:      ['execute', 'infrastructure'],
  documentarian: ['execute'],
  monitor:       ['monitor', 'github'],
  devops:        ['infrastructure'],
};
```

At run-time, the loader builds the system prompt like this:

```
{contents of skills/soul.md}

## Your Role: implementer

## Task Context
{task description}
Task ID: {id}
Branch: {branch}
Namespace: env-{id}
Worktree: {worktree path}

## Loaded Skills

{contents of skills/execute/SKILL.md}

---

{contents of skills/database/SKILL.md}
```

## The skill loader service

Lives at `src/skills/skill-loader.service.ts` in the orchestrator.

```typescript
@Injectable()
export class SkillLoaderService {
  async loadSoul(): Promise<string> { /* reads skills/soul.md */ }
  async loadSkills(names: string[]): Promise<string> { /* reads SKILL.md files */ }
  async buildSystemPrompt(role: TaskRole, ctx: TaskContext): Promise<string> { /* assembles */ }
  getToolsForRole(role: TaskRole): string[] { /* returns allowed tools */ }
  private getSkillsForRole(role: TaskRole): string[] { /* role → skill names */ }
}
```

The orchestrator calls `buildSystemPrompt` once per role invocation. Skills are read from disk every time — hot-reloading a skill is as simple as editing the file.

## Extending

Adding a new skill:

1. Create `skills/{name}/SKILL.md`
2. Add it to `roleSkillMap` for the roles that should load it
3. Restart the orchestrator (or wait for the next session)

Adding a new role is a larger change — it requires:

1. Adding the role to the `TaskRole` union type
2. Entries in `roleSkillMap` and `roleToolMap`
3. Dispatching it from somewhere in the execution loop
4. Optionally, a per-role provider override in `the-dev-team.config.yml`

## Related reading

- [Execution Loop](execution-loop.md)
- [Configuration](configuration.md)
- [Safety Model](safety-model.md)
