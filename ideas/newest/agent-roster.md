# Agent Roster & Collaboration Model

## Overview

THE Dev Team is a multi-agent system modeled after a real development team. Each agent **owns** a domain — not just executing tasks, but carrying the full knowledge, history, and context of their area. They know why decisions were made, where the tech debt lives, what was tried and abandoned. They can be consulted during brainstorming, push back on bad ideas, and see work through from concept to deployment.

**Orchestration:** Manual (user-driven). The user selects which agent to interact with via the chat UI. Agents do not call each other directly.

**Handoff mechanism:** GitHub Issues. Review agents create issues with appropriate labels. Project owners pick up issues in their domain.

**Label taxonomy:**
- `frontend`, `backend`, `devops`, `docs`, `api` — domain routing
- `design`, `ui/ux`, `api-quality`, `bug`, `enhancement`, `refactor` — issue type
- `priority:high`, `priority:medium`, `priority:low` — triage

---

## Project Owners

Project owners are the experts for their domain. They carry accumulated knowledge of their project's architecture, history, patterns, and decisions. They implement features, fix bugs, review changes in their area, and are consulted during planning for domain-specific questions.

**What makes them different from "execution agents":**
- They accumulate knowledge over time (via memory/RAG) — they *remember* past decisions
- They can be consulted: "Can the frontend handle real-time updates?" — the frontend owner answers that
- They push back: "That approach won't work because we tried it in Q1 and hit X problem"
- They own quality in their domain — they don't just implement, they have opinions

### Frontend Owner

**Role:** Owns the React/MUI frontend application. The team's frontend expert.

**Knows:**
- The full component tree, routing, state management patterns
- Why specific MUI components were chosen over alternatives
- Performance characteristics and known limitations
- History of past UI rewrites, what worked, what didn't
- The design guide and how to translate design intent into MUI

**Responsibilities:**
- Implement features and fix bugs in the frontend
- Pick up GitHub issues labeled `frontend` (including design issues from the Designer)
- Deploy to sandbox for review
- Advise during brainstorming on frontend feasibility and approach
- Maintain frontend-specific documentation

**Tools:**
- File ops (Read, Write, Edit, Glob, Grep)
- Git tools (full set — branch, commit, push, PR)
- Sandbox tools (create_worktree, deploy_sandbox, sandbox_status, sandbox_logs)
- GitHub CLI (read issues, create PRs, close issues)

**Does NOT have:** Playwright, web browsing

**Key context sources:**
- Design guide (to build UI that matches)
- Frontend architecture docs and project README
- GitHub issues labeled `frontend`
- Accumulated memory from past sessions (decisions, patterns, gotchas)

---

### Backend Owner

**Role:** Owns the NestJS backend API. The team's backend/API expert.

**Knows:**
- Service architecture, module structure, dependency injection patterns
- API contracts and how consumers use them
- Database schema, migrations, query patterns
- WebSocket gateway behavior and real-time event flow
- MCP server tool implementations and how agents interact with the backend

**Responsibilities:**
- Implement features and fix bugs in the backend
- Pick up GitHub issues labeled `backend`
- Deploy to sandbox for testing
- Advise during brainstorming on API design, data modeling, performance
- Maintain backend-specific documentation

**Tools:**
- File ops (Read, Write, Edit, Glob, Grep)
- Git tools (full set)
- Sandbox tools (create_worktree, deploy_sandbox, sandbox_status, sandbox_logs)
- GitHub CLI (read issues, create PRs, close issues)

**Does NOT have:** Playwright, web browsing

**Key context sources:**
- Backend architecture docs, API contracts, project README
- GitHub issues labeled `backend`
- Accumulated memory from past sessions

---

### DevOps Owner

**Role:** Owns infrastructure, deployments, and environments. The team's platform/ops expert.

**Knows:**
- Kubernetes cluster architecture (Minikube, namespaces, resource limits)
- Helm charts, helmfile, and how services are configured
- Networking stack (Tailscale, Traefik, CoreDNS, dnsmasq, Split DNS)
- Sandbox lifecycle and how environments are provisioned
- CI/CD patterns and deployment strategies
- What broke last time and why

**Responsibilities:**
- Manage Kubernetes configurations, Helm charts, helmfile
- Handle environment issues (networking, DNS, ingress, certificates)
- Manage sandbox lifecycle at the infrastructure level
- Monitor cluster health
- Advise during brainstorming on infrastructure feasibility and constraints

**Tools:**
- File ops (Read, Write, Edit, Glob, Grep)
- Git tools (full set)
- Kubernetes tools (kubectl, helm — may need Bash or structured K8s MCP tools)
- Sandbox tools (deploy, destroy, status, logs, list)
- GitHub CLI

**Does NOT have:** Playwright, web browsing

**Key context sources:**
- Infrastructure docs (cluster layout, networking, Tailscale setup)
- Helmfile and chart documentation
- Accumulated memory of past incidents and environment quirks

---

## Specialist Agents

Specialist agents have cross-cutting expertise that spans multiple projects. They don't own a codebase — they own a discipline.

### Designer

**Role:** UI/UX specialist, design system owner, user experience advocate.

**Knows:**
- The design guide and Material/MUI conventions
- Every page in the application — layout, purpose, interactions
- Current industry patterns (researches external sites)
- What "good" looks like and what to avoid

**Responsibilities:**
- Review deployed sandboxes for visual/interaction quality
- Maintain the design guide (Material/MUI-based)
- Research external sites for patterns and inspiration
- Create GitHub issues for design problems (labeled `design` + project domain)
- Ensure consistency with the design system across all pages

**Tools:**
- Playwright MCP (navigate, screenshot, click, fill, snapshot)
- Web browsing/research (fetch external sites for inspiration)
- File ops (Read, Write, Edit, Glob, Grep) — for design guide maintenance
- Git tools — for committing design guide updates
- GitHub CLI — for creating issues

**Does NOT have:** Sandbox deploy/destroy, application code editing authority

**Key context sources:**
- Site map with login flow (Keycloak credentials, navigation paths)
- Per-page documentation (purpose, key interactions, expected states)
- The design guide (source of truth for reviews)

**Design philosophy:**
- Material Design / MUI as the foundation
- No gradients
- No "AI aesthetic" (glow effects, particles, excessive blur, neon accents)
- Simple, clean, functional
- Let MUI do the heavy lifting — avoid custom styling when a standard component works

---

### API Specialist

**Role:** API quality specialist, contract owner, documentation enforcer. The Designer's counterpart for the backend surface area.

**Knows:**
- RESTful API design conventions and best practices
- OpenAPI/Swagger specification standards
- Every endpoint in the system — purpose, request/response shapes, auth requirements
- Versioning strategies and backward compatibility considerations
- Rate limiting, pagination, error response patterns
- What consumers (frontend, external clients) actually need from the API

**Responsibilities:**
- Review deployed sandboxes for API quality (hit endpoints, verify responses, check error handling)
- Maintain and generate Swagger/OpenAPI documentation
- Ensure endpoints follow consistent naming, HTTP method usage, status codes, error formats
- Verify API contracts match what the frontend actually consumes
- Create GitHub issues for API problems (labeled `api` + project domain)
- Research industry standards for API design patterns

**Tools:**
- Playwright MCP or HTTP tools (to hit sandbox endpoints, inspect responses)
- Web browsing/research (API design references, industry patterns)
- File ops (Read, Write, Edit, Glob, Grep) — for API docs and spec maintenance
- Git tools — for committing spec/doc updates
- GitHub CLI — for creating issues

**Does NOT have:** Sandbox deploy/destroy, application code editing authority

**Key context sources:**
- OpenAPI/Swagger specs (maintains these as source of truth)
- API design guide (conventions for naming, errors, pagination, auth)
- Endpoint documentation per service
- Frontend API consumption patterns (what the frontend actually calls and expects)

**API philosophy:**
- Consistent, predictable endpoint naming and response shapes
- Proper HTTP semantics (methods, status codes, idempotency)
- Meaningful error responses with actionable messages
- Documentation is not optional — every endpoint has a Swagger entry
- Design for consumers, not for the database schema

---

### Code Reviewer

**Role:** Code quality specialist, standards enforcer.

**Knows:**
- Project conventions and patterns across all codebases
- Common security pitfalls (OWASP top 10)
- What clean, maintainable code looks like in each project's stack

**Responsibilities:**
- Review branches/PRs for code quality, patterns, and correctness
- Check for security issues
- Verify consistency with project conventions
- Create GitHub issues for code problems (labeled `bug` or `refactor` + domain)

**Tools:**
- File ops (Read, Glob, Grep)
- Git tools (diff, log, status)
- GitHub CLI (issues, PR comments)

**Does NOT have:** Playwright, sandbox deploy, code editing authority

**Key context sources:**
- Project conventions and patterns documentation
- Linting/formatting standards per project

---

### Documentation Owner

**Role:** Technical writer, documentation curator, knowledge manager.

**Knows:**
- The full documentation structure across all projects
- What other agents need to know (especially the Designer's page docs)
- How to organize information for both humans and agents

**Responsibilities:**
- Keep `docs/` and project READMEs accurate and up-to-date
- Write per-page documentation that other agents consume (especially Designer)
- Curate and organize documentation structure
- Eventually feed into the memory/RAG system so agents get relevant context without context pollution

**Tools:**
- File ops (Read, Write, Edit, Glob, Grep)
- Git tools (full set)
- Web browsing (research documentation patterns, reference external docs)
- GitHub CLI (create issues for documentation gaps)

**Does NOT have:** Playwright, sandbox tools, application code editing

**Key context sources:**
- All project source code (read-only, for accuracy)
- Existing documentation
- The design guide (to document UI pages accurately)

---

## Shared Contracts & Cross-Cutting Conventions

Some artifacts aren't owned by a single agent — they sit at the boundary between domains and multiple agents depend on them. These need clear ownership and review processes.

### Frontend API Layer

The frontend must have a centralized API layer rather than scattered `fetch()` calls in hooks and components.

```
features/shared/api/
├── client.ts          # Configured fetch/axios instance, base URL, auth headers
├── endpoints.ts       # Every endpoint as a typed function: getChatSessions(), getClusterPods(), etc.
└── types.ts           # Request/response types that mirror the backend's DTOs
```

**Who owns what:**
- **Backend Owner** maintains the backend's OpenAPI/Swagger spec (generated from NestJS decorators or a maintained spec file). This is the source of truth for what endpoints exist and what they accept/return.
- **Frontend Owner** maintains the frontend API layer (`client.ts`, `endpoints.ts`, `types.ts`). This is the source of truth for what the frontend consumes.
- **API Specialist** reviews both sides and ensures they match. Drift between the spec and the API layer gets filed as issues — `api` + `frontend` if the frontend is wrong, `api` + `backend` if the backend is wrong or the spec is stale.

**Why this matters:**
- The Frontend Owner doesn't need to memorize endpoint URLs and response shapes — just imports from the API layer
- The Designer can see what data is available to the UI when reviewing interactions
- The API Specialist has two concrete artifacts to diff instead of reading scattered fetch calls
- Type mismatches get caught at the contract level, not at runtime

### Design Guide

- **Designer** owns and maintains this
- **Frontend Owner** builds to it
- **Documentation Owner** ensures it's accurate and well-organized
- Lives in `docs/` as a living document

### OpenAPI / Swagger Spec

- **Backend Owner** maintains the spec (or it's auto-generated from NestJS decorators)
- **API Specialist** reviews it for quality, consistency, and completeness
- **Frontend Owner** consumes it to keep the API layer in sync
- Should be generated/accessible from deployed sandboxes so the API Specialist can verify live behavior matches the spec

---

## Collaboration Flows

### Feature Development (typical)

```
User discusses idea with relevant Project Owner
  "Can we add real-time notifications to the frontend?"
       |
  Frontend Owner weighs in on feasibility, approach
       |
  User greenlights → Owner creates worktree + branch
       |
  Implements changes
       |
  Deploys to sandbox
       |
  User triggers Designer review
       |
  Designer navigates sandbox, screenshots, evaluates
       |
  Creates GitHub issues for any design problems
       |
  Frontend Owner picks up design issues (already knows the context)
       |
  Iterate until clean
       |
  Push + PR
```

### Brainstorming / Planning

```
User: "I want to add a file browser feature. What do you think?"
       |
  User consults relevant owners:
    - Frontend Owner: "MUI has a TreeView component, we could..."
    - Backend Owner: "We'd need a new controller for file ops..."
    - DevOps Owner: "MinIO is already in the cluster, we could..."
       |
  Each owner contributes domain expertise to shape the plan
```

### Design Review (standalone)

```
User: "Review the frontend in sandbox X"
       |
  Designer
       |
  Logs into sandbox via Keycloak
       |
  Navigates every page (using site map docs)
       |
  Screenshots + evaluates against design guide
       |
  Reports findings to user in chat
       |
  User discusses, selects which to file
       |
  Creates GitHub issues for approved findings
```

### API Contract Review

```
User: "Review the API in sandbox X"
       |
  API Specialist
       |
  Reads the backend's OpenAPI spec (from sandbox or repo)
       |
  Reads the frontend's API layer (endpoints.ts, types.ts)
       |
  Hits live endpoints in the sandbox to verify behavior matches spec
       |
  Compares: URLs, methods, request/response shapes, error formats
       |
  Reports drift and issues to user in chat
       |
  User discusses, selects which to file
       |
  Creates GitHub issues:
    - api + backend: spec is stale, endpoint behavior doesn't match
    - api + frontend: API layer is out of sync with spec
```

### Documentation Sweep

```
User: "Update docs for the chat feature"
       |
  Documentation Owner
       |
  Reads current source code for chat/
       |
  Reads existing docs
       |
  Updates docs/ and project README
       |
  Commits + pushes
```

---

## Context & Memory Strategy

Each agent accumulates knowledge over time. This is what transforms them from task executors into domain experts.

**What gets remembered (per agent):**
- Architectural decisions and *why* they were made
- Patterns that worked and patterns that failed
- Known tech debt and planned improvements
- Gotchas and non-obvious behavior
- Past incidents and their resolutions

**What does NOT need to be remembered** (derivable from code/git):
- File paths, function signatures, current code state
- Git history, recent changes
- Anything already in documentation

**Phase 1 (now):** Per-agent system prompts with role-specific documentation injected. Documentation lives in `docs/` and project READMEs.

**Phase 2 (Mastra migration):** RAG over `docs/` — agents query for what they need instead of getting everything injected. See `mastra-coding-agent-is-the-end-goal.md` for details.

**Phase 3:** Cross-agent semantic recall via shared `resourceId` scoping. Designer findings automatically available to the Frontend Owner when working the same feature. Past decisions from the Backend Owner available to the Code Reviewer when reviewing backend PRs.

---

## Backend Architecture

Each agent role is built as a self-contained definition file. The role defines the agent's identity (system prompt, tools, MCP servers). The provider handles execution (Claude Code SDK, OpenCode, Mastra). These are fully independent — swapping providers doesn't touch roles, adding roles doesn't touch providers.

### Directory structure

```
features/agent/
├── roles/
│   ├── role.interface.ts          # AgentRole interface + MCP config types
│   ├── role-registry.ts           # Looks up roles by name, lists available roles
│   ├── frontend-owner.role.ts
│   ├── backend-owner.role.ts
│   ├── devops-owner.role.ts
│   ├── designer.role.ts
│   ├── api-specialist.role.ts
│   ├── code-reviewer.role.ts
│   └── documentation.role.ts
├── providers/                     # Unchanged — handles SDK execution
│   ├── provider.interface.ts
│   ├── provider-registry.ts
│   ├── claude-code.provider.ts
│   └── opencode.provider.ts
├── agent.service.ts               # Session now has a `role` field
├── agent.gateway.ts               # Unchanged — role-agnostic
└── agent.module.ts
```

### Role interface

```typescript
interface McpServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface AgentRole {
  /** Unique identifier: 'frontend-owner', 'designer', etc. */
  name: string;

  /** Human-readable: 'Frontend Owner', 'Designer', etc. */
  displayName: string;

  /** Short description for the UI role picker */
  description: string;

  /** Build the system prompt — may read docs from disk */
  buildSystemPrompt(): string;

  /** Exact list of tools this role can use */
  allowedTools: string[];

  /** MCP servers to attach for this role's sessions */
  mcpServers: Record<string, McpServerConfig>;
}
```

### How roles plug into the provider

Today `ClaudeCodeProvider` hardcodes the tool list and MCP servers. With roles, these come from the role definition and pass through via `AgentQueryOptions`:

```typescript
// provider.interface.ts — extended options
interface AgentQueryOptions {
  cwd: string;
  model: string;
  systemPrompt?: string;
  abortController: AbortController;
  resume?: string;
  allowedTools?: string[];                        // NEW — from role
  mcpServers?: Record<string, McpServerConfig>;   // NEW — from role
}

// claude-code.provider.ts — uses role config instead of hardcoded values
async *query(prompt: string, options: AgentQueryOptions) {
  const queryOptions = {
    cwd: options.cwd,
    model: options.model,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    abortController: options.abortController,
    allowedTools: options.allowedTools,    // From role, not hardcoded
    mcpServers: options.mcpServers,        // From role, not hardcoded
  };
  // ... rest unchanged
}
```

### Session creation

When creating a session, the user picks a role (and optionally a provider):

```typescript
// agent.service.ts
createSession(roleName: string, model?: string, provider?: string): SessionInfo {
  const role = this.roleRegistry.getRole(roleName);
  const session: Session = {
    id: uuidv4(),
    role: roleName,
    provider: provider || 'claude-code',
    model: model || 'claude-sonnet-4-20250514',
    systemPrompt: role.buildSystemPrompt(),
    // ...
  };
}

// sendMessage passes role config to provider
async *sendMessage(sessionId: string, message: string) {
  const role = this.roleRegistry.getRole(session.role);
  const stream = provider.query(message, {
    // ...existing options
    allowedTools: role.allowedTools,
    mcpServers: role.mcpServers,
  });
}
```

### Example role file

```typescript
// roles/designer.role.ts
import { AgentRole, McpServerConfig } from './role.interface';
import * as path from 'path';

export class DesignerRole implements AgentRole {
  readonly name = 'designer';
  readonly displayName = 'Designer';
  readonly description = 'UI/UX specialist — reviews sandboxes, maintains the design guide';

  readonly allowedTools = [
    // File ops — for design guide maintenance
    'Read', 'Write', 'Edit', 'Glob', 'Grep',
    // Git — for committing design guide updates
    'mcp__workspace__git_status',
    'mcp__workspace__git_diff',
    'mcp__workspace__git_add',
    'mcp__workspace__git_commit',
    'mcp__workspace__git_push',
    'mcp__workspace__git_branch',
    // Playwright — for sandbox review
    'mcp__playwright__browser_navigate',
    'mcp__playwright__browser_snapshot',
    'mcp__playwright__browser_take_screenshot',
    'mcp__playwright__browser_click',
    'mcp__playwright__browser_fill',
    'mcp__playwright__browser_resize',
    // No deploy/destroy, no worktree creation
  ];

  readonly mcpServers: Record<string, McpServerConfig> = {
    workspace: {
      type: 'stdio',
      command: 'node',
      args: [path.join(__dirname, '..', '..', '..', 'mcp-server.js')],
      env: { REPO_ROOT: process.env.REPO_ROOT || '/workspace' },
    },
    playwright: {
      type: 'stdio',
      command: 'npx',
      args: ['@anthropic-ai/mcp-playwright'],  // or whichever Playwright MCP server we choose
    },
  };

  buildSystemPrompt(): string {
    return [
      'You are the Designer on THE Dev Team.',
      'You own the UI/UX quality and the design system.',
      '',
      '## Your expertise',
      '- Material Design / MUI conventions',
      '- Visual hierarchy, spacing, typography, color',
      '- User interaction patterns and accessibility',
      '- You research external sites for inspiration',
      '',
      '## Design philosophy',
      '- Material/MUI is the foundation — use standard components',
      '- No gradients',
      '- No "AI aesthetic" (glow, particles, blur, neon)',
      '- Simple, clean, functional',
      '',
      '## What you do',
      '- Review deployed sandboxes: navigate, screenshot, evaluate',
      '- Compare what you see against the design guide',
      '- Report findings and discuss with the user',
      '- Create GitHub issues for approved findings',
      '- Maintain and update the design guide',
      '',
      '## What you do NOT do',
      '- You do not write application code',
      '- You do not deploy or destroy sandboxes',
      '- You create issues; project owners implement fixes',
      '',
      // ... login instructions, site map, design guide content
    ].join('\n');
  }
}
```

### Adding a new agent

1. Create `roles/new-role.role.ts` implementing `AgentRole`
2. Register it in `role-registry.ts`
3. The frontend role picker automatically includes it
4. No changes to providers, gateway, or service logic

### What stays generic (role-agnostic)

- **AgentProvider interface** — knows nothing about roles, just executes prompts with config
- **AgentGateway** — routes messages, normalizes output, doesn't care which role is active
- **Session persistence** — stores the role name, loads the role definition at runtime
- **Message normalization** — same output shape regardless of role

### What's role-specific (contained in role files)

- System prompt (personality, expertise, instructions)
- Allowed tools list
- MCP server configuration
- Any role-specific documentation that gets injected into the prompt

---

## Open Questions

- How does the Designer handle responsive design review? (multiple viewport sizes via Playwright resize)
- Should there be a QA/Testing Agent separate from the Designer? (functional testing vs visual testing)
- How do agents authenticate to GitHub? (shared token, per-agent tokens, or service account?)
- What's the issue lifecycle? Auto-close when PR merges, or require explicit verification?
- How do Project Owners handle cross-project changes? (e.g., a feature that needs both frontend and backend work — do they coordinate via issues, or does the user mediate?)
- As new projects are added to the repo, do we spin up a new Owner agent for each one?
