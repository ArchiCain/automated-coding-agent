# OOB Flow Implementation Decisions

This document captures decisions made during the overnight implementation of the OOB (Out-of-Box) planning and decomposition flow. Each decision includes context, alternatives considered, and rationale.

---

## Decision 1: Planner Skill - Brainstorm-Only Mode

**Context**: The existing planner skill immediately jumps to creating tasks and plan structure. The new design requires pure brainstorming first, with continuous document sync.

**Decision**: Refactor planner to be conversational brainstorm mode that:
1. Creates `plan.md` immediately at session start
2. Uses Extract → Delegate pattern to keep document updated
3. Outputs smart synthesis, NOT structured tasks
4. Ends with approval gate before decomposition

**Alternatives Considered**:
- A. Keep planner creating tasks (rejected: loses brainstorm value)
- B. Two separate skills: brainstorm + planner (rejected: unnecessary complexity)
- C. Single refactored planner (chosen: simpler, clearer purpose)

**Rationale**: A single planner skill with clear purpose (brainstorm → plan.md) is easier to understand and use. The decomp skill handles all task creation.

---

## Decision 2: Plan-Sync Agent Model

**Context**: Need a subagent to maintain plan.md during brainstorming. Should be cheap and fast.

**Decision**: Use **haiku** model for plan-sync agent.

**Alternatives Considered**:
- A. Haiku (chosen: fast, cheap, sufficient for document updates)
- B. Sonnet (rejected: overkill for structured document updates)
- C. No subagent - main agent maintains doc (rejected: bloats main context)

**Rationale**: Plan-sync does mechanical work: read document, add/update section, write document. Haiku is 10x+ cheaper and faster than sonnet, and the structured input format ensures quality.

---

## Decision 3: Plan ID Generation

**Context**: Plans need unique identifiers. Current approach uses hash of name + timestamp.

**Decision**: Keep existing approach: `p-$(echo -n "feature-name-$(date +%s)" | shasum | cut -c1-6)`

**Alternatives Considered**:
- A. UUID (rejected: too long, hard to reference)
- B. Sequential numbers (rejected: conflicts in parallel work)
- C. Timestamp hash (chosen: short, unique, human-typeable)

**Rationale**: The 6-character hash is short enough to type/remember but unique enough to avoid collisions.

---

## Decision 4: Plan Storage Location

**Context**: Plans need a home. Current approach uses `.backlog/p-{id}/`.

**Decision**: Keep `.backlog/` as plan storage root.

**Alternatives Considered**:
- A. `.backlog/` (chosen: already established, makes sense)
- B. `.claude/plans/` (rejected: .claude is for tooling, not data)
- C. `plans/` (rejected: may conflict with user project structure)

**Rationale**: `.backlog/` is descriptive and already in use. No reason to change.

---

## Decision 5: Decomp Skill - Two Stages or One?

**Context**: New design has Stage 1 (project split) and Stage 2 (atomic breakdown). Should these be separate skills?

**Decision**: Keep as **single decomp skill** with two distinct modes:
1. First invocation: project split (Stage 1)
2. Subsequent invocations: atomic breakdown (Stage 2)

**Alternatives Considered**:
- A. Single skill with modes (chosen: simpler mental model)
- B. Two skills: decomp-projects + decomp-tasks (rejected: confusing naming)
- C. Automatic chaining (rejected: loses human approval between stages)

**Rationale**: Users call `/decomp` on a plan or task. The skill detects context:
- If plan has no tasks → do project split
- If plan has non-atomic tasks → do atomic breakdown

This feels natural and matches the "decompose 1" / "decompose backend" interaction model.

---

## Decision 6: ASCII UI Implementation

**Context**: Design doc shows beautiful ASCII box visualizations. These should appear during decomp output.

**Decision**: Implement ASCII boxes as **string templates in the skill prompts**. Skills output formatted text directly.

**Alternatives Considered**:
- A. Skill outputs ASCII directly (chosen: simple, no dependencies)
- B. Separate rendering script (rejected: adds complexity)
- C. Skip ASCII, use plain text (rejected: loses visualization value)

**Rationale**: The ASCII boxes are for human readability. Having the skill output them directly keeps things simple. When we move to web UI, we'll replace these with React components.

---

## Decision 7: Contracts Format

**Context**: Projects need to declare what they provide/require for cross-project dependencies.

**Decision**: Use simple `provides` and `requires` arrays in task JSON:
```json
{
  "contracts": {
    "provides": ["POST /auth/login", "users table"],
    "requires": ["database connection"]
  }
}
```

**Alternatives Considered**:
- A. Simple string arrays (chosen: easy to read, sufficient for v1)
- B. Typed schema definitions (rejected: overkill for prototype)
- C. Separate contracts file (rejected: adds file management complexity)

**Rationale**: String-based contracts are human-readable and sufficient for the prototype. If we need strict schema validation later, we can add it.

---

## Decision 8: PreCompact Hook for Full Sync

**Context**: When context gets compacted, we need to do a full document sync to capture anything missed by incremental updates.

**Decision**: Add PreCompact hook that:
1. Detects if we're in planning mode (active plan in draft state)
2. Spawns plan-sync with `type: full_sync`
3. Passes current conversation summary for synthesis

**Implementation Detail**: The hook needs to pass context to the subagent. Use a temporary file:
```bash
# Hook writes context summary to temp file
# plan-sync agent reads and incorporates
```

**Alternatives Considered**:
- A. File-based context passing (chosen: works within hook constraints)
- B. Environment variable (rejected: too large for env)
- C. Skip full sync, rely on incremental (rejected: loses safety net)

**Rationale**: The PreCompact hook is our safety net. Even if incremental extractions miss things, the full sync before compaction captures everything.

---

## Decision 9: Plan Viewer Command

**Context**: Users need to see current plan state at any point.

**Decision**: Create `/plan` command (or `/view-plan`) that:
1. Reads plan.md and tasks.jsonl
2. Shows current state with ASCII visualization
3. Suggests next actions based on state

**Alternatives Considered**:
- A. `/plan` command (chosen: short, intuitive)
- B. `/show-plan` command (considered: slightly more explicit)
- C. Skill instead of command (rejected: this is a read-only view, not interactive)

**Rationale**: A command is appropriate for a read-only view. Skills are better for interactive multi-turn flows.

---

## Decision 10: Session Resume Detection

**Context**: When a session starts, we should detect interrupted plans and offer to resume.

**Decision**: Add SessionStart hook for planning mode that:
1. Scans `.backlog/` for plans with status "drafting" or "interrupted"
2. If found, displays resumption prompt
3. User can resume, view, or discard

**Alternatives Considered**:
- A. Automatic resume (rejected: too aggressive, may confuse user)
- B. Manual check with command (rejected: easy to forget)
- C. Hook with prompt (chosen: surfaces at the right time, user controls)

**Rationale**: The hook fires at session start, surfacing interrupted work without forcing action. User stays in control.

---

## Decision 11: Plan Status States

**Context**: Need to track plan progression through stages.

**Decision**: Use these states in order:
1. `drafting` - Brainstorming in progress
2. `approved` - Plan approved, ready for project split
3. `project_split` - Stage 1 complete
4. `decomposing` - Stage 2 in progress
5. `ready` - All tasks atomic, ready for execution
6. `executing` - Workers running
7. `completed` - All done

Plus error states:
- `interrupted` - Session ended unexpectedly during drafting
- `failed` - Execution failed
- `paused` - Manually paused

**Rationale**: This mirrors the flow stages and provides clear state machine for hooks and UI.

---

## Decision 12: Decomp Invocation Syntax

**Context**: How should users invoke decomposition? The design shows "decompose 1" or "decompose backend".

**Decision**: Support multiple invocation patterns:
- `/decomp p-abc123` - Decompose entire plan (project split)
- `/decomp t-def456` - Decompose specific task
- "decompose 1" / "decompose backend" - Natural language in conversation after viewing plan

**Implementation**: The decomp skill parses the argument:
- If starts with `p-` → plan decomposition
- If starts with `t-` → task decomposition
- Otherwise → interpret as project name or number from current context

**Rationale**: Flexibility in invocation makes the skill more natural to use.

---

## Decision 13: Where to Store plan-sync Agent

**Context**: The plan-sync agent needs a definition file.

**Decision**: Create `.claude/agents/plan-sync.md` with haiku model.

**Rationale**: Follows existing pattern for agent definitions.

---

## Decision 14: When Main Agent Triggers plan-sync

**Context**: Main planner agent needs to know when to extract and delegate.

**Decision**: Include extraction triggers in the planner skill prompt:
- After any decision is made
- After requirements are clarified
- After questions are resolved
- After scope is identified

The skill prompt instructs the agent to spawn plan-sync with structured payload when these triggers occur.

**Alternatives Considered**:
- A. Skill prompt instructions (chosen: flexible, context-aware)
- B. Automatic detection with regex (rejected: too rigid)
- C. User-triggered sync (rejected: too manual)

**Rationale**: The LLM is good at recognizing conversational patterns. Giving it trigger guidelines is more robust than regex matching.

---

## Implementation Order

Based on dependencies, build in this order:

1. **plan-sync agent** - Needed by planner
2. **planner skill (refactored)** - Core brainstorming flow
3. **plan-viewer command** - View plans at any point
4. **PreCompact hook** - Safety net for compaction
5. **decomp skill (refactored)** - Two-stage decomposition
6. **SessionStart hook for resume** - Detect interrupted plans
7. **Update oob-flow.md** - Mark implementation complete

---

## Questions Deferred to User

These decisions were made with best judgment but may need user input:

1. **Plan file format**: Kept as markdown (plan.md). Should there be YAML frontmatter for metadata?
   - **My decision**: No frontmatter. Keep plan.md pure prose. Metadata in state.json.

2. **Decomp output format**: ASCII boxes vs simple lists?
   - **My decision**: ASCII boxes as shown in design doc.

3. **Contract enforcement**: Should contracts be validated before execution?
   - **My decision**: Defer to execution phase. Document contracts but don't block.

---

## Implementation Notes

### File Structure After Implementation

```
.claude/
├── agents/
│   ├── plan-sync.md         # NEW: Haiku agent for document sync
│   ├── readme-writer.md     # Existing
│   └── ...
├── skills/
│   ├── planner/
│   │   └── SKILL.md         # REFACTORED: Brainstorm-only mode
│   └── decomp/
│       └── SKILL.md         # REFACTORED: Two-stage decomposition
├── commands/
│   ├── document-projects.md # Existing
│   └── plan.md              # NEW: View plan command
└── hooks/
    └── hooks.json           # UPDATED: Add planning hooks
```

### Storage Structure

```
.backlog/
└── p-{id}/
    ├── plan.md              # Brainstorm synthesis (Stage 0 output)
    ├── tasks.jsonl          # Tasks at all levels (Stage 1+)
    ├── state.json           # Plan metadata
    ├── events.jsonl         # Activity log
    └── contexts/            # Worker contexts (execution)
```

---

*Document created: 2026-01-12*
*Last updated: During overnight implementation*
