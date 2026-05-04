# Agent hierarchy: multi-orchestrator pattern

**Date:** 2026-04-30
**Status:** Adopted. Reflected in `projects/openclaw/app/openclaw.json` subagent allowlists and orchestrator's `AGENTS.md`.

## What we picked

**Option B from the architecture options sketched on 2026-04-30:** single OpenClaw gateway, with a *multi-orchestrator* pattern. Each domain has one user-facing lead; specialists sit below the lead and only delegate to the lead's permitted set. Personal-life domains (email, backpacking) stay single-agent + skills — no specialists.

| Lead (user-facing) | Vertical | Specialists | Notes |
|---|---|---|---|
| `orchestrator` 🎯 | Software development | `devops` 🛠, `worker` ⚙️, `tester` 🧪 | The four-agent stack already shipped; this decision retroactively names orchestrator as the *development* lead, not a universal one. |
| `email` 📬 | Inbox triage | (none) | Single-agent + skills (`triage_inbox`, `extract_action_items`, `draft_reply`). |
| `backpacking` 🎒 | Trip prep | (none) | Single-agent + skills (route summary, gear lookup, pack-list diff). |
| `dnd` 🐉 *(planned)* | D&D 5e play | `dnd-dm` 🎲, `dnd-chargen` 🧙 *(planned)* | When built — see `ideas/dnd-5e-agents.md` for the phased plan. |

## Two architectures we did not pick (and why)

**Flat list, no hierarchy (Option A from the conversation).** Every agent in `agents.list[]` with a global subagent allowlist covering all of them. This is what we had before this decision. Worked at four agents; would have degraded as the agent count grew because:
- The WebUI selector becomes a wall once you cross ~10 agents and there's no visual separation between "the lead you should talk to" and "the specialist that's only meaningful in delegation."
- A global allowlist puts no gates on who-can-spawn-whom. With personal-life agents in the mix, that's an actual privacy/blast-radius concern: nothing structural would have stopped `worker` from accidentally spawning `email` if a model hallucinated the right `agentId`.

**Multiple OpenClaw gateways, one per domain (Option C from the conversation).** Total isolation, separate ports/auth/compose projects. Right answer when isolation is load-bearing — but it triples the management surface (three deploys, three sets of env vars, three Honcho stacks unless you wire shared backing) and makes cross-domain coordination painful for no current gain. Reserved for a specific future trigger: if the D&D voice/at-the-table prototype pulls in real-time room audio and we want a hard guarantee that audio-derived data never co-resides with development-agent memory, fork *just D&D* into its own gateway. Don't fork anything preemptively.

## Why multi-orchestrator (Option B)

1. **It matches the user's mental model.** Each "vertical" of work (dev, email, backpacking, D&D, …) has a natural lead the user talks to. Worker/tester/devops were already supposed to be talked-to-via-orchestrator; this decision makes that explicit at the config level, not just by social convention.
2. **OpenClaw supports the load-bearing piece natively.** Per-agent `subagents.allowAgents` lets us express "orchestrator → {devops, worker, tester}; worker → {tester}; everyone else → {}." The defaults are locked down (`allowAgents: []`, `requireAgentId: true`), so misconfigured spawns fail closed.
3. **Single gateway keeps cross-cutting concerns easy.** One Honcho instance, one set of QMD paths, one auth pairing flow. Cross-domain coordination (rare, but useful when needed — e.g. orchestrator quoting from an email decision) doesn't require federation.
4. **MCP scoping is per-agent in OpenClaw.** Email's Gmail MCP only attaches to `email`; D&D Beyond MCP only to `dnd-*`. So "single gateway" doesn't mean "every agent can reach every tool" — that worry doesn't apply.

## Concrete config shape

Defaults in `agents.defaults.subagents`:
- `allowAgents: []` — deny by default. An agent that doesn't explicitly opt into a target set can spawn nothing.
- `requireAgentId: true` — every `sessions_spawn` call must name its target. No ambient default-agent spawns.
- Other limits (`maxSpawnDepth`, `maxConcurrent`, `runTimeoutSeconds`) are kept as before.

Per-agent overrides in `agents.list[].subagents.allowAgents`:

```
orchestrator → ["devops", "worker", "tester"]
worker       → ["tester"]
devops       → []
tester       → []
email        → []
backpacking  → []
```

When `dnd` lands, expected shape:

```
dnd          → ["dnd-dm", "dnd-chargen"]
dnd-dm       → []
dnd-chargen  → []
```

## What this doesn't fix (yet)

- **WebUI selector clutter.** OpenClaw's chat selector lists every agent in `agents.list[]`. Specialists like worker/tester/devops appear there even though convention is "talk to the lead." Until OpenClaw adds a hide-from-selector flag (or agent groups in the UI), the fix is social: name agents and write SOUL/AGENTS docs that make the right behavior obvious. At ~10 agents this stops being acceptable; at that point either bug OpenClaw upstream for the flag, or pre-empt by going to Option C.
- **Cross-domain memory containment.** Honcho's per-workspace isolation is good but not airtight — the deriver runs against a shared corpus by default. If a domain accumulates genuinely-sensitive cross-session memory (the D&D campaign book, email triage history with personal mentions) that you don't want bleeding into other domains' retrieval, a per-domain Honcho workspace is the right next step. Today only the `openclaw` workspace exists; this is a config change, not a redesign.

## Cross-references when adding a new domain

When building a new vertical (the next one being D&D), the steps are:

1. Decide: is this a multi-agent vertical or single-agent + skills? **Threshold:** different *persona* (different SOUL voice, different boundaries, different memory scope) → multi-agent. Different *capability* on the same persona → single-agent with more skills. Backpacking and email failed the persona test (one voice each). D&D's player vs DM passes (qualitatively different roles).
2. Create the lead's workspace files (SOUL/AGENTS/IDENTITY) following the existing pattern at `projects/openclaw/app/workspaces/<lead>/`.
3. Create each specialist's workspace files at `projects/openclaw/app/workspaces/<specialist>/`.
4. Register all of them in `agents.list[]` in `openclaw.json`. Lead gets `subagents.allowAgents: ["<specialist-1>", "<specialist-2>", ...]`. Specialists get `subagents.allowAgents: []`.
5. Update the entrypoint's persona-seeding loop to include the new agent ids (`projects/openclaw/dockerfiles/entrypoint.sh`).
6. Update the agent table in `projects/openclaw/.docs/overview.md`.
7. If new MCP servers are needed, scope them to the lead and/or specialists via `agents.list[].mcp` rather than gateway-globally.

## References

- `projects/openclaw/app/openclaw.json` — current per-agent `subagents.allowAgents` shape
- `projects/openclaw/.docs/overview.md` § Delegation graph
- `projects/openclaw/app/workspaces/orchestrator/AGENTS.md` — the development-lead clarification
- `ideas/dnd-5e-agents.md` — projected D&D vertical (lead + DM + chargen)
- OpenClaw multi-agent reference: `/concepts/multi-agent` in the OpenClaw docs (also in `.claude/skills/openclaw/reference/llms-full.txt`)
