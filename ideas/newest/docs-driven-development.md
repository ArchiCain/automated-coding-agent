# Docs-Driven Development

## Core Principle

Documentation is the specification. To change what the system builds, change the docs first — agents make the code match.

## The .docs/ Convention

Documentation lives in `.docs/` directories **co-located with the code** they describe. This means docs are always right next to the source files, making it trivial to compare spec vs implementation.

### Structure

```
projects/application/frontend/app/
├── .docs/                          # Project-level docs
│   ├── overview.md                 # What the app is, tech stack, architecture
│   └── standards/
│       ├── coding.md               # Angular patterns, file naming, code style
│       └── design.md               # Colors, typography, component patterns
└── src/app/features/
    ├── keycloak-auth/
    │   ├── .docs/                  # Feature-level docs
    │   │   ├── requirements.md     # What the feature does, acceptance criteria
    │   │   ├── flows.md            # Step-by-step user journeys
    │   │   └── test-data.md        # Credentials, edge cases
    │   ├── guards/                 # Actual code
    │   ├── services/
    │   └── ...
    ├── user-management/
    │   ├── .docs/
    │   │   ├── requirements.md
    │   │   ├── flows.md
    │   │   └── test-data.md
    │   ├── components/
    │   └── ...
```

### Doc File Types

| File | Purpose | When to use |
|------|---------|-------------|
| `requirements.md` | What the feature does, components needed, acceptance criteria | Every feature |
| `flows.md` | Step-by-step user journeys — the acceptance tests | Features with user-facing flows |
| `test-data.md` | Credentials, seed data, edge cases, error scenarios | Features with auth, API, or test config |

### Rules

- Every feature directory gets a `.docs/` with at least `requirements.md`
- Project-level `.docs/` holds overview and standards (global rules)
- Docs describe **what should exist**, code is **what does exist**
- The diff between docs and code defines the work

## Projects Using This Convention

| Project | Docs root | Description |
|---------|-----------|-------------|
| Frontend | `frontend/app/.docs/` + feature `.docs/` | Angular 21 app |
| Backend | `backend/.docs/` + feature `.docs/` | NestJS REST API |
| Keycloak | `keycloak/.docs/` | Auth server config |
| Database | `database/.docs/` | PostgreSQL setup |
| E2E Tests | `e2e/.docs/` + test suite `.docs/` | Playwright tests |

## The Docs Assistant

A Mastra-powered agent in THE Dev Team UI (`/docs` page) that can:

1. **Read docs and code** — `listDir`, `readFile`, `writeFile` tools scoped to `projects/application/`
2. **Review features** — Read project-level docs first (overview + standards), then feature `.docs/`, then source code, compare
3. **Edit docs** — Update documentation to match reality or spec changes
4. **Token tracking** — Per-step usage breakdown showing exactly what each LLM call costs

### Agent System Instructions

The agent always reads project-level `.docs/` (overview + standards) before reviewing any feature. When asked to review a feature, it reads all `.docs/` files, then all source files, and compares.

## The Docs Page UI

- **Left sidebar:** Expandable project tree showing all 5 projects
- **Code toggle:** Defaults to docs-only view; toggle shows full source tree
- **Center panel:** Markdown viewer (with GFM tables) or code viewer
- **Edit mode:** Raw markdown editor with save-to-pod
- **Chat bubble:** Docs Assistant agent with token usage tracking

## Future: Autonomous Review Loop

See `ideas/sandbox-agent-loop.md` — sandboxes spin up cron-scheduled agents that continuously audit docs vs code and implement changes.
