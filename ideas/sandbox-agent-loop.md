# Sandbox Agent Loop — Idea Document

## Core Concept

Sandboxes are the trigger mechanism for autonomous work. When a sandbox spins up, it gets a worktree/branch and a set of cron-scheduled agents that continuously review, implement, and test changes for the duration of the sandbox's lifecycle.

## Flow

```
Sandbox created (worktree + branch)
    │
    ├── Cron: Doc Reviewer Agent (loop)
    │     Reads .docs/, reads code, flags gaps/inaccuracies
    │
    ├── Cron: Implementation Agent (loop)
    │     Reads .docs/ as spec, compares to code, implements missing features
    │
    ├── Cron: Test Agent (loop)
    │     Runs tests against sandbox, reports failures, writes missing tests
    │
    ├── Cron: Design Reviewer Agent (loop)
    │     Visits sandbox via Playwright, reviews UI against design docs
    │
    └── All agents push to the sandbox's branch
            │
            ▼
    PR created → merge into environment branch
            │
            ▼
    Final review + testing stage
            │
    Crons pause after PR submitted (?)
```

## Key Design Questions

### When do crons pause?
- **Option A: Pause after PR submitted.** Agents stop working, human reviews. Simple but wastes sandbox time if review takes a while.
- **Option B: Keep running, but switch to review-response mode.** After PR, agents only respond to review comments (like the current Designer → FE Owner loop). New work stops, but iteration on feedback continues.
- **Option C: Pause on PR, resume on review comments.** Hybrid — agents sleep until a review event wakes them up. Saves compute.

### How do agents coordinate?
- Each agent has a specific role and doesn't step on others' work
- Could use file-based signals (e.g. `.agent-status.json` in the worktree)
- Or a shared state in the router's state.json
- Agents should be aware of each other's recent commits to avoid conflicts

### What triggers a sandbox?
- A GitHub issue with specific labels (current model)
- A doc change (docs-driven: change the spec, sandbox auto-creates to implement)
- Manual trigger from the UI
- Scheduled (nightly review of all docs vs code)

### Sandbox lifecycle
```
Created → Agents running → PR submitted → Review → Merged → Cleanup
                                              │
                                              └── Changes requested → Agents resume
```

## Agent Roles (Specialized)

| Agent | Trigger | Reads | Writes | Tests |
|-------|---------|-------|--------|-------|
| Doc Reviewer | Cron (e.g. every 5 min) | .docs/ + code | Updated .docs/ | — |
| Implementer | Cron (after doc review) | .docs/ as spec | Source code | Runs build |
| Test Writer | Cron (after implementation) | Code + .docs/flows.md | Test files | Runs tests |
| Design Reviewer | Cron (after deploy) | Design docs + sandbox URL | Review comments | Playwright |
| PR Manager | Event-driven | All agent output | PR description, review responses | — |

## Relationship to Current System

The current Router polls GitHub for issues/PRs and spawns agents reactively. This proposal makes it proactive:
- Instead of waiting for issues, agents continuously audit docs vs code
- Instead of one-shot agent runs, agents loop within a sandbox
- The sandbox IS the work environment — agents own it for its duration

## Open Questions

- How to handle conflicting changes between agents in the same sandbox?
- Should each agent get its own branch, or share one sandbox branch?
- What's the right cron interval? Too fast = wasted tokens, too slow = slow iteration
- How to prevent infinite loops (agent changes code, doc reviewer flags it, implementer changes it back)?
- Should the doc reviewer have veto power to block PR submission if docs don't match?
- Cost controls — budget per sandbox? Token limits per agent per cycle?
