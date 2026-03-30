# Backlog Structure Redesign - Handoff

## Context

We reviewed the current `.backlog` directory structure and all decomposition agent instructions. The goal: simplify the structure so it's less deeply nested, easier to read as a human, and strips out anything not related to decomposition (since execution isn't being built yet).

## Files Reviewed

- `docs/backlog-structure.md` - structure spec (partially outdated)
- `.agents/brainstorm/instructions.md`
- `.agents/decomp-1-plan-to-projects/instructions.md`
- `.agents/decomp-2-project-to-features/instructions.md`
- `.agents/decomp-3-feature-to-concerns/instructions.md`

## What's Wrong with the Current Structure

### 1. Too deeply nested
Current path to a leaf task: `.backlog/p-calc01/tasks/backend/features/basic-operations/concerns/service/task.md` (7 directories deep). The container dirs `tasks/`, `features/`, `concerns/` add depth without information.

### 2. Metadata sprawl
Every level has `status.json`. The plan level has both `state.json` AND `status.json` with overlapping schemas. Dozens of tiny JSON files scattered everywhere.

### 3. Ambiguous file names
The first three levels all use `plan.md`. You can't tell if you're at plan, project, or feature level without checking your position in the tree.

### 4. Agent instruction duplication
The three decomp agents share huge blocks of identical text (~500 lines each). Operating Philosophy, Core Principles, Phase 1-4 process, Context Inheritance Rules, Research Checklist are copy-pasted across all three.

### 5. `backlog-structure.md` is outdated
Says `task.md` at every level, but agents actually produce `plan.md` at non-leaf levels and `task.md` only at concerns.

## What Works Well (Keep)

- The decomposition/distillation philosophy (each child self-contained with only needed context)
- 4 semantic levels: Plan -> Project -> Feature -> Concern
- `dependsOn` graph at the concern level
- Separating brainstorm from decomposition
- YAML frontmatter for id, parent, timestamps

## Agreed Changes

### 1. Keep 4 levels
Plan -> Project -> Feature -> Concern. This is necessary to break work down small enough for open-source LLMs to execute, and mirrors the actual code structure.

### 2. Drop container directories
Remove `tasks/`, `features/`, `concerns/` intermediate dirs. The level is already implied by tree position.

### 3. Flatten concerns to files
Instead of `concerns/service/task.md` (a directory with one file), use `service.task.md` as a file in the feature directory. The `.task.md` suffix distinguishes leaf tasks from `plan.md` files.

### 4. Strip non-decomp artifacts
Remove `status.json`, `state.json`, and any execution-related content. We're only focused on decomposition right now.

### 5. Shared knowledge file
Extract duplicated agent content into `docs/decomposition-knowledge.md`. Each agent's `instructions.md` shrinks from ~500 lines to ~150, containing only level-specific guidance.

## Proposed New Structure

```
.backlog/p-calc01/
├── plan.md                              # top-level plan (brainstorm output)
├── backend/                             # project
│   ├── plan.md                          # project plan
│   ├── basic-operations/                # feature
│   │   ├── plan.md                      # feature plan
│   │   ├── service.task.md              # concern (leaf task)
│   │   ├── controller.task.md           # concern (leaf task)
│   │   ├── dto.task.md                  # concern (leaf task)
│   │   └── module.task.md              # concern (leaf task)
│   └── scientific-operations/
│       ├── plan.md
│       ├── service.task.md
│       └── controller.task.md
└── frontend/
    ├── plan.md
    └── calculator-ui/
        ├── plan.md
        ├── page.task.md
        ├── component.task.md
        └── service.task.md
```

Max depth: 3 directories + file (down from 7 directories + file).

## Open Questions

1. **`.task.md` suffix** - Does this feel natural? Alternatives: `service.concern.md`, or keep directories for concerns (but then we're back to more nesting).

2. **Plan-level metadata** - Do we still want any kind of `state.json` at the plan root (for plan name/id), or is YAML frontmatter in `plan.md` enough?

3. **`dependsOn`** - Currently lives in `status.json` which we're removing. Options:
   - Move to YAML frontmatter in the `.task.md` files
   - Drop entirely for now (decomp-only focus)
   - Keep a single manifest file per plan

4. **Concern naming collisions** - If a feature has two services (unlikely but possible), how do we handle `service.task.md` needing to be unique? Options: prefix like `auth-service.task.md`, or accept it's rare enough to handle case-by-case.

## Next Steps

1. Decide on open questions above
2. Create `docs/decomposition-knowledge.md` with shared agent content
3. Rewrite `docs/backlog-structure.md` to match new structure
4. Update all four agent instruction files (brainstorm + 3 decomp agents)
5. Delete any existing `.backlog` content that uses the old structure (if any)
