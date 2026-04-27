# Migration plan — polished OpenClaw → this repo

Author note for the operator + reference doc for any Claude session
that picks this up. Captures the intent, what survives, what changes,
and the open questions to discuss before doing the import.

## Intent

The operator has a polished OpenClaw implementation in a separate repo.
That repo's contents replace the current `projects/openclaw/` here.
After the import, the polished OpenClaw is adapted to call the local
two-machine LLM stack (graphics-machine for generation, host-machine
for embeddings) instead of Anthropic + OpenAI cloud APIs.

The current `projects/openclaw/` is **scaffolding** — it has a working
gateway image, git-sync sidecar, and skill files, but it's been
designed around cloud APIs and is not the version the operator wants
running long-term.

## What survives unchanged

These pieces of the surrounding infrastructure are right and don't
need to change as part of this migration:

| Surviving piece | Why it survives |
|---|---|
| `infrastructure/compose/dev/` | Application stack (frontend + backend + keycloak + postgres) is independent of which orchestrator runs it. |
| `infrastructure/compose/sandbox/` | Sandbox template is orchestrator-agnostic — devops agent calls `task env:*`. |
| `infrastructure/compose/openclaw/` | Two-service compose project (gateway + git-sync) shape will likely fit the polished version too. May need env-var tweaks. |
| `.github/workflows/deploy-dev.yml` | Deploy pipeline is orchestrator-agnostic. Build matrix may need to change if the polished OpenClaw has different dockerfiles. |
| `scripts/{deploy,env-check,gh-setup}.sh` | Deploy + bootstrap tooling is orchestrator-agnostic. |
| `.env` flow + GH secrets/vars | Pattern survives. New OpenClaw secrets get added to `.env.template` + `env-check.sh` + `gh-setup.sh`. |
| Host-role naming (`host-machine`, `graphics-machine`) | Convention is stable across the migration. |

The polished OpenClaw needs to fit into this infrastructure shape, not
the other way around. If it can't, that's a discussion point.

## What gets replaced

`projects/openclaw/` — wholesale replacement with the contents of the
operator's other repo. Specifically the things that currently live
there and will be overwritten:

- `projects/openclaw/app/openclaw.json` — gateway config (agents,
  plugins, memory backend)
- `projects/openclaw/app/skills/` — agent persona prompts
- `projects/openclaw/app/SOUL.md`, `HEARTBEAT.md` — agent identity /
  monitor files
- `projects/openclaw/dockerfiles/` — gateway + git-sync Dockerfiles
- `projects/openclaw/Taskfile.yml` — task wiring for openclaw lifecycle
- `projects/openclaw/.docs/` — current overview + any feature docs
- `projects/openclaw/README.md`

After replacement, `projects/openclaw/.docs/overview.md` should be
rewritten to reflect the polished version's actual topology.

## What needs adaptation after the import

The polished OpenClaw is presumed to point at `https://api.anthropic.com`
(or similar) for reasoning and OpenAI for embeddings. Three changes
will be needed:

1. **LLM provider config (in whatever the polished version's equivalent
   of `openclaw.json` is)** — point reasoning at
   `http://graphics-machine:11434` with model `qwen-coder-next-256k`
   (derivative of `frob/qwen3-coder-next:80b-a3b-q4_K_M`, Qwen3-Next
   80B MoE / 3B active), point embeddings at
   `http://host-machine:11434` with model `bge-m3-8k`. The exact JSON
   shape depends on the polished version.

2. **Optional: failover provider** — if the polished OpenClaw supports
   multi-provider failover (the docs in `ideas/openclaw-local-llm-hybrid.md`
   say it does), add `host-machine`'s `qwen-coder-32k` as the fallback
   for when graphics-machine is offline. This is optional — the operator
   can choose to hard-fail instead.

3. **Removed env vars** — `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`
   become unused. Remove from:
   - root `.env.template`
   - `scripts/env-check.sh`
   - `scripts/gh-setup.sh`
   - `infrastructure/compose/openclaw/.env.template`
   - `.github/workflows/deploy-dev.yml` rendered `openclaw.env`

   The GitHub App credentials, OPENCLAW_AUTH_TOKEN, and
   GITHUB_APP_PRIVATE_KEY all stay.

## Open questions to discuss with the operator

Before doing the import, work through these with them:

1. **Does the polished OpenClaw have its own Dockerfile + image
   pipeline?** If yes, does it match the `prod.Dockerfile` /
   `git-sync.Dockerfile` split we have? Or is it a single image? If
   different, the GH Actions build matrix in
   `.github/workflows/deploy-dev.yml` needs updating.

2. **Does it expect a workspace volume + git-sync sidecar pattern?**
   The current setup has a `workspace` named volume shared between
   gateway + sidecar, with the sidecar pulling the repo via a GitHub
   App. The polished version may or may not follow this. If different,
   `infrastructure/compose/openclaw/compose.yml` needs adapting.

3. **What's its config file format?** `openclaw.json`? YAML? A
   different name? Where does provider config live in it?

4. **Does it support multi-provider failover?** If yes, we wire the
   host-machine fallback. If no, decide whether to hard-fail or queue
   when graphics-machine is offline.

5. **Does it use OpenAI's embedding API shape, or does it call a
   generic embeddings endpoint?** Ollama exposes
   `/api/embeddings` — if the polished version expects an OpenAI-shape
   `/v1/embeddings`, we need a small shim or to use Ollama's OpenAI-
   compatibility endpoint at `/v1/embeddings`.

6. **Sandbox provisioning** — does the polished version's devops agent
   still call `task env:*` against the host docker socket? If yes, no
   change. If it does its own sandbox provisioning, we may be able to
   delete `scripts/sandbox-*.sh` or rewrite them.

7. **Does it have its own auth model?** Current scaffolding uses
   `OPENCLAW_AUTH_TOKEN` for browser pairing. Is that still the model?

## Suggested migration sequence

When the operator is ready (source repo populated, models confirmed
working on graphics-machine):

1. **Operator clones the polished OpenClaw repo** somewhere accessible
   from a Claude Code session running in this repo's worktree.
2. **Discussion turn**: walk through the open questions above with
   what's actually in the polished repo. Decide on shape changes.
3. **Branch off `dev`** for the migration (e.g. `migration/polished-openclaw`).
4. **rsync the polished repo's contents into `projects/openclaw/`**,
   carefully preserving anything in this repo's `projects/openclaw/`
   that should survive (probably nothing — it's a wholesale replacement).
5. **Adapt the surviving infrastructure** based on the discussion in
   step 2 (compose, build matrix, env vars, scripts).
6. **Local-LLM provider switch** — adapt the polished OpenClaw's
   provider config to call graphics-machine + host-machine instead of
   cloud APIs.
7. **`task setup:check && task gh:setup`** — re-push GH secrets/vars
   to drop the now-unused cloud API keys.
8. **Push to `migration/polished-openclaw`** branch first; verify
   workflow output and that images build cleanly. Iterate.
9. **Open PR → `dev`**. Merging triggers a real deploy to host-machine.
10. **Smoke-test on host-machine** that the gateway pairs, that the
    devops agent can spin up sandboxes, and that the worker can call
    graphics-machine for generation.

## Tail: stale memory + docs to refresh after migration

Once the migration lands, these pointers will be wrong and need a
sweep:

- `.docs/overview.md` — agent table at the bottom may not match the
  polished version's agent set
- `infrastructure/.docs/ecosystem.md` — runtime sequence diagram
  assumes the current four-agent set (orchestrator, devops, worker,
  tester). If the polished version differs, update
- Auto-memory (`/Users/scain/.claude/projects/.../memory/MEMORY.md`)
  has older entries about "Removing OpenClaw" that contradict the
  current direction — clean up
