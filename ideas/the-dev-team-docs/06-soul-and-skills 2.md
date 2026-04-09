# 06 — Soul & Skills System

## Goal

Create the soul (core behavioral rules) and skill (domain-specific knowledge) system that forms the system prompt for every agent session. The soul is always loaded; skills are loaded contextually based on the role.

## Current State

- `projects/openclaw/app/SOUL.md` — Existing soul document for the OpenClaw agent. Contains identity, operating principles, responsibilities, constraints. This is the template to evolve.
- `projects/openclaw/app/skills/` — 5 skill directories (decompose, execute, monitor, github, e2e-tester). These contain the knowledge to be ported.
- The existing coding-agent backend has `prompts.service.ts` that constructs system prompts for agent sessions.

## Target State

```
skills/
├── soul.md                        ← Core behavioral rules (always loaded)
├── decompose/
│   └── SKILL.md                   ← Codebase analysis, plan creation, task trees
├── execute/
│   └── SKILL.md                   ← Implementation workflow, git, code conventions
├── infrastructure/
│   └── SKILL.md                   ← Taskfile commands, K8s, Docker, Helm operations
├── api-test/
│   └── SKILL.md                   ← Unit test + integration test patterns
├── e2e-test/
│   └── SKILL.md                   ← Playwright E2E test writing and execution
├── design-review/
│   └── SKILL.md                   ← Design system rules, visual validation
├── monitor/
│   └── SKILL.md                   ← CI pipeline monitoring, failure diagnosis
├── github/
│   └── SKILL.md                   ← PR creation, issue management, review handling
├── database/
│   └── SKILL.md                   ← Schema changes, migrations, data validation
└── performance/
    └── SKILL.md                   ← Load testing, metrics, profiling
```

## Implementation Steps

### Step 1: Create the Soul Document

Create `skills/soul.md` — the core rules loaded for every agent session. Port and evolve from `projects/openclaw/app/SOUL.md`.

The soul should cover:

**Identity:**
- You are a member of THE Dev Team, an autonomous development system
- You are assigned a specific role for this session (architect, implementer, etc.)
- You work on a specific task in an isolated worktree and namespace

**Code Style & Conventions:**
- Feature-based directory organization (`src/features/{feature-name}/`)
- NestJS patterns: modules, services, controllers, guards, decorators
- React patterns: functional components, hooks, Material-UI
- TypeScript strict mode, no `any` types
- Conventional commits (`feat:`, `fix:`, `refactor:`, etc.)

**Architecture Rules:**
- All backend code follows NestJS module boundaries
- All frontend code uses Material-UI components (no raw HTML where MUI exists)
- Database changes always use TypeORM migrations
- All API endpoints go through NestJS controllers with proper DTOs
- Feature modules are self-contained (own controllers, services, entities)

**Git Workflow:**
- Branch naming: `the-dev-team/{task-type}/{short-description}`
- Never push to `main`, `staging`, or any protected branch
- Always work in your assigned worktree
- Conventional commit messages
- One logical change per commit

**Safety Rules:**
- NEVER push to protected branches
- NEVER modify `.github/workflows/` files
- NEVER access production credentials
- NEVER deploy outside `env-*` namespaces
- NEVER modify orchestrator code, config, or deployment
- NEVER run raw kubectl/helm/docker commands — use Taskfile tasks
- All infrastructure operations go through `task env:*`

**Self-Validation:**
- Don't submit a PR until all validation gates pass
- Fix issues yourself — don't punt to the human
- Read logs to diagnose failures, don't guess
- Retry budget: 3 attempts per gate before escalation

### Step 2: Port Existing Skills

For each skill, port the content from `projects/openclaw/app/skills/` and extend with THE Dev Team specifics:

**`decompose/SKILL.md`** — Port from OpenClaw's rlm-decompose skill.
- How to analyze the existing codebase structure
- How to create a task tree (project → feature → concern → task)
- Plan output format (markdown)
- Dependency identification between tasks
- What makes a task atomic (one agent can complete it independently)

**`execute/SKILL.md`** — Port from OpenClaw's rlm-execute skill.
- Implementation workflow step by step
- How to read the architect's plan
- File creation patterns for this project
- Test writing expectations
- Commit message format

**`infrastructure/SKILL.md`** — NEW skill for THE Dev Team.
- Complete Taskfile command reference (all `env:*` commands)
- When to build, deploy, check health, read logs
- Never run raw infrastructure commands
- How to diagnose deployment failures
- How to interpret health check output

**`github/SKILL.md`** — Port from OpenClaw's rlm-github skill.
- PR creation format (structured description, test results, screenshots)
- Issue reading for task context
- Review comment handling

**`monitor/SKILL.md`** — Port from OpenClaw's rlm-monitor skill.
- CI pipeline status checking
- Failure diagnosis patterns
- When to trigger fix tasks

**`design-review/SKILL.md`** — NEW skill. See Plan 14 for full content.

**`e2e-test/SKILL.md`** — Port from OpenClaw's rlm-e2e-tester skill.
- Playwright test patterns
- How to test against deployed environments
- Screenshot capture at breakpoints
- Accessibility tree usage

**`api-test/SKILL.md`** — NEW skill.
- Jest/Vitest test patterns for this project
- Integration test patterns against live services
- API contract testing approach
- Test file naming and location conventions

**`database/SKILL.md`** — NEW skill.
- TypeORM migration creation workflow
- Entity definition patterns
- How to validate schema state
- Seed data approach

**`performance/SKILL.md`** — NEW skill.
- How to run performance checks
- Baseline comparison approach
- When performance gate fails
- Tools: autocannon, Playwright metrics

### Step 3: Create Skill Loader Service

Create `src/skills/skill-loader.service.ts` that reads skill files and assembles system prompts:

```typescript
@Injectable()
export class SkillLoaderService {
  private skillsDir = path.join(process.cwd(), 'skills');

  async loadSoul(): Promise<string> {
    return fs.readFile(path.join(this.skillsDir, 'soul.md'), 'utf-8');
  }

  async loadSkills(skillNames: string[]): Promise<string> {
    const skills = await Promise.all(
      skillNames.map(name =>
        fs.readFile(path.join(this.skillsDir, name, 'SKILL.md'), 'utf-8')
      )
    );
    return skills.join('\n\n---\n\n');
  }

  async buildSystemPrompt(role: TaskRole, taskContext: TaskContext): Promise<string> {
    const soul = await this.loadSoul();
    const roleSkills = this.getSkillsForRole(role);
    const skills = await this.loadSkills(roleSkills);

    return [
      soul,
      `\n## Your Role: ${role}\n`,
      `## Task Context\n${taskContext.description}\n`,
      `## Loaded Skills\n${skills}`,
    ].join('\n');
  }

  private getSkillsForRole(role: TaskRole): string[] {
    const roleSkillMap: Record<TaskRole, string[]> = {
      architect: ['decompose'],
      implementer: ['execute', 'database'],
      reviewer: ['execute'],
      tester: ['api-test'],
      designer: ['design-review', 'e2e-test'],
      bugfixer: ['execute', 'infrastructure'],
      documentarian: ['execute'],
      monitor: ['monitor', 'github'],
      devops: ['infrastructure'],
    };
    return roleSkillMap[role];
  }
}
```

### Step 4: Define Tool Access per Role

Each role gets specific tool permissions. Create a mapping in the skill loader or config:

```typescript
const roleToolMap: Record<TaskRole, string[]> = {
  architect: ['Read', 'Grep', 'Glob'],                          // Read-only
  implementer: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  reviewer: ['Read', 'Write', 'Grep', 'Glob'],                  // Write for findings
  tester: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  designer: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'], // Bash for Playwright
  bugfixer: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
  documentarian: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
  monitor: ['Read', 'Bash', 'Grep'],
  devops: ['Bash', 'Read'],                                      // Bash for task commands
};
```

### Step 5: Test System Prompt Assembly

Write a test that:
1. Loads the soul
2. Loads skills for a given role
3. Assembles a complete system prompt
4. Verifies the prompt contains all expected sections
5. Verifies the prompt doesn't exceed a reasonable size (stay within context window limits)

## Verification

- [ ] `skills/soul.md` exists with all required sections
- [ ] All 10 skill directories exist with `SKILL.md` files
- [ ] `SkillLoaderService` loads soul + skills correctly
- [ ] System prompt for each role includes the soul + correct skills
- [ ] Tool access map matches the architecture doc
- [ ] Skill content is actionable (not just theory — includes specific commands, patterns, file paths)

## Open Questions

- **Skill size vs context window:** Some skills (especially `design-review`) could be very large. Need to keep total system prompt within context window limits. Consider: load only relevant sub-sections based on task type?
- **Skill versioning:** Should skills be versioned? If the design system changes, the old skill content is wrong. Skills should always reflect the current project state — maybe auto-generate some skill content from the codebase?
- **Dynamic context:** Should the skill loader inject codebase-specific context (e.g., list of existing features, current schema)? This would make the agent more effective but increases prompt size.
