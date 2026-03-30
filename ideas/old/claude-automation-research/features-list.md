# Coding Agent: Feature List

All features are designed to be **generic** and work with any project, not just the RTS Labs template repo.

---

## 1. Planning System ✅
**Status:** Designed (see `planning-system.md`)

- File-based storage in `.rtslabs/`
- JSONL format for tasks, verification, events
- Template system with variable substitution
- Hash-based IDs for conflict prevention
- Git-native (version controlled with code)

---

## 2. Decomposition Engine

Transform high-level requests into atomic, executable tasks.

- LLM-powered task breakdown
- Template matching and instantiation
- Iterative refinement (human requests further decomposition)
- Dependency graph generation
- Acceptance criteria generation
- Atomic task detection (knows when to stop decomposing)

---

## 3. Execution Engine

Orchestrate parallel task execution.

- Worker pool management
- Claude Code SDK integration
- Task dependency-aware scheduling
- Parallel execution of independent tasks
- Sequential execution when dependencies require
- Pause/resume capability
- Progress tracking and reporting

---

## 4. Verification System

Multi-layered validation for each task.

**Layer 1: Self-Verification**
- Task writes its own tests
- Tests must pass before completion

**Layer 2: Quick Validation**
- Cheap model (Haiku/Ollama) checks code matches intent
- Fast, runs in parallel with next task

**Layer 3: Phase Gates**
- Full test suite at milestones
- Type checking
- Lint checking

**Layer 4: Final Review**
- Review agent analyzes full diff
- Security scan
- Summary generation for human

**QA Loops**
- Automatic retry on verification failure
- Feedback from failure informs retry
- Max attempt limits
- Escalation to human on repeated failure

**Red-Flag Detection**
- Detect confused/rambling responses
- Discard and retry flagged outputs
- Based on response length, format errors

---

## 5. Git Manager

Handle all git operations for plan execution.

- Worktree creation per plan
- Branch management (`plan/{id}-{slug}`)
- Commit per completed task
- Commit message formatting
- Merge handling on approval
- Worktree cleanup (manual trigger)

---

## 6. Memory System

Learn from execution to improve future runs.

**Patterns**
- Successful approaches for this project
- Code style preferences
- Common solutions

**Gotchas**
- Pitfalls encountered
- Import issues, config quirks
- Things that failed and why

**Session Insights**
- Per-plan learnings
- What worked/failed
- Recommendations for future

**Application**
- Inject relevant patterns into task context
- Warn about known gotchas
- Improve prompts based on history

---

## 7. Project Analyzer

Understand any project's structure and patterns.

- Stack detection (NestJS, React, Express, etc.)
- Package manager detection (npm, yarn, pnpm)
- Test framework detection (Jest, Vitest, etc.)
- Database detection (PostgreSQL, MongoDB, etc.)
- Existing pattern discovery
- File structure analysis
- Context building for Claude prompts

---

## 8. LLM Router

Direct requests to the appropriate model.

| Task Type | Model | Why |
|-----------|-------|-----|
| Code execution | Claude Code SDK | Full tool use |
| Quick validation | Haiku / Ollama | Fast, cheap |
| Decomposition | Sonnet | Reasoning |
| Final review | Sonnet / Opus | Comprehensive |
| Compaction | Haiku | Simple summarization |

- Cost optimization
- Provider abstraction (OpenAI, Anthropic, Ollama)
- Fallback handling

---

## 9. Web UI

User interface for all interactions.

**Plan Creation**
- Text input for request
- File/image attachments
- Template selection

**Plan Editing**
- Task tree visualization
- Decompose button per task
- Edit task details
- Dependency visualization

**Execution Monitoring**
- Real-time progress
- Worker status
- Live logs
- Task completion stream

**Review Interface**
- Summary display
- Diff viewer
- Review agent notes
- Approve/reject actions

**WebSocket Events**
- Task started/completed/failed
- Worker status changes
- Verification results
- Phase gate results

---

## 10. Configuration System

Customize behavior per project.

**Project Config (`.rtslabs/config.json`)**
- Max workers
- Model preferences
- Test/lint/typecheck commands
- Verification layers to use

**Templates (`.rtslabs/templates/`)**
- Project-specific templates
- Override default templates
- Custom variable definitions

**Global Defaults**
- Service-level defaults
- Applied when project config missing

---

## Feature Dependencies

```
┌─────────────────────┐
│  Configuration      │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Project Analyzer   │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  Planning System    │◄─── Templates
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ Decomposition Engine│
└──────────┬──────────┘
           │
┌──────────▼──────────┐     ┌─────────────┐
│  Execution Engine   │◄────│ LLM Router  │
└──────────┬──────────┘     └─────────────┘
           │
     ┌─────┴─────┐
     │           │
┌────▼───┐ ┌────▼────────┐
│Git Mgr │ │Verification │
└────────┘ └──────┬──────┘
                  │
           ┌──────▼──────┐
           │Memory System│
           └─────────────┘
```

---

## Implementation Priority

### Phase 1: MVP
1. Planning System ✅
2. Configuration System
3. Decomposition Engine (basic)
4. Execution Engine (single worker)
5. Git Manager (basic)
6. Verification (self only)
7. Web UI (basic)

### Phase 2: Parallel & Verification
1. Execution Engine (worker pool)
2. Verification (all layers)
3. QA Loops
4. Web UI (real-time)

### Phase 3: Intelligence
1. Project Analyzer
2. Memory System
3. LLM Router (optimization)
4. Red-flag Detection

### Phase 4: Polish
1. Template library
2. Multi-project support
3. Team features
4. Performance optimization
