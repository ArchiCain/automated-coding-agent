# Documentation-Driven Development Standard

## Philosophy

From the perspective of a user, if a feature is not documented, it doesn't exist. If it's documented incorrectly, it's broken. The delta between `.docs/` and code defines all work.

## The `.docs/` Convention

Every project and feature directory may contain a `.docs/` subdirectory. These are the specification — the source of truth for what the code should do.

### Directory Hierarchy

```
repo/
├── .docs/                                  # Repo-level docs
│   ├── overview.md                         # What this repo is, how it's organized
│   └── standards/                          # Conventions that apply everywhere
│       ├── docs-driven-development.md      # This file — the .docs/ convention
│       ├── feature-architecture.md         # Code organization patterns
│       ├── project-architecture.md         # Project structure patterns
│       ├── environment-configuration.md    # .env and config patterns
│       └── task-automation.md              # Taskfile patterns
│
├── infrastructure/
│   └── .docs/                              # Infrastructure-level docs
│       ├── overview.md                     # Index for this directory
│       └── ecosystem.md                    # Host roles, deploy flow, diagrams
│
├── projects/
│   └── {project}/
│       └── {app}/                          # e.g., backend/, frontend/
│           ├── .docs/                      # Project-level docs
│           │   ├── overview.md             # What this project is, tech stack, features table
│           │   └── standards/
│           │       ├── coding.md           # Code patterns, naming, structure
│           │       └── design.md           # Visual design spec (frontend only)
│           └── src/
│               └── features/
│                   └── {feature}/
│                       └── .docs/          # Feature-level docs
│                           ├── spec.md         # WHAT to build (always required)
│                           ├── flows.md        # HOW it works step-by-step
│                           ├── contracts.md    # API shapes, event schemas, shared types
│                           ├── test-plan.md    # HOW to verify it works
│                           ├── test-data.md    # WITH what data to test
│                           └── decisions.md    # WHY it's this way
```

### File Types

#### `spec.md` — What to Build (always required)

Every feature has a spec. This is the syncing agent's primary input. It answers: "What should this feature do?"

**Structure:**
```markdown
# {Feature Name} — Spec

## Purpose
One paragraph. What problem does this solve?

## Behavior
- Bullet points describing what the feature does
- Each bullet is a verifiable statement
- Described in terms an agent can act on

## Components / Endpoints / Services
Tables listing the parts of the feature.

## Acceptance Criteria
- [ ] Checkbox list
- [ ] Each item maps to something testable
- [ ] The syncing agent checks these off as it implements
- [ ] The tester agent verifies each one
```

**Rules:**
- No test-specific content (response examples, error scenarios, seed data → goes in test-plan.md / test-data.md)
- No implementation details (how the code is structured → that's the agent's job)
- Focus on observable behavior

#### `flows.md` — How It Works Step-by-Step

Narrative user journeys and system flows. Shows what happens from trigger to outcome.

**When required:** Any feature with user interaction, multi-step behavior, or async operations.

**Structure:**
```markdown
# {Feature Name} — Flows

## Flow 1: {Happy Path Name}

1. User does X
2. System calls Y
3. Response is Z
4. UI updates to show W

## Flow 2: {Error Path Name}

1. User does X
2. System returns error because Y
3. UI shows error message Z
```

**Rules:**
- Number every step
- Show API calls with method and route
- Show state changes explicitly
- Include both happy and error paths

#### `contracts.md` — API Shapes and Shared Types

The bridge between frontend and backend. Defines request/response shapes, event schemas, and shared types.

**When required:** Any feature that crosses a boundary (frontend↔backend, service↔service, app↔database).

**Structure:**
```markdown
# {Feature Name} — Contracts

## Endpoints

### `GET /api/route`
**Auth:** Required / Public
**Response:**
\`\`\`typescript
{ field: string; count: number }
\`\`\`

### `POST /api/route`
**Auth:** Required
**Request:**
\`\`\`typescript
{ name: string; email: string }
\`\`\`
**Response:**
\`\`\`typescript
{ id: string; name: string; email: string }
\`\`\`

## Events (WebSocket / SSE)

### `event-name`
\`\`\`typescript
{ type: 'event-name'; payload: { ... } }
\`\`\`

## Shared Types
\`\`\`typescript
interface User { id: string; email: string; role: 'admin' | 'user' }
\`\`\`
```

#### `test-plan.md` — How to Verify It Works

The tester agent's primary playbook. Describes test scenarios with expected outcomes.

**When required:** Every testable feature (which is most features).

**Structure:**
```markdown
# {Feature Name} — Test Plan

## Contract Tests
- [ ] `GET /route` returns 200 with correct shape
- [ ] `POST /route` with invalid body returns 400
- [ ] Unauthorized request returns 401

## Behavior Tests
- [ ] {Maps to acceptance criterion from spec}
- [ ] {Maps to acceptance criterion from spec}

## E2E Scenarios
- [ ] {Full user journey from flows.md}
- [ ] {Error recovery scenario}
```

**Rules:**
- Each test maps back to a spec acceptance criterion or a flow
- Assert behavior, not implementation details
- Include expected status codes, response shapes, UI states

#### `test-data.md` — Concrete Test Data

Credentials, seed data, mock responses, and configuration needed to run tests.

**When required:** Features that need specific data to test (auth, CRUD, forms).

**Structure:**
```markdown
# {Feature Name} — Test Data

## Test Accounts
| Email | Password | Role | Permissions |
|-------|----------|------|-------------|
| admin@test.com | admin123 | admin | users:* |

## Seed Data
{JSON or table of records that should exist before tests run}

## API Examples
### Success Response
\`\`\`json
{ "id": "abc-123", "email": "admin@test.com" }
\`\`\`

### Error Response
\`\`\`json
{ "statusCode": 400, "message": "Validation failed" }
\`\`\`
```

#### `decisions.md` — Why It's This Way

Captures architectural decisions, trade-offs, and things that were tried and rejected. The history agent writes to this; all agents and humans read it.

**When required:** Features with non-obvious architectural choices. Often populated over time rather than written upfront.

**Structure:**
```markdown
# {Feature Name} — Decisions

## {Date}: {Decision Title}
**Context:** Why this came up
**Decision:** What we chose
**Alternatives considered:** What we rejected and why
**Consequences:** What this means going forward
```

### When Each File Is Required

| File | Required When |
|------|---------------|
| `spec.md` | **Always** — every feature has one |
| `flows.md` | Feature has user interaction, multi-step behavior, or async operations |
| `contracts.md` | Feature crosses a boundary (frontend↔backend, service↔database) |
| `test-plan.md` | Feature is testable (most features) |
| `test-data.md` | Tests need specific data (auth, CRUD, forms with seed data) |
| `decisions.md` | Non-obvious architectural choices exist (often added over time) |

### Agent Access by Doc Type

| Doc File | Syncing Agent | Test Writer | Tester Agent | Doc Assistant | History Agent | PR Reviewer |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| `spec.md` | yes | yes | yes | yes | yes | yes |
| `flows.md` | yes | yes | yes | yes | yes | yes |
| `contracts.md` | yes | yes | yes | yes | yes | yes |
| `standards/` | yes | no | no | yes | yes | yes |
| `test-plan.md` | **no** | **yes (primary)** | **yes (primary)** | yes | yes | yes |
| `test-data.md` | **no** | **yes** | **yes** | yes | yes | yes |
| `decisions.md` | yes (read) | no | no | yes | yes (read+write) | yes |

### Workflow

```
1. Human writes/updates spec.md, flows.md, contracts.md
2. Doc Assistant reviews: complete? testable? unambiguous?
3. Test Writer Agent creates test-plan.md + test code from spec
4. Syncing Agent implements code to match spec (runs contract + behavior tests)
5. Deploy to sandbox
6. Tester Agent runs E2E tests against live sandbox
7. PR created, PR Reviewer checks spec compliance
8. History Agent appends to decisions.md as patterns emerge
```
