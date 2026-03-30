# Auto-Claude: Deep Technical Analysis

A comprehensive reference document analyzing the Auto-Claude autonomous coding framework (v2.7.2) to extract patterns, concepts, and architectural decisions relevant to building similar systems.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Agent Types & Roles](#agent-types--roles)
4. [Workflow System](#workflow-system)
5. [Session & State Management](#session--state-management)
6. [Memory System](#memory-system)
7. [Verification & QA System](#verification--qa-system)
8. [Recovery & Error Handling](#recovery--error-handling)
9. [Security Architecture](#security-architecture)
10. [Prompt Engineering](#prompt-engineering)
11. [Key Patterns & Insights](#key-patterns--insights)
12. [Relevant Concepts for Our System](#relevant-concepts-for-our-system)

---

## Executive Summary

Auto-Claude is a **multi-agent autonomous coding framework** that implements a spec → plan → execute → QA workflow. Key innovations:

- **Dynamic pipeline complexity** - 3-8 phase pipelines based on task complexity
- **Subtask-based decomposition** - Work broken into atomic, independently-completable units
- **Dual-layer memory** - Graphiti knowledge graph + file-based fallback for cross-session learning
- **Iterative QA loops** - Up to 50 review-fix iterations with automatic escalation
- **Session-based architecture** - Fresh context per session, state persisted in files

**Tech Stack:**
- Backend: Python 3.10+ (451 files)
- Frontend: Electron + React + TypeScript (701 files)
- AI Integration: Claude Agent SDK (not raw API)
- Memory: Graphiti (LadybugDB embedded graph database)
- Isolation: Git worktrees for parallel builds

---

## Architecture Overview

### Repository Structure

```
Auto-Claude/
├── apps/
│   ├── backend/                 # Python CLI & agent system
│   │   ├── agents/              # Core agent implementations
│   │   ├── cli/                 # Command-line interface
│   │   ├── core/                # Client factory, auth, config
│   │   ├── integrations/        # Graphiti, Linear, GitHub
│   │   ├── implementation_plan/ # Plan data models
│   │   ├── memory/              # Session memory handling
│   │   ├── merge/               # Conflict resolution
│   │   ├── prompts/             # Agent prompt templates
│   │   ├── prompts_pkg/         # Prompt assembly logic
│   │   ├── qa/                  # QA reviewer/fixer system
│   │   ├── recovery.py          # Recovery manager
│   │   ├── review/              # Approval state management
│   │   ├── runners/             # Spec runners, GitHub/GitLab
│   │   ├── security/            # Multi-layer security
│   │   ├── services/            # Business logic services
│   │   ├── spec/                # Spec creation pipeline
│   │   └── task_logger/         # Execution logging
│   └── frontend/                # Electron desktop UI
│       ├── src/main/            # Electron main process
│       ├── src/renderer/        # React UI components
│       └── src/shared/          # Shared utilities, i18n
├── guides/                      # Documentation
├── tests/                       # Test suite
└── scripts/                     # Build utilities
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INPUT                                │
│              (Task description, attachments)                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SPEC CREATION PIPELINE                        │
│                                                                  │
│  Complexity Assessment → Dynamic Phase Selection (3-8 phases)   │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐  ┌────────────────┐ │
│  │Discovery │→ │Requirements│→ │Research │→ │Context Analysis│ │
│  └──────────┘  └────────────┘  └─────────┘  └────────────────┘ │
│                                                                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────────────────┐ │
│  │Spec Write│→ │Self-Critique│→ │    Planning (subtasks)     │ │
│  └──────────┘  └────────────┘  └─────────────────────────────┘ │
│                                                                  │
│  Outputs: spec.md, requirements.json, context.json,             │
│           project_index.json, implementation_plan.json          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HUMAN APPROVAL GATE                           │
│                                                                  │
│  Review spec.md + implementation_plan.json                      │
│  Options: Approve / Edit / Add Feedback / Reject                │
│                                                                  │
│  Hash-based change detection prevents unauthorized builds        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION ENGINE                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    PLANNER AGENT                          │   │
│  │  Creates/refines implementation_plan.json                │   │
│  │  Defines subtasks with dependencies                       │   │
│  └──────────────────────────┬────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    CODER AGENT (Loop)                     │   │
│  │                                                           │   │
│  │  For each subtask:                                       │   │
│  │    1. Load fresh context (spec, plan, memory)            │   │
│  │    2. Implement subtask                                   │   │
│  │    3. Update plan status → "completed"                   │   │
│  │    4. Commit changes                                      │   │
│  │    5. Save session insights                               │   │
│  │                                                           │   │
│  │  Can spawn subagents for parallel work                   │   │
│  └──────────────────────────┬────────────────────────────────┘   │
│                              │                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    QA VALIDATION LOOP                            │
│                                                                  │
│  ┌─────────────────┐      ┌─────────────────┐                  │
│  │  QA REVIEWER    │─────▶│   QA FIXER      │                  │
│  │                 │      │                 │                  │
│  │  - Validates    │      │  - Fixes issues │                  │
│  │    acceptance   │◀─────│  - Re-tests     │                  │
│  │    criteria     │      │  - Updates plan │                  │
│  │  - Runs tests   │      │                 │                  │
│  │  - Browser QA   │      └─────────────────┘                  │
│  └─────────────────┘                                            │
│                                                                  │
│  Loop until: Approved OR Max 50 iterations OR Escalation        │
│  Escalation triggers: 3+ recurring issues, 3+ consecutive errors│
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HUMAN REVIEW & MERGE                          │
│                                                                  │
│  User can: View diff, run tests locally, request changes        │
│  Merge command: python run.py --spec 001 --merge                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Types & Roles

### Tier 1: Implementation Agents

#### Planner Agent
**Location:** `/apps/backend/agents/planner.py`

**Responsibilities:**
- Creates subtask-based implementation plans respecting dependencies
- Analyzes existing codebase patterns before planning
- Structures work in logical phases for the Coder Agent
- Handles follow-up planning for completed specs

**Tool Access:** Read, Write, Bash, WebFetch, WebSearch + Context7, Graphiti, Auto-Claude MCP

**Thinking Budget:** High (extended thinking enabled)

**Output:** `implementation_plan.json` with pending subtasks

---

#### Coder Agent
**Location:** `/apps/backend/agents/coder.py`

**Responsibilities:**
- Implements one subtask at a time (fresh context per session)
- Updates `implementation_plan.json` with completion status
- Can spawn **subagents** (via SDK's Task tool) for parallel work
- Records discoveries and gotchas in session memory
- Commits work with generated commit messages
- Handles recovery for stuck/failed subtasks

**Tool Access:** Full file operations (Read, Write, Edit, Bash, Glob, Grep) + WebFetch + Graphiti memory

**Thinking Budget:** None (no extended thinking for coding)

**Key Insight:** Fresh context per session prevents context pollution. All knowledge comes from files and memory system.

---

#### QA Reviewer Agent
**Location:** `/apps/backend/qa/reviewer.py`

**Responsibilities:**
- Validates implementation against acceptance criteria
- Runs automated tests (unit, integration, E2E)
- Checks browser console errors (web apps)
- Verifies no broken existing functionality
- Can use Electron/Puppeteer MCP tools for UI testing
- Rejects with detailed issues if validation fails

**Tool Access:** Read, Write, Edit, Bash, WebFetch + Context7, Graphiti + Browser MCP

**Thinking Budget:** High

**Output:** `qa_report.md` and `QA_FIX_REQUEST.md` if issues found

---

#### QA Fixer Agent
**Location:** `/apps/backend/qa/fixer.py`

**Responsibilities:**
- Fixes issues identified by QA Reviewer
- Runs targeted fixes without full rebuild
- Re-tests fixed areas
- Handles edge cases discovered during QA
- Loops with Reviewer until approval (max 50 iterations)

**Tool Access:** Full file operations + Graphiti memory + Browser MCP

**Thinking Budget:** Medium

**Input:** `QA_FIX_REQUEST.md`

---

### Tier 2: Specification Agents

| Agent | Location | Purpose |
|-------|----------|---------|
| Spec Gatherer | `prompts/spec_gatherer.md` | Collects user requirements interactively |
| Spec Researcher | `prompts/spec_researcher.md` | Validates external integrations and APIs |
| Spec Writer | `prompts/spec_writer.md` | Creates comprehensive `spec.md` document |
| Spec Critic | `prompts/spec_critic.md` | Self-critique using ultrathink |
| Discovery Agent | `spec/phases/discovery_phases.py` | Analyzes project structure |
| Context Agent | `spec/phases/` | Identifies relevant files for the task |

---

### Tier 3: Utility Agents

| Agent | Purpose |
|-------|---------|
| Insight Extractor | Analyzes session outcomes, extracts patterns/gotchas |
| PR Reviewer | Reviews GitHub PRs for quality |
| PR Orchestrator | Orchestrates parallel PR analysis |
| Follow-up Planner | Adds to existing completed specs |

---

### Agent Tool Permissions

**Defined in:** `/apps/backend/agents/tools_pkg/models.py` (AGENT_CONFIGS)

| Phase | Base Tools | MCP Tools |
|-------|-----------|-----------|
| Spec Creation | Read, Glob, Grep, WebFetch, WebSearch | Context7 |
| Build/Coding | Read, Write, Edit, Bash, Glob, Grep, WebFetch | Context7, Graphiti, Auto-Claude |
| QA Validation | All of Build + Browser automation | Puppeteer (web), Electron (desktop) |
| Utility | Minimal or text-only | Varies |

---

## Workflow System

### Workflow Types

**Location:** `/apps/backend/implementation_plan/enums.py`

```python
class WorkflowType(str, Enum):
    FEATURE = "feature"              # Multi-service feature
    REFACTOR = "refactor"            # Stage-based refactoring
    INVESTIGATION = "investigation"  # Bug hunting
    MIGRATION = "migration"          # Data pipeline migration
    SIMPLE = "simple"                # Single-service quick task
```

### Phase Structures by Workflow Type

#### FEATURE Workflow (Multi-Service Features)
```
1. Backend/API Phase (can be tested with curl)
2. Worker Phase (background jobs, depend on backend)
3. Frontend Phase (UI components, depend on backend APIs)
4. Integration Phase (wire everything together)
```

#### REFACTOR Workflow
```
1. Add New Phase (build new system alongside old)
2. Migrate Phase (move consumers to new system)
3. Remove Old Phase (delete deprecated code)
4. Cleanup Phase (polish and verify)
```

#### INVESTIGATION Workflow (Bug Hunting)
```
1. Reproduce Phase (create reliable reproduction, add logging)
2. Investigate Phase (analyze, form hypotheses → output: root cause)
3. Fix Phase (implement solution, BLOCKED until phase 2 completes)
4. Harden Phase (add tests, prevent recurrence)
```

#### MIGRATION Workflow
```
1. Prepare Phase (write scripts, setup)
2. Test Phase (small batch, verify)
3. Execute Phase (full migration)
4. Cleanup Phase (remove old, verify)
```

---

### Spec Creation Pipeline

**Location:** `/apps/backend/spec/pipeline/orchestrator.py`

Dynamic 3-8 phase pipeline based on task complexity:

| Complexity | Phases |
|------------|--------|
| SIMPLE | Discovery → Quick Spec → Validate (3 phases) |
| STANDARD | Discovery → Requirements → [Research] → Context → Spec → Plan → Validate (6-7 phases) |
| COMPLEX | Full pipeline with Research and Self-Critique (8 phases) |

**Complexity Assessment:**
- Can be AI-assessed using `complexity_assessor.md` prompt
- Or manually overridden via CLI flag

---

### Implementation Plan Structure

**Location:** `/apps/backend/implementation_plan/plan.py`

```python
@dataclass
class ImplementationPlan:
    feature: str                    # Feature name
    workflow_type: WorkflowType     # Type classification
    services_involved: list[str]    # Affected services
    phases: list[Phase]             # Ordered phases with subtasks
    final_acceptance: list[str]     # Overall success criteria
    created_at: str                 # Timestamp
    updated_at: str                 # Last modified
    status: str                     # backlog, in_progress, ai_review, human_review, done
    planStatus: str                 # pending, in_progress, review, completed
    qa_signoff: QASignoff | None    # QA validation status
```

### Subtask Structure

```python
@dataclass
class Subtask:
    id: str                         # Unique ID
    description: str                # What to do
    status: SubtaskStatus           # pending, in_progress, completed, blocked, failed

    # Scoping
    service: str | None             # Which service (backend, frontend, worker)
    all_services: bool              # True for integration subtasks

    # Files
    files_to_modify: list[str]      # Files to change
    files_to_create: list[str]      # Files to create
    patterns_from: list[str]        # Reference files with patterns to copy

    # Verification
    verification: Verification      # How to verify completion

    # Investigation (for INVESTIGATION workflow)
    expected_output: str | None     # Knowledge/decision to produce
    actual_output: str | None       # What was discovered
```

---

## Session & State Management

### Session Architecture

**Key Principle:** Fresh context per session - no memory bleeding between sessions

**Session Flow:**
1. Load context from files (spec.md, implementation_plan.json, context.json)
2. Retrieve relevant memory from Graphiti
3. Execute agent session via Claude SDK
4. Stream messages and tool calls
5. Post-session: Save insights, update plan, record commits

**Location:** `/apps/backend/agents/session.py`

```python
async def run_agent_session(client, prompt, spec_dir):
    # Session starts with prompt to Claude Agent SDK
    async for message in client.receive_response():
        # Process AssistantMessage (text + tool use)
        # Process UserMessage (tool results)

    # Post-session processing
    await post_session_processing(spec_dir, subtask_id, session_num)
```

---

### State Persistence

#### Spec Directory Structure (Central State)

```
.auto-claude/specs/001-feature/
├── spec.md                          # Feature specification
├── implementation_plan.json         # Central state container
├── context.json                     # Discovered codebase context
├── project_index.json               # Service/file catalog
├── requirements.json                # Parsed requirements
├── review_state.json                # Approval status + hash
├── task_logs.json                   # Real-time execution logs
├── task_metadata.json               # Per-task config overrides
├── qa_report.md                     # QA validation results
├── QA_FIX_REQUEST.md                # Issues for fixer
│
├── memory/
│   ├── attempt_history.json         # Subtask attempt tracking
│   ├── build_commits.json           # Good commits for rollback
│   └── session_insights/
│       ├── session_001.json         # Session 1 learnings
│       ├── session_002.json         # Session 2 learnings
│       └── ...
│
└── .git/                            # Worktree for isolated builds
```

---

### Review State (Approval Tracking)

**Location:** `/apps/backend/review/state.py`

```python
@dataclass
class ReviewState:
    approved: bool
    approved_by: str                # username or 'auto'
    approved_at: str                # ISO timestamp
    feedback: list[str]             # Historical feedback with timestamps
    spec_hash: str                  # MD5 hash for change detection
    review_count: int
```

**Key Feature:** Hash-based change detection prevents building if spec changes after approval.

---

## Memory System

### Dual-Layer Architecture

**Primary: Graphiti** (Knowledge Graph)
- Semantic graph database with embedded LadybugDB (no Docker required)
- Stores episodes: SESSION_INSIGHT, PATTERN, GOTCHA, TASK_OUTCOME, CODEBASE_DISCOVERY
- Multi-provider LLM support (OpenAI, Anthropic, Ollama, Azure, Google AI)
- Cross-session learning through semantic retrieval

**Fallback: File-Based Memory**
- JSON files in `memory/session_insights/`
- Zero dependencies, always available
- Graceful fallback when Graphiti disabled or fails

**Location:** `/apps/backend/agents/memory_manager.py`

---

### Session Insight Structure

```json
{
    "session_number": 1,
    "timestamp": "2024-01-15T10:30:00Z",
    "subtasks_completed": ["001-create-user-model"],
    "discoveries": {
        "files_understood": {
            "app/models/user.py": "User entity with email and password"
        },
        "patterns_found": [
            "All models inherit from BaseModel",
            "Services use dependency injection"
        ],
        "gotchas_encountered": [
            "Email validation requires custom validator"
        ]
    },
    "what_worked": ["Using existing auth pattern from app/auth/"],
    "what_failed": ["Initial attempt without proper imports"],
    "recommendations_for_next_session": [
        "Check app/auth/oauth.py for token handling pattern"
    ]
}
```

---

### Memory Retrieval Flow

```python
def get_context_for_session(spec_dir, subtask_id):
    # 1. Try Graphiti first
    try:
        memory = GraphitiMemory()
        patterns = memory.get_patterns(project_id)
        gotchas = memory.get_gotchas(project_id)
        history = memory.get_session_history(spec_id, limit=3)
    except GraphitiUnavailable:
        # 2. Fall back to file-based
        patterns = load_patterns_from_file(spec_dir)
        gotchas = load_gotchas_from_file(spec_dir)
        history = load_recent_sessions(spec_dir, limit=3)

    return {"patterns": patterns, "gotchas": gotchas, "history": history}
```

---

## Verification & QA System

### QA Validation Loop

**Location:** `/apps/backend/qa/loop.py`

```
QA Reviewer → Approved? → DONE
     │
     ├─ Rejected → QA Fixer → Re-validate (loop)
     │
     └─ Escalation triggers:
        - 3+ recurring issues (same issue 3 times)
        - 3+ consecutive agent errors
        - Max 50 iterations reached
```

**Key Constants:**
- `MAX_QA_ITERATIONS = 50`
- `RECURRING_ISSUE_THRESHOLD = 3`
- `CONSECUTIVE_ERROR_LIMIT = 3`

---

### QA Signoff Structure

```json
{
  "qa_signoff": {
    "status": "approved|rejected|fixes_applied",
    "qa_session": 1,
    "issues_found": [
      {
        "title": "Test failure in user service",
        "file": "tests/test_user.py",
        "line": 42,
        "severity": "error",
        "description": "Assertion failed: expected 200, got 404"
      }
    ],
    "tests_passed": {
      "unit": "15/15",
      "integration": "8/8",
      "e2e": "3/3"
    },
    "timestamp": "2024-01-15T12:00:00Z",
    "ready_for_qa_revalidation": false
  }
}
```

---

### Recurring Issue Detection

```python
def is_recurring_issue(issue, history):
    """Check if issue appeared 3+ times"""
    # Normalize key: title + file + line
    key = normalize_issue_key(issue)

    # Count occurrences across iterations
    occurrences = sum(1 for h in history if key in h.issues)

    # 80% similarity threshold for fuzzy matching
    return occurrences >= 3
```

---

### Verification Types

**Location:** `/apps/backend/implementation_plan/verification.py`

```python
class VerificationType:
    NONE = "none"           # No verification needed
    MANUAL = "manual"       # Manual review required
    COMMAND = "command"     # Run build/test command
    API = "api"             # HTTP request validation
    BROWSER = "browser"     # UI testing (Electron/Puppeteer MCP)
```

**Verification Fields:**
- `run` - Command to execute
- `url` - API endpoint
- `method` - HTTP method
- `expect_status` - Expected HTTP status code
- `expect_contains` - Expected response content
- `scenario` - Description for manual testing

---

## Recovery & Error Handling

### Recovery Manager

**Location:** `/apps/backend/services/recovery.py`

**Tracks:**
- Attempt history per subtask
- Last good commit for rollback
- Stuck subtasks for escalation

---

### Failure Classification

```python
class FailureType:
    BROKEN_BUILD = "code doesn't compile"
    VERIFICATION_FAILED = "test didn't pass"
    CIRCULAR_FIX = "same fix tried repeatedly"
    CONTEXT_EXHAUSTED = "ran out of context"
    UNKNOWN = "unknown error"
```

---

### Recovery Actions

```python
class RecoveryAction:
    ROLLBACK = "rollback"       # Return to last_good_commit
    RETRY = "retry"             # Attempt with different approach (max 3)
    SKIP = "skip"               # Mark as stuck, escalate
    ESCALATE = "escalate"       # Human intervention required
    CONTINUE = "continue"       # Commit progress, continue next session
```

---

### Circular Fix Detection

```python
def is_circular_fix(current_approach, attempt_history):
    """Detect if same approach repeated in last 3 attempts"""
    recent = attempt_history[-3:]

    for attempt in recent:
        # 30% keyword overlap = same approach
        similarity = jaccard_similarity(
            extract_keywords(current_approach),
            extract_keywords(attempt.approach)
        )
        if similarity > 0.3:
            return True

    return False
```

---

### Attempt History Structure

```json
{
    "subtasks": {
        "001-create-auth": {
            "attempts": [
                {
                    "session": 1,
                    "timestamp": "2024-01-15T10:00:00Z",
                    "approach": "Added basic auth middleware",
                    "success": false,
                    "error": "Missing JWT validation"
                },
                {
                    "session": 2,
                    "timestamp": "2024-01-15T10:30:00Z",
                    "approach": "Added JWT validation with pyjwt",
                    "success": true,
                    "error": null
                }
            ],
            "status": "completed"
        }
    },
    "stuck_subtasks": []
}
```

---

## Security Architecture

### Three-Layer Defense Model

**Layer 1: OS Sandbox**
- Bash commands run in isolated environment
- No shell metacharacters (pipes, redirects)
- Prevents filesystem escape attacks

**Layer 2: Filesystem Restrictions**
- Operations limited to project directory only
- `.claude_settings.json` enforces paths
- Worktree permissions for spec worktrees

**Layer 3: Dynamic Command Allowlist**
- Security profiles cached in `.auto-claude-security.json`
- Bash command validation via `bash_security_hook`
- Project stack detection (React, Django, Python, Node.js)

**Allowed:** npm, pip, pytest, gradle, etc.
**Blocked:** bash, sh, zsh, dangerous shell operations

---

### Custom MCP Server Validation

```python
SAFE_COMMANDS = ["npx", "npm", "node", "python", "python3", "uv", "uvx"]
BLOCKED_COMMANDS = ["bash", "sh", "cmd", "powershell"]
DANGEROUS_FLAGS = ["-c", "--eval", "-e"]

def validate_mcp_command(command):
    # Check against allowlist
    # Block path traversal
    # Prevent code injection
    # No dangerous interpreter flags
```

---

## Prompt Engineering

### Dynamic Prompt Assembly

**Location:** `/apps/backend/prompts_pkg/prompts.py`

Prompts are templates with **runtime injection**:

```python
def get_planner_prompt(spec_dir: Path) -> str:
    """Load planner prompt and inject spec path"""
    base_prompt = load_prompt("planner.md")

    spec_context = f"""## SPEC LOCATION
Your spec file is located at: `{spec_dir}/spec.md`

CRITICAL FILE CREATION INSTRUCTIONS:
- `{spec_dir}/implementation_plan.json` - Subtask-based plan
- `{spec_dir}/build-progress.txt` - Progress notes
"""
    return spec_context + base_prompt
```

---

### Project Capability Detection

```python
def detect_project_capabilities(project_index: dict) -> dict:
    """Detect MCP tools relevant for this project"""
    return {
        "is_electron": bool,      # Electron app framework
        "is_web_frontend": bool,  # Web frontend (React, Vue)
        "is_nextjs": bool,        # Next.js
        "has_api": bool,          # API endpoints
        "has_database": bool,     # Database connections
    }
```

**Use case:** QA prompt for Electron app gets Electron MCP tools; Python CLI doesn't.

---

### Prompt Types

| Prompt | Purpose | Thinking |
|--------|---------|----------|
| `planner.md` | Creates implementation plans | High |
| `coder.md` | Implements subtasks | None |
| `coder_recovery.md` | Recovers stuck subtasks | Medium |
| `qa_reviewer.md` | Validates acceptance criteria | High |
| `qa_fixer.md` | Fixes QA issues | Medium |
| `followup_planner.md` | Adds to completed specs | High |
| `spec_*.md` | Spec creation phases | Varies |

---

## Key Patterns & Insights

### 1. Spec as Shared Memory

All agents read/write the same spec directory. The `implementation_plan.json` serves as both **specification AND execution log**.

**Benefits:**
- No inter-agent communication needed
- State survives agent crashes
- Easy debugging (inspect JSON)
- Natural audit trail

---

### 2. Fresh Context Per Session

Each Coder session starts with empty context and loads from files:
- `spec.md` - What to build
- `implementation_plan.json` - What's done, what's next
- `context.json` - Relevant files
- Memory system - Patterns, gotchas from past sessions

**Benefits:**
- No context pollution between subtasks
- Each session is independently reproducible
- Easier debugging and retry

---

### 3. Subtask-Based Decomposition (Not Test-Driven)

Unlike TDD approaches, Auto-Claude focuses on **implementation order**:
- Dependencies between services determine phase order
- Each subtask is independently completable
- Verification defined per subtask (not global test suite)

---

### 4. Dual-Layer Persistence

Always save to files first (reliable), optionally to Graphiti (enhanced):

```python
# Save pattern
try:
    graphiti.save_insight(insight)
except:
    pass  # Graphiti optional

file_memory.save_insight(insight)  # Always succeeds
```

---

### 5. Self-Healing QA Loop

The QA system is designed for **autonomous recovery**:
- Up to 50 iterations before human escalation
- Recurring issues (3+) escalate automatically
- Agents receive context from previous failed attempts

---

### 6. Hash-Based Change Detection

Approval includes spec hash. Any change invalidates approval:

```python
def is_approval_valid(spec_dir):
    state = load_review_state(spec_dir)
    current_hash = hash_spec_files(spec_dir)
    return state.approved and state.spec_hash == current_hash
```

---

### 7. Git Worktrees for Isolation

Each spec executes in isolated worktree:
- Main branch stays clean
- Multiple specs can run in parallel
- Natural rollback via branch deletion
- Preserves developer's local changes

---

## Relevant Concepts for Our System

### Concepts to Adopt

| Concept | Auto-Claude Implementation | Relevance |
|---------|---------------------------|-----------|
| **Dynamic Pipeline Complexity** | 3-8 phases based on task | Prevent over-engineering simple tasks |
| **Subtask-Based Plans** | implementation_plan.json | Natural parallelism, clear dependencies |
| **Fresh Session Context** | Load from files each time | Prevent context pollution, easier retry |
| **Dual-Layer Memory** | Graphiti + file fallback | Reliability with enhanced learning |
| **QA Loop with Escalation** | 50 max iterations, auto-escalate | Autonomous but bounded recovery |
| **Hash-Based Approval** | MD5 of spec files | Prevent building stale specs |
| **Git Worktree Isolation** | Per-spec worktrees | Safe parallel execution |
| **Recovery Manager** | Attempt tracking, rollback | Graceful failure handling |
| **Project Capability Detection** | Dynamic tool injection | Efficient token usage |

### Concepts to Adapt

| Concept | Auto-Claude | Our Adaptation |
|---------|-------------|----------------|
| Electron frontend | Desktop app | Web-based UI for broader access |
| Python backend | CLI-first | NestJS for WebSocket support |
| Graphiti memory | Optional external | Consider simpler embedded options |
| Linear integration | Project management | Could be optional or GitHub-native |

### Concepts to Improve

| Area | Auto-Claude Limitation | Improvement |
|------|----------------------|-------------|
| Parallel execution | Subagent spawning | Dedicated worker pool with coordination |
| Real-time monitoring | IPC to Electron | WebSocket streaming for web UI |
| Human intervention | File-based (HUMAN_INPUT.md) | Interactive web UI during execution |
| Verification layers | Single QA loop | Multi-tier: self-verify → quick check → phase gate → final |

---

## Summary

Auto-Claude demonstrates a mature, production-grade approach to autonomous coding agents:

1. **Spec-Driven:** Everything starts with a clear specification
2. **Decomposition:** Complex tasks broken into atomic subtasks
3. **Isolation:** Git worktrees prevent interference
4. **Memory:** Dual-layer system for reliability + learning
5. **Verification:** Multi-iteration QA with automatic escalation
6. **Recovery:** Comprehensive attempt tracking and rollback
7. **Security:** Three-layer defense with dynamic tool control

The key insight is treating **files as the source of truth** rather than in-memory state. This enables:
- Crash recovery
- Debugging via inspection
- Parallel execution
- Clear audit trails

Our system can build on these patterns while adding:
- Web-based real-time monitoring
- Parallel worker pool (not just subagent spawning)
- Multi-tier verification (not just QA loop)
- More interactive human intervention during execution
