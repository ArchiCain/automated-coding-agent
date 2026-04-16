# Environment-Scoped Agents & Handoff Model

## Core Concept

Agents are scoped to environments, not global. Each environment (main, sandbox-xyz) gets its own set of agents. When creating a session, you pick both the **role** (Frontend Owner, Designer, DevOps) and the **environment** (main, sandbox-feature-123). The agent's system prompt is built with that environment's full context — URLs, branch, namespace, credentials.

## Why

- Agents need to know *where* they're working — which branch, which deployed URLs, which namespace
- "Fix the login page" means different things in main vs sandbox-feature-auth
- The Designer needs to browse a specific deployment, not guess which one
- The DevOps agent needs to know which namespace to manage
- Eliminates the user having to say "in sandbox X" every message

## Role Boundaries

| Role | Owns | Does NOT do |
|------|------|-------------|
| **Frontend Owner** | Code in `projects/application/frontend/` | Deploy, infrastructure, design review |
| **Backend Owner** | Code in `projects/application/backend/` | Deploy, infrastructure |
| **DevOps Owner** | Deployments, K8s, infrastructure, sandbox lifecycle | Write application code |
| **Designer** | Design review, design docs, theme files | Write application code, deploy |
| **Code Reviewer** | Code quality review across all codebases | Write code, deploy |
| **API Specialist** | API quality, OpenAPI specs, contract review | Write application code, deploy |
| **Documentation Owner** | docs/, READMEs, knowledge management | Write application code, deploy |

## Environments

### Main Environment
- **Branch:** main
- **Namespace:** app
- **URLs:** app.{DEV_HOSTNAME}, api.{DEV_HOSTNAME}, auth.{DEV_HOSTNAME}
- **Agents:** Full set — all roles available
- **Lifecycle:** Always running, persistent

### Sandbox Environments
- **Branch:** feature-xyz (created via worktree)
- **Namespace:** sandbox-{name}
- **URLs:** app-{name}.{DEV_HOSTNAME}, api-{name}.{DEV_HOSTNAME}
- **Agents:** Full set — scoped to this sandbox's branch/namespace/URLs
- **Lifecycle:** Created on demand, destroyed when done

## Session Creation

When creating a chat session, the user selects:
1. **Environment** — main, sandbox-feature-auth, sandbox-dark-mode, etc.
2. **Role** — Frontend Owner, Designer, DevOps Owner, etc.

The system prompt is built from the combination:
```
buildSystemPrompt(role, environment) → prompt with:
  - Role expertise and boundaries
  - Environment branch, namespace, URLs, credentials
  - Available tools (role-specific)
  - Workflow instructions (environment-specific)
```

## Example Flows

### Feature Development
```
1. User creates session: DevOps Owner + main
2. "Create a sandbox for the dark-mode feature"
3. DevOps agent creates worktree (branch: feature/dark-mode) + deploys sandbox
4. Sandbox "dark-mode" now exists with its own namespace + URLs

5. User creates session: Frontend Owner + sandbox-dark-mode
6. "Implement dark mode toggle in the header"
7. Frontend Owner works on feature/dark-mode branch, knows sandbox URLs
8. Makes code changes, can ask DevOps to redeploy

9. User creates session: Designer + sandbox-dark-mode
10. "Review the dark mode implementation"
11. Designer browses http://app-dark-mode.{DEV_HOSTNAME}, reviews against design guide
12. Creates issues for any problems

13. User creates session: DevOps Owner + sandbox-dark-mode
14. "Merge this to main and clean up"
15. DevOps agent creates PR, destroys sandbox after merge
```

### Design Review on Main
```
1. User creates session: Designer + main
2. "Review the user management pages"
3. Designer knows to browse http://app.{DEV_HOSTNAME}/admin/users
4. Reviews against design guide, reports findings
```

## Data Model Changes

### Environment Registry
```typescript
interface Environment {
  name: string;              // 'main', 'sandbox-dark-mode'
  type: 'main' | 'sandbox';
  branch: string;            // 'main', 'feature/dark-mode'
  namespace: string;         // 'app', 'sandbox-dark-mode'
  urls: {
    frontend: string;        // 'http://app.hostname'
    backend: string;         // 'http://api.hostname'
    keycloak: string;        // 'http://auth.hostname'
  };
  credentials: {
    admin: { username: string; password: string };
    testUser: { username: string; password: string };
  };
  createdAt: Date;
  status: 'active' | 'deploying' | 'destroying';
}
```

### Session Changes
```typescript
interface Session {
  id: string;
  role: string;              // 'frontend-owner'
  environment: string;       // 'main', 'sandbox-dark-mode'
  // ... existing fields
}
```

### Role System Prompt Builder
```typescript
interface AgentRole {
  // ... existing fields
  buildSystemPrompt(environment: Environment): string;  // Now takes environment
}
```

## Environment Discovery

The main environment is always known (from DEV_HOSTNAME + fixed namespace). Sandboxes are discovered from:
- Kubernetes: list namespaces matching `sandbox-*`
- Each sandbox namespace has labels/annotations with branch name, creator, etc.
- The `list_sandboxes` MCP tool already does this

## UI Changes

The chat sidebar needs:
1. **Environment selector** (dropdown above role selector)
   - "main" always listed
   - Active sandboxes listed below
   - "Create sandbox..." option at bottom
2. **Role selector** (existing, below environment)
3. Sessions grouped or tagged by environment

## Open Questions

- Should sandbox agents share memory/context? (e.g., Frontend Owner in sandbox-X can see what Designer found)
- When a sandbox is destroyed, what happens to its sessions? Archive? Delete?
- Should the DevOps agent be the only one who can create/destroy sandboxes, or should any agent be able to request it?
- How does the environment registry stay in sync with actual K8s state? Poll? Watch? Event-driven?
- Per-sandbox credentials — should each sandbox get its own Keycloak realm/users, or share main's?
