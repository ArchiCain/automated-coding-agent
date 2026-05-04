# OpenClaw workspaces pattern

This is the canonical layout for OpenClaw agents in this repo. Follow it when adding a new vertical or a new agent inside an existing vertical. The goals are: a flat list never grows past comprehension, IDs follow a predictable convention, and the system fails loudly when something is misconfigured rather than silently degrading.

## Source-tree layout

Every agent lives at `projects/openclaw/app/workspaces/<vertical>/<agent-id>/`:

```
projects/openclaw/app/workspaces/
├── development/
│   ├── dev-main/         # vertical lead
│   ├── devops/
│   ├── worker/
│   └── tester/
├── dnd/
│   ├── dnd-main/         # vertical lead
│   ├── dnd-dm/
│   └── dnd-chargen/
├── email/
│   └── email-main/       # single-agent vertical, lead by default
└── backpacking/
    └── backpacking-main/ # single-agent vertical, lead by default
```

Rules:

- **One vertical = one top-level dir.** A vertical is a domain — software development, D&D, email, etc.
- **One agent = one leaf dir.** The leaf dir name MUST match the agent's `id` in `openclaw.json`. The entrypoint reconciles these and hard-fails on mismatch.
- **Lead agents are named `<vertical>-main`.** Specialists keep flat names (`devops`, `dnd-dm`, etc.). Single-agent verticals are still leads — name them `<vertical>-main` so the convention stays uniform.
- **Friendly Names are independent of IDs.** `IDENTITY.md`'s `Name:` field is what users see in chat (e.g. `Name: Orchestrator` for the `dev-main` agent). Change the ID without touching the Name unless you actually want the chat experience to change.
- **Each agent dir contains** `SOUL.md` (voice), `AGENTS.md` (rules + tools), `IDENTITY.md` (display metadata). Optional: `USER.md`, `TOOLS.md`, `HEARTBEAT.md`, `BOOT.md` per the OpenClaw spec.

## Runtime layout (don't confuse with source)

The container's runtime structure stays **flat** — only the source tree is verticalized:

```
/workspace/.openclaw/workspaces/<id>/   ← seeded persona files (one dir per agent, flat)
/workspace/.openclaw/agents/<id>/       ← per-agent state including auth-profiles.json
```

This is set per-agent in `openclaw.json` via the `workspace` and `agentDir` fields. The vertical grouping is purely for human readability of the source tree.

## How discovery works

`projects/openclaw/dockerfiles/entrypoint.sh` walks the workspaces tree on every gateway boot:

1. `find $PERSONA_SOURCE_DIR -name SOUL.md` — every match is one agent.
2. The leaf dir name is taken as the agent ID.
3. Reads `agents.list[].id` from `openclaw.json` (via `jq`).
4. Reconciles:
   - **Hard-fail (exit 1)** if any expected ID has no SOUL.md. The error names the missing IDs and tells you to add the dir or remove the agent from config.
   - **Warn** if a SOUL.md was found for an unknown ID. The persona seeds anyway but won't be loaded by OpenClaw.
5. Seeds persona files (`SOUL.md`, `AGENTS.md`, `IDENTITY.md`, etc.) from the source dir to `/workspace/.openclaw/workspaces/<id>/`. Memory dirs and other runtime state are left alone.

You'll see this in the gateway boot log:

```
Persona source: image baseline (/app/workspaces)
  dev-main:    persona seeded → /workspace/.openclaw/workspaces/dev-main (from development/dev-main)
  devops:      persona seeded → /workspace/.openclaw/workspaces/devops (from development/devops)
  ...
```

## Adding a new vertical

End-to-end. Replace `<vertical>` with the new domain name, e.g. `finance`.

1. **Create the vertical dir + lead agent dir:**

   ```bash
   mkdir -p projects/openclaw/app/workspaces/<vertical>/<vertical>-main
   ```

2. **Write the lead's persona files** — at minimum `SOUL.md`, `AGENTS.md`, `IDENTITY.md`. Use any existing agent (e.g. `email-main`) as a starting template. Pick an emoji for `IDENTITY.md`.

3. **Add the agent to `openclaw.json`** under `agents.list[]`:

   ```json
   {
     "id": "<vertical>-main",
     "model": {
       "primary": "openai-codex/gpt-5.5",
       "fallbacks": ["ollama/qwen-coder-next-256k"]
     },
     "workspace": "/workspace/.openclaw/workspaces/<vertical>-main",
     "agentDir": "/workspace/.openclaw/agents/<vertical>-main/agent",
     "skills": [],
     "subagents": { "allowAgents": [] },
     "identity": { "emoji": "🪵" }
   }
   ```

4. **Add the agent ID to the auth script's destination list:** `scripts/openclaw-auth-codex.sh`, the `AGENTS=(...)` array.

5. **Recreate the gateway and propagate auth:**

   ```bash
   task openclaw:down:local
   task openclaw:up:local
   task openclaw:auth:propagate:local
   ```

6. **Verify in the boot log** that the new agent shows up under its vertical. If you typo'd the ID or directory name, the entrypoint exits with a clear error naming the mismatched ID.

7. **(Optional) Set up a Telegram bot for the new lead** — see "Telegram bot per main agent" below.

## Adding a specialist to an existing vertical

Same as above, but:

- Drop the dir under the vertical's existing folder (e.g. `dnd/dnd-tactician/`).
- Use a flat name (no `-main` suffix) — specialists are not leads.
- In `openclaw.json`, also add the new specialist's ID to the lead's `subagents.allowAgents` array so the lead can delegate to it.

The runtime workspace path stays flat (`/workspace/.openclaw/workspaces/dnd-tactician`), regardless of where the source dir lives.

## Telegram bot per main agent

Each main agent gets its own Telegram bot. Multiple bots run under one OpenClaw gateway via `channels.telegram.accounts.<accountId>`. Inbound messages route to the correct agent through `bindings[]`.

### Step 1 — create the bot in BotFather

1. DM **@BotFather** on Telegram (verify the handle exactly).
2. `/newbot` → follow prompts → copy the token (looks like `123456:abc...`).
3. Optional but recommended: `/setprivacy` → **Disable** so the bot can read all group messages (otherwise it only sees messages that mention it). `/setjoingroups` → **Enable** if you want to add it to groups.
4. Repeat for each main agent. With 4 verticals: 4 bots.

### Step 2 — store tokens in `.env`

```bash
TELEGRAM_BOT_TOKEN_DEV_MAIN=123456:abc...
TELEGRAM_BOT_TOKEN_DND_MAIN=234567:def...
TELEGRAM_BOT_TOKEN_EMAIL_MAIN=345678:ghi...
TELEGRAM_BOT_TOKEN_BACKPACKING_MAIN=456789:jkl...
```

The variable names are placeholders in `.env.template`. Tokens never go in `openclaw.json` — `openclaw.json` references them via secret-ref so the committed file stays clean.

### Step 3 — add `channels.telegram` and `bindings[]` to `openclaw.json`

Below `agents.list[]`, add (or extend) these top-level blocks:

```json
"channels": {
  "telegram": {
    "enabled": true,
    "defaultAccount": "dev-main-bot",
    "dmPolicy": "allowlist",
    "groupPolicy": "allowlist",
    "allowFrom": ["<your-numeric-telegram-id>"],
    "accounts": {
      "dev-main-bot": {
        "botToken": { "source": "env", "provider": "default", "id": "TELEGRAM_BOT_TOKEN_DEV_MAIN" }
      },
      "dnd-main-bot": {
        "botToken": { "source": "env", "provider": "default", "id": "TELEGRAM_BOT_TOKEN_DND_MAIN" }
      },
      "email-main-bot": {
        "botToken": { "source": "env", "provider": "default", "id": "TELEGRAM_BOT_TOKEN_EMAIL_MAIN" }
      },
      "backpacking-main-bot": {
        "botToken": { "source": "env", "provider": "default", "id": "TELEGRAM_BOT_TOKEN_BACKPACKING_MAIN" }
      }
    }
  }
},
"bindings": [
  { "match": { "channel": "telegram", "accountId": "dev-main-bot" },         "agentId": "dev-main" },
  { "match": { "channel": "telegram", "accountId": "dnd-main-bot" },         "agentId": "dnd-main" },
  { "match": { "channel": "telegram", "accountId": "email-main-bot" },       "agentId": "email-main" },
  { "match": { "channel": "telegram", "accountId": "backpacking-main-bot" }, "agentId": "backpacking-main" }
]
```

You also need to expose the `TELEGRAM_BOT_TOKEN_*` env vars to the gateway container. They go in `infrastructure/compose/openclaw/compose.yml` under the gateway service's `environment:` block — `--env-file .env` provides compose-level substitution but doesn't auto-pass into containers. The base compose already has these four for the current set of main agents; if you add a new vertical with its own bot, add a matching env passthrough line.

`allowFrom` lives at the **top level of `channels.telegram`**, not inside individual accounts. The validator rejects `dmPolicy: "allowlist"` with no top-level `allowFrom`. Named accounts inherit the top-level `allowFrom`, so a single entry covers all four bots when you're the sole owner. Find your numeric Telegram user ID by DMing any one bot once and grepping `task openclaw:logs:local` for `from.id`, or via `curl https://api.telegram.org/bot<token>/getUpdates`.

`botToken` uses OpenClaw's SecretRef shape: `{ "source": "env", "provider": "default", "id": "<ENV_VAR_NAME>" }`. The `provider: "default"` field is required — the schema rejects `{ source, id }` alone. Same shape applies to other secret-supporting fields (Slack tokens, Discord tokens, etc. — full list at `docs.openclaw.ai/reference/secretref-credential-surface`).

### Step 4 — restart the gateway

```bash
task openclaw:restart:local
```

Then DM each bot to verify it routes to the right agent. Each bot's chat should be answered by the agent whose `id` matches the binding.

### Things that catch people

- **`dnd-main-bot` ≠ `dnd-main`.** The `accountId` (Telegram-side identifier) is distinct from the `agentId` (OpenClaw-side identifier). I use the `-bot` suffix on accountIds for clarity but it's not required.
- **`allowFrom` lives at the top level of `channels.telegram`**, NOT inside individual `accounts.<id>` blocks. Validator rejects nested-only configs with `dmPolicy="allowlist" requires channels.telegram.allowFrom to contain at least one sender ID`. Named accounts inherit the top-level value.
- **`botToken` requires `provider: "default"` in the SecretRef.** Shape: `{ "source": "env", "provider": "default", "id": "ENV_VAR" }`. Without `provider`, validation rejects with `botToken: Invalid input` even though the env var is set.
- **Env vars need a passthrough line in `compose.yml`.** Compose's `--env-file .env` populates substitution but doesn't auto-export to the container. Each `TELEGRAM_BOT_TOKEN_*` needs a matching line in the gateway service's `environment:` block, otherwise the gateway boots with empty tokens and SecretRef resolution fails.
- **`dmPolicy: "allowlist"` with empty `allowFrom`** is rejected by config validation. Either add an ID or drop to `dmPolicy: "pairing"` to use OpenClaw's interactive pairing flow.
- **Multiple accounts must declare a `defaultAccount`** explicitly, or `openclaw doctor` warns and routing falls back to the first normalized account ID.
- **First message can take 30+ seconds.** Cold-start agent runs include workspace-sandbox init, system prompt build, Honcho context fetch, and stream-setup — easily 10-20s of prep before the model is even called. If a Telegram message looks unanswered for a while, it's probably still running. Check `task openclaw:logs:local | grep agent/embedded` to confirm the agent is doing work, not stuck.
- **Privacy mode caveat in groups:** if `/setprivacy` is enabled (Telegram default), the bot only sees mentions in groups. Disable via BotFather, then **remove + re-add** the bot to each existing group so Telegram applies the change.
- **Group access is separate from DM access.** `allowFrom` controls DMs. For groups, set `channels.telegram.groups` (allowed group IDs) and optionally `groupAllowFrom` (allowed senders within those groups).

## When agent IDs change

If you rename an agent (e.g. `orchestrator` → `dev-main`):

1. Move the source dir.
2. Update `id`, `workspace`, and `agentDir` in `openclaw.json`'s `agents.list[]` entry.
3. Update any `subagents.allowAgents` references that named the old ID (in our case orchestrator was a top-level lead so no allowlist references it as a target — verify for your case).
4. Update any `bindings[]` entries that named the old ID (e.g. Telegram bindings).
5. Update `scripts/openclaw-auth-codex.sh`'s `AGENTS=(...)` array so auth propagates to the new ID.
6. Recreate the gateway and re-propagate auth.

The old per-agent dirs in the workspace volume become orphans. Harmless but `task openclaw:down:local:clean` is the only way to clean them without manual `docker exec rm -rf`. The orphans don't affect routing because they're not in `agents.list[]` anymore.

## Decision history

- **Verticalized source layout (May 2026):** introduced after the agent count grew past 4. Without grouping, the flat list got hard to scan. Runtime layout stayed flat for compatibility.
- **`<vertical>-main` lead naming (May 2026):** previously the lead borrowed the vertical's name (`dnd` for the D&D lead), creating awkward `dnd/dnd/` paths and ambiguous chat references. The `-main` suffix makes "this is the lead" structural rather than positional.
- **Reconciliation hard-fail (May 2026):** the entrypoint used to silently skip missing source dirs (logged a warning). After several typo-then-debug cycles where an agent was declared in config but never seeded, we changed it to exit non-zero on missing IDs.
