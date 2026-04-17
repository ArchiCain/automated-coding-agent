# Documentation Standard

How we document code across all projects. The core principle: **the code is the documentation.** Well-named functions, types, and files are the primary source of truth. Comments and READMEs exist to fill the gaps that code alone cannot express.

---

## The Documentation Hierarchy

```
Repository
├── docs/                        # Global architecture, infrastructure, getting started
├── projects/{name}/
│   ├── README.md                # Project-level: what it is, how to run it, feature index
│   └── src/features/{name}/
│       ├── README.md            # Feature-level: topology, contracts, constraints, portability
│       ├── types.ts             # Data contract documentation (the types ARE the docs)
│       ├── services/            # Behavior documentation (the method names ARE the docs)
│       └── ...                  # "Why" comments where decisions are non-obvious
```

Each layer has a distinct job:

| Layer | Purpose | Updated when |
|-------|---------|-------------|
| **Global docs** (`docs/`) | Architecture decisions, infrastructure, cross-project standards | Standards or infrastructure change |
| **Project README** | What the project is, how to run it, links to features | Features are added or removed |
| **Feature README** | How pieces connect, backend contracts, constraints, portability | Feature's public API or integration changes |
| **Types** | Data shapes and contracts | API contracts change |
| **Code + comments** | Implementation and non-obvious decisions | Code changes |

---

## Comments

### The Rule

Comments explain **why**, never **what**. The code already says what it does. If the code is too confusing to read without a "what" comment, the code needs to be clearer — not the comment louder.

### Good Comments

```typescript
// Redirect to /home not /login — user IS authenticated, just unauthorized
router.navigate(['/home']);

// Keycloak uses email as username — the login form labels this "Email"
// but the API field is still called "username" for compatibility
username: email,

// Queue retries behind a single refresh to prevent multiple concurrent
// refresh calls when several requests 401 simultaneously
if (isRefreshing) {
  return refreshComplete$.pipe(...);
}

// Soft delete — Keycloak disables the user rather than removing them,
// preserving audit trail and allowing re-enablement
await this.keycloakAdmin.users.update({ id }, { enabled: false });
```

These comments survive code changes because they explain the **reasoning**, not the mechanics.

### Bad Comments

```typescript
// Check if the user is authenticated
if (authService.isAuthenticated()) { ... }

// Get all users
getUsers(): Observable<User[]> { ... }

// Set loading to true
this.loading.set(true);

// AuthService handles authentication
@Injectable({ providedIn: 'root' })
export class AuthService { }
```

These comments restate what the code already says. They add noise and they rot — when the code changes, someone forgets to update the comment, and now it's misleading.

### When to Comment

| Situation | Comment? | Example |
|-----------|----------|---------|
| Non-obvious business logic | Yes | Why soft-delete instead of hard-delete |
| Workaround for a known issue | Yes | Framework bug, browser quirk, upstream limitation |
| Performance-critical decision | Yes | Why this algorithm, why this caching strategy |
| Integration constraint | Yes | Why withCredentials is required, why a specific header |
| Self-evident code | No | Variable assignments, standard CRUD, clear function names |
| Type definitions | No | The type itself is the documentation |
| Standard framework patterns | No | Guards, interceptors, lifecycle hooks used normally |

### Comment Style

- Use `//` for single-line comments. No `/* */` blocks unless disabling a linter rule.
- Place the comment on the line **above** the code it explains, not inline.
- No JSDoc on private methods or internal functions — save it for public API surfaces that are exported from barrel files and genuinely need parameter documentation.
- No `@author`, `@date`, `@version` — that's what git blame is for.
- No commented-out code. Delete it. Git has history.
- No TODO comments without a linked issue. Untracked TODOs are where good intentions go to die.

---

## Feature READMEs

Every feature directory gets a `README.md`. It serves as the **map** — it tells you how the pieces connect and where to look, without duplicating what the code already says.

### Structure

```markdown
# {Feature Name}

One-line description of what this feature does.

## Integration
How to wire this feature into an application. What to call, what to import, 
what config is needed. This is the "quick start" for using the feature.

## How It Works
Numbered list of the flow — how the pieces connect at runtime.
Each step references a specific file: "see guards/auth.guard.ts".
This section answers: "if I change one piece, what else is affected?"

## Backend Contract (if applicable)
The endpoints this feature depends on, with request/response shapes.
This is the single source of truth for what the frontend expects from the backend.
When the backend changes, this section gets updated.

## Constraints
Rules that prevent mistakes. Things like "never do X because Y."
These are the non-obvious gotchas that an agent or new developer would hit.

## Portability (if applicable)
How to extract this feature and drop it into another project.
What assumptions it makes about the host application.
```

### What Does NOT Go in a Feature README

- **Implementation details** — don't describe how a function works internally. That's the code's job.
- **Type definitions** — don't repeat the types. Point to `types.ts`.
- **Changelog** — that's git log.
- **Line-by-line walkthroughs** — if someone needs that, the code isn't clean enough.

### Keeping READMEs in Sync

A feature README is part of the feature. When a ticket changes a feature's public API, integration steps, or backend contract, the README update is part of the ticket — not a follow-up. The same PR that changes the code changes the README.

---

## Project READMEs

Each project (`projects/{name}/`) has a root `README.md` that serves as the entry point.

### Structure

```markdown
# {Project Name}

What this project is and what it does. 1-2 sentences.

## Quick Start
How to run it locally. Commands, prerequisites, config needed.

## Tech Stack
Framework, major libraries, runtime requirements.

## Features
| Feature | Path | Description |
|---------|------|-------------|
| Auth | `src/features/auth/` | Cookie-based Keycloak authentication with permission-based access control |
| Users | `src/features/users/` | User management CRUD with server-side pagination |
| ... | ... | ... |

Each feature has its own README with detailed documentation.

## Architecture
High-level description of how the app is structured.
Routing strategy, state management approach, API layer pattern.
Keep it brief — link to feature READMEs for detail.
```

---

## How This Works With the Memory System

The documentation hierarchy maps directly to how agents discover and learn about the codebase:

1. **Discovery** — Agent reads project README, sees feature index, navigates to the relevant feature README.
2. **Understanding** — Feature README explains topology, contracts, and constraints. Agent knows how to integrate without reading every file.
3. **Implementation** — Agent reads types.ts for data shapes, reads specific code files for behavior. "Why" comments prevent repeating past mistakes.
4. **Crystallization** — When an agent discovers something non-obvious (a gotcha, a workaround), it becomes a "why" comment in the code or a constraint in the README. Future agents find it where they need it.

The key insight: READMEs are for **navigation and context**. Code is for **behavior and contracts**. Comments are for **decisions and reasoning**. Each has a distinct job. Nothing is duplicated across layers.
