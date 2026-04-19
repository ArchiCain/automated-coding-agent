# Build Plan: Doc-Driven Development

## Pre-Reading: Deep Research Before Starting

Before reading this plan or starting any implementation, the implementing agent MUST read and understand the following sources in order:

### Idea Documents (this repo)
1. `ideas/docs-driven-development.md` — The `.docs/` convention, how docs are the spec, the review workflow
2. `ideas/agent-roster.md` — Historical context on agent roles (superseded by this plan's simpler model)
3. `ideas/mastra-coding-agent-is-the-end-goal.md` — Why Mastra over SDK, memory architecture, multi-agent sharing
4. `ideas/sandbox-agent-loop.md` — Autonomous loop concept, cron-scheduled agents, sandbox lifecycle
5. `ideas/the-dev-team.md` — Full system vision, infrastructure, security model, validation gates, history

### Current Codebase (read the actual source)
1. **Mastra agents (working pattern):** `projects/the-dev-team/backend/app/src/features/mastra-agents/` — agent factory, tools (listDir, readFile, writeFile), gateway streaming, WebSocket events, token tracking via onStepFinish
2. **MCP server tools:** `projects/the-dev-team/backend/app/src/mcp-server.ts` — all git, sandbox, and PR tools. These are the execution layer that Mastra tools will wrap.
3. **Task runner:** `projects/the-dev-team/backend/app/src/features/task-runner/` — Taskfile execution with streaming. The `run_task` tool will call this.
4. **Docs chat bubble (THE template):** `projects/the-dev-team/frontend/app/src/features/docs/docs-chat-bubble.tsx` — WebSocket connection, streaming, tool call visibility, per-step token tracking. This is the pattern to replicate.
5. **Chat components (reusable):** `projects/the-dev-team/frontend/app/src/features/chat/message-list.tsx` and `message-input.tsx` — shared UI components
6. **Docs page:** `projects/the-dev-team/frontend/app/src/features/docs/docs.page.tsx` — project tree, file viewer, code toggle. Shows how the active file path is passed to the agent.

### Pi Tools (external — context-efficient coding tools)
1. **Repository:** `github.com/badlogic/pi-mono`
2. **Tool source:** `packages/coding-agent/src/core/tools/` — read, edit, write, bash, grep, find, ls
3. **Key files to study:**
   - `truncate.ts` — dual truncation (lines + bytes), head/tail modes, continuation hints
   - `edit.ts` + `edit-diff.ts` — multi-edit with fuzzy matching, BOM/CRLF handling, overlap detection
   - `read.ts` — offset/limit pagination with truncation
   - `grep.ts` — ripgrep JSON mode with per-line truncation
   - `file-mutation-queue.ts` — serializes concurrent writes to same file
4. **What to extract:** The truncation module, edit-diff logic, and the Operations abstraction pattern. Skip the TUI rendering, bash tool (we use `run_task` instead), and TypeBox schemas (convert to Zod for Mastra).

### Mastra Reference
1. **Token Limiter Processor:** `https://mastra.ai/reference/processors/token-limiter-processor` — Mastra has built-in token limiting. Use this to enforce the 100k budget natively.

---

## Summary

Build a doc-driven development system where agents continuously sync code to `.docs/` specifications. The system has five agent types, a deterministic pipeline for deployment/testing, and an agent relay pattern that lets work span multiple 100k-token sessions.

**Agent types:**
- **Doc Assistant** — curates docs, compares against code reality, flags gaps
- **Syncing Agent** — reads `.docs/`, reads code, makes code match docs. One feature = one agent. Its "role" (frontend, backend, etc.) emerges from the project's `.docs/` it reads.
- **History Agent** — git archaeologist, traces decisions, explains feature evolution
- **Tester Agent** — tests features in deployed sandboxes (Playwright for frontend, API calls for backend)
- **PR Reviewer Agent** — reviews PRs against `.docs/` spec + code quality

**Deterministic pipeline** (no LLM needed):
- Worktree/branch creation before agent starts
- Sandbox deployment after syncing agent commits
- PR creation after tests pass
- Environment branch deployment after PR merge

---

## Core Principles

1. **Docs are the spec.** The delta between `.docs/` and code defines all work.
2. **100k context is the session limit, not the feature limit.** When an agent hits the wall, a fresh agent picks up where it left off via the relay pattern.
3. **No raw bash.** Agents execute only Taskfile tasks through a scoped `run_task` tool.
4. **Token monitoring is the control plane.** Every step's token usage is visible and tracked.
5. **Manual first, automate later.** Chat bubbles let you test agents before wiring up the autonomous loop.
6. **Haiku everywhere.** Prove the architecture works with the cheapest model. Upgrade later where needed.
7. **Context is the agent's identity.** A syncing agent pointed at a frontend feature dir reads the frontend project's `.docs/` and becomes a frontend agent. No predefined roles.
8. **Commit frequently.** Commits are the handoff mechanism between agent sessions and the raw material for the history agent.
9. **Deterministic steps are not agent steps.** Worktree creation, sandbox deployment, PR creation, and environment deployment are all deterministic — no LLM needed.

---

## Branch Hierarchy

```
main                              ← production, protected
  └── local-scain                 ← environment branch (DEPLOY_BRANCH), deployed on laptop
        ├── feature/auth          ← syncing agent worktree, PRs to local-scain
        ├── feature/user-mgmt     ← another syncing agent, different feature
        └── feature/dashboard     ← etc.
```

### Rules

- `DEPLOY_BRANCH` env var (e.g., `local-scain`) is the active environment branch
- Feature branches are created off `DEPLOY_BRANCH`
- Feature branches PR back into `DEPLOY_BRANCH`
- `DEPLOY_BRANCH` periodically rebases off `main` to stay current
- In a team/prod setup: `staging`, `production` as environment branches with the same pattern
- GitHub Actions deploys environment branches on merge (except local — manual deploy)
- The MCP server's `create_worktree` takes `baseBranch` — default it to `DEPLOY_BRANCH`

### Branch Naming

```
feature/{feature-name}       ← syncing agent work
```

The feature name comes from the directory path. `projects/application/frontend/app/src/features/auth/` → branch `feature/auth`. If the same feature name exists across frontend and backend, disambiguate: `feature/frontend-auth`, `feature/backend-auth`.

---

## Agent Roster

### Doc Assistant

Already exists. Curates documentation by comparing docs against code reality.

**Job:** Read code, compare to `.docs/`, answer: Are the docs true? Are they clear? Are there gaps? Update docs to match reality or flag where reality should change to match docs.

**Tools:** read_file, search_content, search_files, list_dir, edit_file, write_file, git read-only

**Docs access:** All docs — requirements.md, flows.md, test-instructions.md, standards/, overview.md

**System instructions (concise):**
```
You are a documentation assistant for a doc-driven development system.
Your job is to curate .docs/ specifications by comparing them against the actual code.

When reviewing a feature:
1. Read the project-level .docs/ (overview, standards) for conventions
2. Read the feature's .docs/ (requirements, flows, test-instructions)
3. Read the feature's source code
4. Compare: Are the docs accurate? Are there gaps? Is anything unclear?
5. Update docs or flag issues

You read ALL doc types including test-instructions.md.
Be deliberate about what you read — you have a limited context window.
```

### Syncing Agent

The core of the system. One syncing agent per feature. Its "role" (frontend, backend, etc.) emerges from the project's `.docs/` it reads at the start of each session.

**Job:** Make code match `.docs/`. Read project-level docs to understand conventions and patterns. Read feature-level docs to understand the spec. Read the code. Find deltas. Fix them. Commit frequently with detailed messages.

**Tools:** read_file, edit_file, write_file, search_content, search_files, list_dir, run_task, git (full — add, commit, push, status, diff, log)

**Docs access:** requirements.md, flows.md, standards/, overview.md. **NOT** test-instructions.md — that's the tester's domain.

**System instructions (concise):**
```
You are a syncing agent. Your job is to make code match its .docs/ specification.

When given a target feature directory:
1. Read the project-level .docs/ (overview, standards) to understand conventions
2. Read the feature-level .docs/ (requirements, flows) to understand the spec
3. Read the source code in the target directory
4. Identify deltas — what the docs say should exist vs what the code does
5. Make targeted changes to sync the code to the docs
6. Commit frequently with detailed commit messages explaining what and why

Do NOT read test-instructions.md — that is for the tester agent.
Be deliberate about what you read. You have a limited context window.
Use offset/limit on large files. Use search before reading entire directories.
Start with .docs/, then read only the code files relevant to the gaps you found.
```

### History Agent

Git archaeologist. Uses git history to answer questions about why things are the way they are. Purely analytical — never writes code.

**Job:** Trace feature evolution, explain past decisions, surface context that helps other agents or the user understand the codebase's history.

**Tools:** git_log, git_diff, git_status, git_branch, read_file, search_content, search_files, list_dir (all read-only — no write, no edit, no git write ops)

**Docs access:** All docs (reads current docs to compare against historical state)

**System instructions (concise):**
```
You are a history agent. You use git history to answer questions about the codebase.

You can:
- Trace why decisions were made (git log, git blame via search)
- Show how a feature evolved over time
- Find when and why something changed
- Generate handoff reports for syncing agent relay sessions
- Compare current docs against historical code state

You never write code or modify files. You are read-only.
Use git_log with file paths to scope your searches.
Use git_diff to compare specific commits or branches.
```

**Key role in relay pattern:** The history agent generates handoff reports between syncing agent sessions (see Agent Relay Pattern below).

### Tester Agent

Tests features in deployed sandbox environments. What it tests depends on what kind of feature it is — determined by reading the feature's `test-instructions.md`.

**Job:** Hit the real sandbox. For frontend features, use Playwright to navigate, interact, assert. For backend features, make HTTP requests to API endpoints, validate responses against the spec. Handle auth, sessions, tokens — test as if it were a real client.

**Tools:** read_file, search_content, search_files, list_dir, run_task (for executing test commands), http_request (new tool — makes HTTP calls to sandbox endpoints)

**Future tools:** Playwright tools (when we add Playwright MCP back for automated UI testing)

**Docs access:** requirements.md, flows.md, **test-instructions.md** (primary playbook), overview.md. **NOT** standards/coding.md — the tester doesn't care about code conventions, only behavior.

**System instructions (concise):**
```
You are a tester agent. You test features in deployed sandbox environments.

When testing a feature:
1. Read the feature's test-instructions.md for your testing playbook
2. Read requirements.md and flows.md to understand expected behavior
3. Test against the live sandbox — hit real endpoints, navigate real pages
4. For backend: make HTTP requests, validate response shapes, status codes, auth flows
5. For frontend: use Playwright to navigate, interact, and assert
6. Report results: what passed, what failed, with specific details

You test behavior, not code quality. You don't read source code unless
you need to understand an endpoint URL or auth mechanism.
Handle auth like a real client — obtain tokens, use sessions, refresh as needed.
```

### PR Reviewer Agent

Reviews PRs for code quality and spec compliance. Reads the PR diff, the `.docs/` spec, and the changed files.

**Tools:** read_file, search_content, search_files, list_dir, git_diff, git_log, review_pr, comment_pr (all read-only except PR review actions)

**Docs access:** All docs (needs to compare code changes against full spec)

**System instructions (concise):**
```
You are a PR reviewer. You review pull requests for quality and spec compliance.

When reviewing a PR:
1. Read the feature's .docs/ to understand what was supposed to be built
2. Read the PR diff to see what changed
3. Read changed files in full context where the diff isn't enough
4. Evaluate: Does the code match the spec? Is it correct? Is it clean?
5. Submit your review:
   - APPROVE if the code matches the spec and is quality
   - REQUEST_CHANGES with specific, actionable feedback if not

Focus on correctness and spec compliance, not style preferences.
Be specific: file, line, what's wrong, what it should be.
```

---

## Scoped Docs Per Agent Type

| Doc File | Syncing Agent | Tester Agent | Doc Assistant | History Agent | PR Reviewer |
|----------|:---:|:---:|:---:|:---:|:---:|
| `overview.md` | yes | yes | yes | yes | yes |
| `requirements.md` | yes | yes | yes | yes | yes |
| `flows.md` | yes | yes | yes | yes | yes |
| `standards/coding.md` | yes | no | yes | yes | yes |
| `standards/design.md` | yes | no | yes | yes | yes |
| `test-instructions.md` | **no** | **yes (primary)** | yes | yes | yes |

The syncing agent never reads `test-instructions.md` — saves tokens and avoids confusion between implementation and testing concerns. The tester agent's primary playbook IS `test-instructions.md`.

---

## Agent Relay Pattern

When a syncing agent hits its 100k token limit, it doesn't fail — it shuts down gracefully, and a fresh agent picks up where it left off.

### How It Works

```
Syncing Agent Session 1 (100k budget)
    │
    ├── Reads project .docs/ (~3k tokens)
    ├── Reads feature .docs/ (~2k tokens)
    ├── Reads code files (~8k tokens)
    ├── Edit-commit cycles (~5k each × N cycles)
    ├── ...hits 100k limit
    ▼
Agent shuts down (last commit is the checkpoint)
    │
    ▼
Deterministic: Generate handoff report (no LLM needed)
    │
    ▼
Syncing Agent Session 2 (fresh 100k budget)
    │
    ├── Reads project .docs/ (~3k tokens) ← reads fresh, same as session 1
    ├── Reads feature .docs/ (~2k tokens) ← reads fresh
    ├── Reads handoff report (~1k tokens) ← knows what's been done
    ├── Reads remaining code (~5k tokens) ← only what's not done yet
    ├── Edit-commit cycles continue
    ├── ...hits 100k or finishes
    ▼
(repeat until feature is fully synced)
```

### Handoff Report (Deterministic)

Generated automatically from git state — no LLM needed:

```markdown
## Sync Handoff — feature/auth

### Branch: feature/auth (based on local-scain)

### Recent commits on this branch:
- a1b2c3d: Add AuthGuard component with JWT token validation
- d4e5f6a: Implement login form with reactive form validation
- 7g8h9i0: Add auth interceptor for automatic token refresh

### Files changed (vs local-scain):
- src/features/auth/guards/auth.guard.ts (new, +87 lines)
- src/features/auth/components/login-form.component.ts (new, +142 lines)
- src/features/auth/interceptors/auth.interceptor.ts (new, +65 lines)
- src/features/auth/auth.module.ts (modified, +12 lines)

### Git diff summary:
4 files changed, 306 insertions(+), 3 deletions(-)
```

The handoff report tells the next agent: "these files are done, focus on what's not here yet." The agent reads the docs, reads the handoff, and immediately knows what's remaining without re-reading already-implemented code.

The history agent can also generate richer handoff reports on demand — but the deterministic version is fast, free, and sufficient for the relay pattern.

---

## Deterministic Pipeline

Everything that doesn't require judgment is deterministic — no LLM, just code.

### Feature Setup (before syncing agent runs)

Triggered when user starts a conversation with the syncing agent from a feature directory:

```
User navigates to feature dir in docs page
    │
    ▼
User opens syncing agent bubble, types message
    │
    ▼
Frontend detects: user is in a feature dir
    │ (if not in a feature dir, bubble shows "Navigate to a feature to start syncing")
    │
    ▼
Frontend calls: POST /api/sync/setup
    { featurePath: "projects/application/frontend/app/src/features/auth/" }
    │
    ▼
Backend (deterministic):
    1. Derive feature name from path → "auth"
    2. Check if worktree already exists for this feature
       - If yes: reuse it
       - If no: create worktree off DEPLOY_BRANCH
         git worktree add .worktrees/feature-auth -b feature/auth ${DEPLOY_BRANCH}
    3. Return { worktreePath, branch, featureName }
    │
    ▼
Frontend prepends context to user's message:
    "[Worktree: .worktrees/feature-auth | Branch: feature/auth
      Target: projects/application/frontend/app/src/features/auth/]
     {user's actual message}"
    │
    ▼
Message sent to syncing agent via WebSocket
```

### Post-Sync Deployment

After the syncing agent finishes (either completes or hits budget):

```
Syncing agent session ends
    │
    ▼
Check: is feature branch ahead of DEPLOY_BRANCH?
    │ no → nothing to deploy
    │ yes ↓
    ▼
Deploy worktree to sandbox: env-{feature-name}
    (deterministic: docker build + helm install, same as existing deploy_sandbox)
    │
    ▼
Wait for sandbox healthy
    │
    ▼
Spawn tester agent against sandbox
    │
    ▼
Tester agent runs tests
    ├── pass → Create PR: feature/{name} → DEPLOY_BRANCH
    │           │
    │           ▼
    │         Spawn PR reviewer agent
    │           ├── APPROVE → Merge PR
    │           │              ├── local env: manual deploy
    │           │              └── other envs: GitHub Actions auto-deploy
    │           └── REQUEST_CHANGES → Spawn syncing agent to iterate
    │                                  (with PR comments as context)
    │
    └── fail → Spawn syncing agent with test results as context
                (agent reads failures, fixes code, commits → loop back to deploy)
```

### Environment Branch Maintenance

```
Periodically (cron or manual):
    git checkout ${DEPLOY_BRANCH}
    git rebase main
    git push --force-with-lease
```

---

## Token Budget: Mastra Token Limiter Processor

Use Mastra's built-in `tokenLimiterProcessor` to enforce the 100k limit natively:

```typescript
import { tokenLimiterProcessor } from '@mastra/core/processors';

const agent = new Agent({
  name: 'syncing-agent',
  model: anthropic('claude-haiku-4-5-20251001'),
  instructions: SYNCING_AGENT_INSTRUCTIONS,
  tools: syncingTools,
  processors: [
    tokenLimiterProcessor({ maxTokens: 100_000 }),
  ],
});
```

The processor handles enforcement. The `onStepFinish` callback (already working in docs assistant) handles tracking and UI display. Together they give us:
- Hard limit enforcement (Mastra processor)
- Visible tracking per step (onStepFinish → WebSocket → UI)
- Budget progress bar in the chat bubble
- Graceful shutdown that triggers the relay pattern

---

## Tool Layer: Pi-Derived Context-Efficient Tools

Adapt Pi's tool implementations (`badlogic/pi-mono`) as Mastra `createTool` definitions.

### Tools to Build

| Tool | Source | Key Features |
|------|--------|-------------|
| `read_file` | Pi `read` | Offset/limit pagination, dual truncation (2000 lines / 50KB), image support, actionable continuation hints |
| `edit_file` | Pi `edit` | Multi-edit `edits[]` array, fuzzy matching (whitespace/unicode normalization), BOM/CRLF handling, overlap detection, clear error messages |
| `write_file` | Pi `write` | Auto-creates parent dirs, simple overwrite |
| `search_content` | Pi `grep` | Ripgrep JSON mode, per-line truncation (500 chars), match count cap (100), glob filtering |
| `search_files` | Pi `find` | fd-based glob search with result limits |
| `list_dir` | Pi `ls` | Directory listing with `dir/` suffix notation, result limits |
| `run_task` | Custom | Scoped Taskfile execution — validate against allowlist, truncateTail on output |
| `http_request` | Custom | Make HTTP requests to sandbox endpoints — for tester agent API testing |

### Tools to Migrate from MCP Server

These already exist in `mcp-server.ts` and need to be wrapped as Mastra tools:

| Tool | Purpose | Used by |
|------|---------|---------|
| `git_status`, `git_diff`, `git_log`, `git_branch` | Read-only git operations | All agents |
| `git_add`, `git_commit`, `git_push`, `git_pull`, `git_checkout`, `git_stash` | Write git operations | Syncing agent |
| `push_and_pr` | Commit + push + create draft PR | Pipeline (deterministic) |
| `read_github_issue`, `comment_github_issue`, `create_github_issue` | Issue management | Future |
| `read_pr_reviews`, `review_pr`, `comment_pr`, `mark_pr_ready` | PR review workflow | PR reviewer agent |
| `create_worktree` | Worktree creation | Pipeline (deterministic) |
| `deploy_sandbox`, `destroy_sandbox`, `sandbox_status`, `sandbox_logs`, `list_sandboxes` | Sandbox lifecycle | Pipeline (deterministic) |

Note: many MCP tools (create_worktree, deploy_sandbox, push_and_pr) are used by the deterministic pipeline, not by agents directly. The agents focus on reading/writing code and reviewing.

### Truncation Module

Port Pi's `truncate.ts` as a shared utility:

```typescript
truncateHead(text, maxLines, maxBytes) → { truncated, originalLines, originalBytes }
truncateTail(text, maxLines, maxBytes) → { truncated, originalLines, originalBytes }
truncateLine(line, maxChars) → string
```

### File Mutation Queue

Port Pi's `file-mutation-queue.ts` — serializes concurrent writes to the same file path.

---

## Frontend Architecture

### Docs Page as Control Surface

The docs page project tree becomes the control surface for the entire system. It needs to show:

- Which features have active worktrees/branches (indicator on tree nodes)
- Which features have sandboxes running
- Which features have open PRs
- Agent status per feature (syncing, testing, reviewing, idle)

The tree view already exists — these are status overlays on existing nodes.

### Agent Bubbles

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docs Page                                   │
│  ┌─────────┐  ┌───────────────────────────────────────────────┐   │
│  │ Project  │  │  File Viewer / Markdown Renderer              │   │
│  │ Tree     │  │                                               │   │
│  │          │  │                                               │   │
│  │ [●] auth │  │                                               │   │
│  │  ├ .docs │  │                                               │   │
│  │  └ src   │  │                                               │   │
│  └─────────┘  └───────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────┤
│                      [📝 Doc Assistant] [🔄 Sync] [📜 History]   │
└──────────────────────────────────────────────────────────────────┘
```

Three bubbles:
- **Doc Assistant** — always available, works on whatever you're viewing
- **Syncing Agent** — only enabled when viewing a feature directory. Starting a conversation triggers worktree/branch setup.
- **History Agent** — always available, answers questions about git history

Tester and PR Reviewer agents are automated — they don't have chat bubbles. They're spawned by the pipeline and their results are displayed in the UI (test results panel, PR review comments).

### Feature Guard on Syncing Agent

The syncing agent bubble is **disabled** unless the user is navigated to a feature directory in the project tree. When disabled, it shows a tooltip: "Navigate to a feature directory to start syncing."

When enabled and the user sends a first message:
1. Frontend calls `POST /api/sync/setup` with the feature path
2. Backend creates worktree + branch (if not already exists)
3. Context is prepended to the user's message
4. Message is sent to the syncing agent

Subsequent messages in the same session don't re-create the worktree — the context is already established.

### Generic AgentChatBubble Component

```typescript
interface AgentChatBubbleProps {
  agentName: string;           // 'doc-assistant', 'syncing-agent', 'history-agent'
  displayName: string;         // 'Doc Assistant', 'Syncing Agent', 'History'
  icon: ReactNode;             // MUI icon for the FAB
  color: string;               // Accent color
  position: number;            // Horizontal position (0 = rightmost)
  defaultInstructions: string;
  maxTokenBudget: number;      // 100_000
  activeContext?: string;      // Currently viewed path from docs page
  disabled?: boolean;          // Feature guard for syncing agent
  disabledTooltip?: string;    // "Navigate to a feature directory..."
}
```

Each bubble:
- Floating FAB at bottom of screen
- Expands to 420x600px panel
- WebSocket connection to `/mastra` namespace with `agentName` discriminator
- Editable system instructions
- Full tool call visibility
- Per-step token tracking with expandable breakdown
- Token budget progress bar (tokens used / 100k)
- Active context display (what directory/file the agent sees)
- Status indicator: gray (idle), green pulse (active), orange (>75% budget), red (>90%)

---

## Build Stages

### Stage 1: Tool Foundation

**Goal:** Pi-derived tools working as Mastra tools, run_task replacing bash.

**Tasks:**
1. Port Pi's `truncate.ts` as shared utility
2. Port Pi's `file-mutation-queue.ts`
3. Implement `read_file` tool (Pi's read logic + truncation + offset/limit)
4. Implement `edit_file` tool (Pi's multi-edit + fuzzy matching)
5. Implement `write_file` tool
6. Implement `search_content` tool (ripgrep wrapper + truncation)
7. Implement `search_files` tool (fd wrapper + truncation)
8. Implement `list_dir` tool
9. Implement `run_task` tool (validate against allowlist, spawn task, truncateTail output)
10. Wrap existing MCP server git tools as Mastra tools
11. Implement `http_request` tool for tester agent

**Validation:** Swap the current docs assistant's tools for Pi-derived versions. Verify context-efficient output.

### Stage 2: Three-Bubble UI + Syncing Agent

**Goal:** Doc assistant + syncing agent + history agent as chat bubbles with token budget enforcement and feature guard.

**Tasks:**
1. Create generic `AgentChatBubble` component (extract from docs-chat-bubble)
2. Create `TokenBudgetBar` and `AgentStatusIndicator` components
3. Refactor existing docs-chat-bubble to use generic component
4. Create syncing agent with concise system instructions
5. Create history agent with read-only tools
6. Add Mastra `tokenLimiterProcessor` to all agents (100k)
7. Update `/mastra` gateway to handle `agent` field in messages
8. Implement feature guard: syncing agent disabled unless in feature dir
9. Build `POST /api/sync/setup` endpoint (deterministic worktree/branch creation)
10. Wire up App.tsx — all three bubbles on docs page
11. Pass active context (viewed directory) to all bubbles

**Validation:** Navigate to a feature dir, open syncing agent, send a message. Verify worktree is created, agent reads docs and code, makes edits, commits. Verify token budget bar and enforcement.

### Stage 3: Agent Relay

**Goal:** Syncing agent can span multiple sessions via handoff reports.

**Tasks:**
1. Build deterministic handoff report generator (git log + diff on feature branch)
2. Implement relay trigger: when syncing agent hits budget, generate handoff, offer to spawn fresh agent
3. Fresh agent receives handoff report as initial context alongside docs
4. Test: start a large feature sync, let agent hit wall, relay to new agent, verify continuity
5. Profile token usage — how many edit-commit cycles fit in 100k?

**Validation:** A feature that requires more than 100k tokens to sync is completed across multiple agent sessions without human intervention (beyond the initial "sync this").

### Stage 4: Deterministic Pipeline

**Goal:** Post-sync deployment, testing, and PR flow — all deterministic except agent judgment steps.

**Tasks:**
1. Build post-sync check: is feature branch ahead of DEPLOY_BRANCH?
2. Build deterministic sandbox deployment (reuse existing deploy_sandbox logic)
3. Create tester agent with `http_request` tool and `test-instructions.md` playbook
4. Build test result → syncing agent feedback loop (spawn syncing agent with test failures)
5. Build deterministic PR creation (feature branch → DEPLOY_BRANCH)
6. Create PR reviewer agent
7. Build PR review → syncing agent iteration loop (spawn syncing agent with review comments)
8. Add feature status indicators to docs page tree view

**Validation:** Full loop: edit docs → sync agent codes it → sandbox deploys → tester tests → PR opens → reviewer approves → merge.

### Stage 5: Autonomous Loop (Future)

**Goal:** Agents run continuously without manual prompting.

**Not in this build plan** — the target after Stages 1-4 are proven. But the architecture supports it:
- File watcher or cron detects `.docs/` changes → triggers sync setup + syncing agent
- Pipeline runs end-to-end: sync → deploy → test → PR → review → merge
- Token budget resets per relay session
- Multiple features can be worked in parallel (separate worktrees, separate agent instances)

---

## File Structure (New/Modified)

```
projects/the-dev-team/backend/app/src/
├── features/mastra-agents/
│   ├── agents/
│   │   ├── doc-assistant.agent.ts     # MODIFY — upgrade tools, add token limiter
│   │   ├── syncing-agent.agent.ts     # NEW
│   │   └── history-agent.agent.ts     # NEW
│   ├── tools/
│   │   ├── truncate.ts                # NEW — ported from Pi
│   │   ├── file-mutation-queue.ts     # NEW — ported from Pi
│   │   ├── read-file.tool.ts          # REPLACE — Pi-derived with truncation
│   │   ├── edit-file.tool.ts          # NEW — Pi-derived multi-edit
│   │   ├── write-file.tool.ts         # REPLACE — Pi-derived with auto-mkdir
│   │   ├── search-content.tool.ts     # NEW — ripgrep wrapper
│   │   ├── search-files.tool.ts       # NEW — fd wrapper
│   │   ├── list-dir.tool.ts           # REPLACE — Pi-derived with truncation
│   │   ├── run-task.tool.ts           # NEW — scoped Taskfile execution
│   │   ├── http-request.tool.ts       # NEW — HTTP client for tester agent
│   │   ├── git-tools.ts               # NEW — wraps MCP server git functions
│   │   ├── sandbox-tools.ts           # NEW — wraps MCP server sandbox functions
│   │   └── pr-tools.ts               # NEW — wraps MCP server PR/issue functions
│   ├── pipeline/
│   │   ├── sync-setup.service.ts      # NEW — deterministic worktree/branch creation
│   │   ├── post-sync.service.ts       # NEW — deploy sandbox after sync
│   │   ├── handoff-report.service.ts  # NEW — generate relay handoff from git state
│   │   └── pipeline.controller.ts     # NEW — REST endpoints for pipeline steps
│   ├── gateways/
│   │   └── mastra-agents.gateway.ts   # MODIFY — handle multi-agent routing
│   ├── mastra-agents.module.ts        # MODIFY — register new agents + pipeline
│   └── mastra-agents.types.ts         # MODIFY — add agent discriminator types
│
projects/the-dev-team/frontend/app/src/
├── features/
│   ├── agents/                        # NEW — generic agent chat system
│   │   ├── agent-chat-bubble.tsx         # Generic chat bubble (extracted from docs)
│   │   ├── token-budget-bar.tsx          # Progress bar component
│   │   ├── agent-status-indicator.tsx    # Colored status dot
│   │   └── use-agent-chat.ts            # Hook for agent WebSocket + state
│   ├── docs/
│   │   └── docs-chat-bubble.tsx       # MODIFY — refactor to use generic AgentChatBubble
│   └── ...
├── App.tsx                            # MODIFY — add agent bubbles
└── ...
```

## What Gets Removed/Deprecated

| Remove | Reason |
|--------|--------|
| `features/agent/providers/` | Replaced by Mastra agents |
| `features/agent/roles/` | No predefined roles — context determines behavior |
| `features/agent/agent.gateway.ts` | Replaced by extended `/mastra` gateway |
| `features/agent/agent.service.ts` | Session management moves to Mastra |
| `features/chat/` (frontend) | Replaced by agent-chat-bubble system |

**Keep:**
- `mcp-server.ts` — execution layer for git/sandbox/PR tools
- `features/task-runner/` — `run_task` tool calls this service
- `features/cluster/` — environments UI stays
- `features/docs/` — docs page stays, chat bubble refactored
- `features/router/` — deferred but architecture stays

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Two core agent types + three supporting | Syncing agent + doc assistant are the core. History, tester, PR reviewer support the pipeline. |
| No predefined roles | The directory context IS the role. Project `.docs/` defines conventions. Feature `.docs/` defines the spec. |
| Agent relay pattern | 100k is a session limit, not a feature limit. Agents relay via commits + handoff reports. |
| Scoped docs per agent type | Syncing agent skips test-instructions.md. Tester agent skips coding standards. Saves tokens, prevents confusion. |
| Deterministic pipeline | Worktree creation, deployment, PR creation are code, not LLM calls. Agents only run where judgment is needed. |
| Feature guard on syncing agent | Can't start syncing unless in a feature dir. Prevents aimless conversations. |
| Haiku for all agents | Cost experiment — prove docs-driven makes tasks scoped enough for Haiku |
| 100k via Mastra tokenLimiterProcessor | Native enforcement, not custom tracking |
| Pi tools | Context-efficient truncation, multi-edit, fuzzy matching |
| No bash tool | Agents use `run_task` for Taskfile tasks only |
| Commits as handoff mechanism | Frequent commits with detailed messages serve both relay pattern and history agent |
| Feature branches off DEPLOY_BRANCH | Clean isolation, PRs back to environment branch, supports multiple environments |

## Open Questions

1. **Ripgrep/fd availability:** Pi's grep/find tools shell out to `rg` and `fd`. Are these in the backend pod? If not, add to Dockerfile or use Node-native alternatives.
2. **http_request tool design:** For the tester agent — should this be a raw HTTP tool or something higher-level that handles auth flows (login → get token → use token)? The `test-instructions.md` could document the auth flow and let the agent figure it out.
3. **Multiple syncing agents in parallel:** Can we run multiple feature syncs simultaneously? The architecture supports it (separate worktrees) but the UI needs design for multiple active sync bubbles.
4. **Handoff report — deterministic vs LLM-assisted:** The deterministic version (git log + diff summary) is fast and free. An LLM-assisted version could also identify what's remaining based on the docs. Worth testing both.
5. **Project rename:** When do we rename from "the-dev-team" to "doc-driven-development" in directory structure and K8s? Deferred — too much churn while actively building.
6. **Tester agent for frontend:** Playwright MCP tools need the headless Chrome sidecar. When do we wire that back in? Stage 4 at earliest.
