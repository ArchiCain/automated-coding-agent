# Command Center Redesign

## Vision

Transform the Command Center from a Docker-focused operations page into a **hierarchical codebase navigation system** with scoped AI agents at every level. The user can drill into any layer of the repo — projects, features, concerns — and interact with an agent that has full context for that scope. Higher-level agents delegate work downward; only concern-level agents touch code.

---

## Hierarchy

```
Projects Page (/projects)
  → Project Page (/projects/:projectId)
    → Feature Page (/projects/:projectId/features/:featureId)
```

Each page shows the entities at that level, relevant metadata, and an embedded chatbot agent scoped to that level's context.

**Navigation:** Breadcrumb drill-down with full page transitions. User sees where they are in the tree and can navigate up/down freely.

---

## Level 1: Projects Page

**Route:** `/projects`

**What it shows:**
- All projects in the repo (backend, frontend, database, keycloak, e2e, coding-agent-backend, coding-agent-frontend)
- Each project displayed with:
  - Name, summary/description
  - Docker service controls (embedded per-project where applicable — start, stop, restart, logs, status indicator)
  - Feature count, tech stack indicators
  - Quick health/status info
- Global controls (Stop All, Start All, Purge & Restart) remain available
- Git branch + status display (current branch, dirty state, ahead/behind)
- Task runner bar (run any Taskfile task)

**Agent scope:**
- Knows the full repo structure — all projects, their purposes, how they relate
- Can answer questions like "which project handles auth?" or "what's the relationship between backend and keycloak?"
- Delegates project-level work downward but doesn't write code itself

**Layout: Expandable Rows**

Each project is a compact row that expands accordion-style to reveal details.

**Collapsed row shows:**
- Project name
- Status indicator (dot: green/red/grey for running/stopped/n/a)
- Tech badge (NestJS, Angular, PostgreSQL, etc.)
- Port number (if applicable)
- Feature count
- Expand chevron + click-to-navigate arrow

**Expanded row reveals:**
- Project summary/description
- Docker service controls (start, stop, restart, logs) — only for projects with docker services
- Health endpoint status
- Mini feature list as preview (clickable to navigate into project)
- Last build/deploy status if available

**Progressive disclosure:** Collapsed = scannable overview, expanded = actionable detail, click-through = full project page.

---

## Level 2: Project Page

**Route:** `/projects/:projectId`

**What it shows:**
- All features within the selected project (e.g., backend has: health, cors, keycloak-auth, mastra-agents, theme, typeorm-database-client, user-management)
- Each feature displayed with:
  - Name, description (from feature README.md if available)
  - Concern breakdown (count of controllers, services, dto, etc.)
  - Status indicators if tied to backlog items
- Project-level metadata in a header (project name, tech stack, docker status)
- Breadcrumb: Projects > {Project Name}

**Agent scope:**
- Knows the selected project's architecture, conventions, module system
- Has context files for the project's structure and patterns
- When asked to build something, **decomposes into feature-scoped tasks** via the decomposition workflow
- Does not write code — manages at the feature level and delegates to concern agents

---

## Level 3: Feature Page

**Route:** `/projects/:projectId/features/:featureId`

**What it shows:**
- All concerns within the selected feature organized by type:
  - Controllers, Services, DTOs, Entities, Gateways, Guards, Components, Pages, etc.
- Each concern displayed with:
  - File name, type indicator
  - Brief description or exported symbols
  - Status if tied to a backlog task
- Feature-level metadata in a header (feature name, module file, README content)
- Breadcrumb: Projects > {Project Name} > {Feature Name}

**Agent scope:**
- Fully scoped to this feature's files and context
- This is where code actually gets written
- When given a task, kicks off decomposition into concern-level work items
- Hands each concern task to a concern-scoped agent for execution
- Manages the feature at a high level — delegates actual code changes

---

## Chatbot Agent System

### Design: Bottom-Right Floating Bubble

The agent appears as a **persistent floating chatbot bubble** in the bottom-right corner of every page. Clicking it expands into a chat panel. It feels like a companion that's always available.

**Bubble behavior:**
- Collapsed: small circular icon button in bottom-right
- Expanded: chat panel pops up above the bubble (typical chatbot widget pattern)
- Can be dismissed/minimized back to bubble
- Keyboard shortcut to toggle open/close

### Per-Page Context Scoping

All agents use the **same template** — the only thing that changes per page is:
- `startup-prompt.md` — the system prompt that defines the agent's role at that level
- `contextFiles[]` — the reference documents relevant to that scope

These are **hardcoded per level**, not dynamically discovered. Each page knows exactly which startup prompt and context files to load.

### Startup Prompt Rename

All `prompt.md` files renamed to `startup-prompt.md` throughout the codebase. Better communicates that this is the initial system prompt that boots the agent's persona for that page.

### Context Document Viewing

- Context files and startup prompt viewable via a compact trigger inside the chat panel header
- Clicking a doc triggers a **slide-over panel** (reuse existing SlideOverComponent pattern)
- Documents shown as clickable chips/tags
- Minimal footprint when not viewing docs

### Session Persistence via Claude Code Sessions

- Uses real Claude Code session features — sessions are resumable via session ID
- When user navigates away and comes back to the same scope, the session resumes
- Session ID stored per scope (e.g., the backend project page has its own session)
- If the user navigates to a different scope, a different session is used (or new one created)
- Sessions survive page refreshes and browser restarts as long as the session ID is retained

---

## Current Agent System — Deep Dive & Issues

### How It Works Today

**Backend (coding-agent-backend, port 8086):**

1. **SessionService** manages lifecycle:
   - `startSession()` — creates UUID, stores `ActiveSession` in memory, calls `executePrompt()` async
   - `sendMessage()` — sends follow-up to existing session via `executePrompt()`
   - `executePrompt()` — invokes Claude SDK `query()`, streams output via EventEmitter
   - Sessions stored in `Map<string, ActiveSession>` (ephemeral, in-memory only)
   - Optional disk persistence to `.tasks/{id}/` if `planDir` provided
   - SDK session ID captured for resume capability (`resume: sdkSessionId`)

2. **SessionGateway** (WebSocket, `/sessions` namespace):
   - Listens to EventEmitter events from SessionService
   - Broadcasts to subscribed clients via socket.io rooms
   - Events: `session:started`, `session:output`, `session:turn_complete`, `session:paused`, `session:error`, `session:completed`

3. **ClaudeCodeAgentController** (REST):
   - `POST /api/claude-code-agent/sessions` — start session
   - `POST /api/claude-code-agent/sessions/:id/message` — send follow-up
   - `GET /api/claude-code-agent/sessions/:id` — get session metadata
   - `GET /api/claude-code-agent/files?path=` — read file content
   - `GET /api/claude-code-agent/config` — repo root
   - `GET /api/claude-code-agent` — list agent definitions

**Frontend (coding-agent-frontend, port 4200):**

1. **Two competing UI patterns:**
   - **PlaygroundComponent** (`/playground`) — full-page chat, primary current UI
   - **BaseAgentComponent** — composable, smaller, built but underutilized

2. **Two competing services:**
   - **AgentsService** — points to `/api/agents/` (generic)
   - **ClaudeCodeAgentService** — points to `/api/claude-code-agent/` (specific)
   - Route mismatch between services and actual backend endpoints

3. **AgentsWebSocketService** — Socket.IO client on `http://localhost:8086/agents`
   - Observable streams for all session events
   - Subscription queue for pre-connection messages

### Identified Pain Points

**UX Issues (Why It Feels Clunky):**
- Full-page takeover — can't use agent alongside other content
- Must navigate to `/playground` to interact
- No persistent bubble/widget that follows you
- Heavy layout with lots of wasted space (800px max-width terminal)
- No session history or multi-session support in UI

**Architecture Issues:**
- **Competing patterns**: Two agent services, two UI components, unclear which to use
- **Route mismatches**: Frontend services don't align with backend controller paths
- **Race condition**: WebSocket subscription happens after HTTP response — can miss early messages
- **No real persistence**: Sessions in-memory only, lost on server restart
- **Context files not actually used**: AgentHeaderComponent shows them but they're not included in prompts sent to SDK
- **Attachments incomplete**: UI supports file attachments but backend doesn't process them
- **Raw output format**: Transcript is JSON strings, no structured message types (user/assistant/tool)

### What to Keep

- **SessionService core logic** — session lifecycle, SDK integration, executePrompt() pattern is solid
- **WebSocket streaming** — real-time output is the right approach
- **Agent definition model** — promptFile + contextFiles pattern maps perfectly to new design
- **SlideOverComponent** — reuse for doc viewing

### What to Fix/Replace

- **Consolidate to one service path** — pick `/api/agents/` or `/api/claude-code-agent/`, not both
- **Replace Playground + BaseAgent with Chatbot widget** — single component, floating bubble
- **Actually pass context files to SDK** — they're decorative today, need to be functional
- **Add structured message format** — distinguish user messages, assistant responses, tool use
- **Persist session IDs** — store per-scope in localStorage or IndexedDB for resumption
- **Fix subscription race** — subscribe to WebSocket room BEFORE starting session, or buffer early messages

---

## Existing Infrastructure to Leverage

### Already Built

| Component | How It Maps |
|-----------|-------------|
| `.backlog/` decomposition system | Powers the feature→concern task breakdown |
| Decomposition prompts (`decomp-project-to-features.md`, etc.) | Become the startup prompts or context files per level |
| `SessionService` (backend) | Core session/SDK logic stays, needs cleanup |
| `SessionGateway` (WebSocket) | Streaming infrastructure stays |
| `SlideOverComponent` | Reused for context doc viewing |
| `AgentDefinition` model (promptFile, contextFiles) | Extended to support per-page scoping |
| Docker service config + controls | Embedded into project cards |
| `TaskBarComponent` | Remains as global task runner |
| `CommandCenterService` (git ops) | Stays for branch/status display |
| `BranchControlsComponent` | Moves to projects page header |

### Needs to Be Built

| Component | Purpose |
|-----------|---------|
| **ChatbotBubbleComponent** | Floating bottom-right bubble, expand/collapse |
| **ChatbotPanelComponent** | The expanded chat UI (messages, input, doc chips) |
| **ChatbotMessageComponent** | Individual message rendering (user vs assistant) |
| Hierarchical page routing | `/projects/:id/features/:id` drill-down |
| Project listing service | Scan `projects/` directory, load metadata |
| Feature listing service | Scan `features/` within a project, load READMEs |
| Concern listing service | Scan concern directories within a feature |
| Startup prompt resolver | Load correct `startup-prompt.md` per page scope |
| Context file resolver | Load hardcoded context files per scope |
| Scope-aware session manager | Map route scope → session ID, handle resume |
| Unified agent API service | Replace competing services with single clean client |

---

## Repo Structure Reference

### Projects (Level 1)

| Project | Type | Port | Description |
|---------|------|------|-------------|
| backend | NestJS API | 8085 | WebSocket, agents, themes, auth |
| frontend | Angular 19 | 3000 | Main user-facing web app |
| database | PostgreSQL | 5437 | Docker infra + migrations |
| keycloak | IAM | 8081 | Identity & access management |
| e2e | Playwright | — | End-to-end tests |
| coding-agent-backend | NestJS | 8086 | Decomposition engine API |
| coding-agent-frontend | Angular 19 | 4200 | This app — dev tooling UI |

### Feature Pattern (Level 2)

Each project contains `app/src/features/` with feature directories. Features have:
- `{feature}.module.ts` — NestJS module wiring
- `index.ts` — barrel exports
- `README.md` — description and conventions (when present)
- Concern subdirectories

### Concern Types (Level 3)

**Backend (NestJS):** controllers, services, entities, dto, gateways, guards, decorators, permissions, middleware, repositories, migrations

**Frontend (Angular):** components, pages, services, models, pipes, permissions

**File naming:** `{feature-name}.{concern-type}.ts` (e.g., `theme.controller.ts`, `theme.service.ts`)

---

## Open Design Questions

None currently — all major decisions resolved. Details will emerge during implementation.

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rename prompt.md → startup-prompt.md | Yes | Better communicates the file's purpose as the boot prompt |
| Docker controls | Embedded per-project | Not a separate section — part of each project's representation |
| Agent style | Bottom-right floating chatbot bubble | Persistent companion, doesn't dominate page, familiar pattern |
| Context doc viewing | Slide-over triggered from chat panel header | Minimal footprint, reuses existing pattern |
| Navigation model | Breadcrumb drill-down | User sees position in tree, navigates up/down, no sidebar tree needed |
| Agent template | Single template, swap startup-prompt.md + context files per page | Hardcoded per scope, not dynamic discovery |
| Session persistence | Claude Code session resume via session ID | Sessions survive navigation and refresh, stored per scope |
| Execution/decomp workflow | Deferred | Will design once page structure is built |
| Feature agent behavior | Decomposes to concerns, delegates | Does not write code directly |
| Concern agent behavior | Writes code | Fully scoped to feature's files |
| Agent backend consolidation | Unify competing services into single clean API | Current dual-service pattern causes confusion |
| Context files | Must actually be passed to SDK | Currently decorative — need to be functional |
| Projects page layout | Expandable rows (accordion) | Progressive disclosure — scannable when collapsed, actionable when expanded |
