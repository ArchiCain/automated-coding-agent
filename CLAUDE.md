# CLAUDE.md

## Documentation-Driven Development

This repo follows a docs-driven development approach. `.docs/` directories are the specification — the source of truth for what code should do. The delta between `.docs/` and code defines all work.

**Core principle:** If a feature is not documented, it doesn't exist. If it's documented incorrectly, it's broken.

## Finding Documentation

Documentation is colocated with the code it describes. Look for `.docs/` at the level you're working in:

### Repo-level (standards and conventions)

```
.docs/
├── overview.md                         # What this repo is, how it's organized
└── standards/
    ├── docs-driven-development.md      # The .docs/ convention itself (file types, rules)
    ├── feature-architecture.md         # Code lives in features/, not pages/endpoints
    ├── project-architecture.md         # Project structure patterns
    ├── environment-configuration.md    # .env and config patterns
    └── task-automation.md              # Taskfile patterns
```

### Infrastructure

```
infrastructure/.docs/overview.md        # High-level deployment stack
infrastructure/k8s/.docs/
├── overview.md                         # Helmfile, charts, releases, sandboxes
├── networking.md                       # Traefik, DNS, hostnames, dnsmasq
└── tailscale.md                        # Tailnet, split DNS, gateway pod
infrastructure/terraform/.docs/
└── overview.md                         # EC2 provisioning, K3s install
```

### CI/CD

```
.github/.docs/
├── overview.md                         # What CI/CD does, deployment model
├── spec.md                             # Triggers, secrets, services, steps
└── decisions.md                        # Why branch-based deploys, etc.
```

### Project-level

```
projects/{project}/{app}/.docs/
├── overview.md                         # What this project is, tech stack
└── standards/
    ├── coding.md                       # Code patterns, naming, structure
    └── design.md                       # Visual design spec (frontend only)
```

### Feature-level

```
projects/{project}/{app}/src/features/{feature}/.docs/
├── spec.md                             # WHAT to build (always required)
├── flows.md                            # HOW it works step-by-step
├── contracts.md                        # API shapes, event schemas
├── test-plan.md                        # HOW to verify it works
├── test-data.md                        # WITH what data to test
└── decisions.md                        # WHY it's this way
```

## How to Use .docs/

1. **Before modifying code** — read the `.docs/` at that level to understand what the code should do
2. **Before adding a feature** — write the spec first, then implement to match it
3. **When confused about architecture** — check `.docs/standards/` at the repo level
4. **When working on infrastructure** — check the `.docs/` colocated with that subsystem

## Key Conventions

- `spec.md` describes observable behavior, not implementation details
- `contracts.md` is the bridge between frontend and backend
- `test-plan.md` maps back to acceptance criteria in the spec
- Standards in `.docs/standards/` apply to everything below that directory
- The full DDD standard is at `.docs/standards/docs-driven-development.md`
