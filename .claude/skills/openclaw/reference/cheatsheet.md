# OpenClaw Cheatsheet

Distilled quick-reference for the most common OpenClaw work. For any claim that needs to be authoritative, verify against `llms-full.txt` (search by topic).

## Mental model

- **Gateway** — the OpenClaw process that bridges channels to agents. Started via `openclaw daemon` or run as a service.
- **Workspace** — an isolated directory per agent at `~/.openclaw/workspaces/<agent-name>/` containing `SOUL.md`, memory, channel bindings, skill configs.
- **SOUL.md** — plain markdown defining the agent's identity, behaviors, rules, tone. Loaded as the system-level prompt for every interaction.
- **Channel** — a messaging surface (Slack, Telegram, Discord, etc.). Configured under `channels.<name>.*` in the workspace config.
- **Skill** — a capability binding (e.g. web search, file ops, calendar). Configured per agent.
- **MCP server** — external tool server exposed to the agent (outbound) or OpenClaw's own conversations exposed to MCP clients like Claude Code (inbound, via `openclaw mcp serve`).

## Onboard a new agent (the happy path)

```bash
openclaw onboard
```

Walks through gateway, workspace, channels, skills setup. Default for new agents.

## Key file paths

| Path | What |
|---|---|
| `~/.openclaw/workspaces/<agent>/SOUL.md` | Agent personality / system prompt |
| `~/.openclaw/workspaces/<agent>/` | Per-agent workspace (memory, configs) |
| Workspace config | Defines channels, skills, model, MCP servers |

## SOUL.md structure (canonical sections)

```markdown
# Agent: <Name>

## Identity
You are <name>, a <role>. You <one-line purpose>.

## Responsibilities
- ...

## Skills
- ...

## Rules
- Always / Never ...

## Boundaries
- Private things stay private.
- Ask before acting externally.

## Tone
<Voice description.>

## Greeting
> <First-message line.>

## Example Interactions
**User:** ...
**Agent:** ...
```

Not every section is required. The template at `official-SOUL-template.md` is the reference.

## Channels (config shape)

Channels are configured under `channels.<channel-name>` in the workspace config. Example for BlueBubbles (iMessage):

```json5
{
  channels: {
    bluebubbles: {
      enabled: true,
      serverUrl: "http://192.168.1.100:1234",
      password: "example-password",
      webhookPath: "/bluebubbles-webhook",
    },
  },
}
```

Each channel has its own keys — grep `llms-full.txt` for the channel name (e.g. `# Slack`, `# Telegram`, `# Discord`) to find its exact config schema.

Supported channels include: BlueBubbles (iMessage), Discord, Feishu/Lark, Google Chat, IRC, LINE, Matrix, Mattermost, Microsoft Teams, Nextcloud Talk, Nostr, QQ bot, Signal, Slack, Synology Chat, Telegram, Tlon, Twitch, WeChat, WhatsApp, Zalo.

## MCP — two distinct features

1. **OpenClaw as MCP server** (`openclaw mcp serve`)
   Exposes OpenClaw's channel-backed conversations to MCP clients (Claude Code, Claude Desktop). Add to Claude Code's MCP config:

   ```json
   {
     "mcpServers": {
       "openclaw": {
         "command": "openclaw",
         "args": ["mcp", "serve", "--url", "wss://gateway-host:18789",
                  "--token-file", "/path/to/gateway.token"]
       }
     }
   }
   ```

2. **OpenClaw managing outbound MCP servers** (registry)
   `openclaw mcp list / show / set / unset` — saves MCP server definitions for runtimes that OpenClaw launches.

## CLI reference (most-used commands)

Verify exact flags via `openclaw <cmd> --help` or `llms-full.txt`. Commands seen in the docs:

```
openclaw onboard           # Guided setup
openclaw daemon            # Run the gateway
openclaw doctor            # Health check / diagnostics
openclaw agents            # List, add, manage isolated agents
openclaw agent <name> ...  # Single-agent ops
openclaw channels ...      # Channel management
openclaw skills ...        # Skills management
openclaw mcp serve         # Run as MCP server
openclaw mcp set/unset     # Manage outbound MCP servers
openclaw cron ...          # Scheduled tasks
openclaw hooks ...         # Lifecycle hooks
openclaw memory ...        # Memory engine ops
openclaw configure         # Edit workspace config
openclaw config            # Show config
openclaw logs              # View gateway logs
openclaw health            # Service health
openclaw backup            # Workspace backup
openclaw browser           # Browser-based control surface
openclaw dashboard         # Dashboard UI
openclaw devices           # Manage paired devices
openclaw directory         # Workspace/agent directory
openclaw dns               # DNS / domain configuration
openclaw docs              # Local docs
openclaw infer             # Inference CLI
openclaw nodes / node      # Multi-node ops
openclaw message           # Send a message via gateway
openclaw approvals         # Manage approval requests
openclaw clawbot           # Bot orchestration
```

## Memory engines

- **builtin** — default engine
- **Honcho** — third-party memory engine
- **QMD** — alternate engine
- **Active memory / dreaming** — context engineering features for long-running agents

Configure under the memory section of the workspace config. See sections starting at line ~12069 in `llms-full.txt` (`# Active memory`, `# Memory overview`, `# Builtin memory engine`, `# Honcho memory`, `# QMD memory engine`, `# Memory search`).

## Hooks, cron, taskflows, standing orders

- **Hooks** — fire on lifecycle events (`openclaw hooks ...`).
- **Cron jobs** — scheduled tasks (`openclaw cron ...`).
- **Standing orders** — recurring agent directives.
- **Taskflows** — multi-step task automation.

See `# Automation & tasks`, `# Hooks`, `# Scheduled tasks`, `# Standing orders`, `# Task flow`, `# Background tasks` in `llms-full.txt`.

## Multi-agent

- **Multi-agent routing** — routes messages between agents (`# Multi-agent routing` ~line 15260).
- **Broadcast groups** — fan-out messages to multiple channels (`# Broadcast groups` ~line 589).
- **Group messages / Groups** — group-chat handling.

## Pairing & auth

- Channels use **pairing codes** to authenticate users. See `# Pairing` (~line 7326) and `# Auth credential semantics`.
- Allowlists configured per-channel via `channels.<name>.allowFrom`.

## Common patterns

### "Make an agent that triages bugs from Slack into Linear"
1. Author SOUL.md (use `templates/customer-support.md` or `templates/project-manager.md` as base).
2. Configure Slack channel — see `# Slack` in `llms-full.txt`.
3. Add a Linear MCP server or skill for ticket creation. Manage via `openclaw mcp set` or skill config.
4. Wire allowlists / pairing.
5. Run `openclaw onboard` (new agent) or restart the gateway.

### "Add a tool to my existing agent"
1. Decide: skill, outbound MCP server, or in-agent capability?
2. Edit the workspace config to bind the skill / register the MCP server.
3. Update SOUL.md to mention the new capability under `## Skills`.
4. Reload the agent (verify exact command in docs).

## When in doubt

- `grep -n "^# " reference/llms-full.txt` — map all sections.
- `grep -n -B 1 -A 30 "<topic>" reference/llms-full.txt` — pull a specific area.
- Or read the live docs at https://docs.openclaw.ai/ — index is at `https://docs.openclaw.ai/llms.txt`.
