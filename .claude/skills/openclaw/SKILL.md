---
name: openclaw
description: Use when building, configuring, debugging, or reasoning about OpenClaw agents — including SOUL.md authoring, channel setup (Slack/Telegram/Discord/WhatsApp/iMessage/etc.), skills, MCP server config, multi-agent routing, hooks, scheduled tasks, gateway/workspace setup, and the `openclaw` CLI. Trigger on phrases like "create an OpenClaw agent", "OpenClaw skill", "SOUL.md", "openclaw onboard", "openclaw mcp", or any reference to the OpenClaw framework / Verus Auctor.
---

# OpenClaw Skill

This skill teaches Claude Code how OpenClaw works so you can author OpenClaw agents from natural-language requests.

## What OpenClaw is (one paragraph)

OpenClaw is a **config-first, self-hosted gateway** that connects messaging channels (Slack, Telegram, Discord, WhatsApp, iMessage via BlueBubbles, Matrix, Signal, Teams, Google Chat, IRC, Twitch, WeChat, Zalo, etc.) to AI coding agents. You write a `SOUL.md` file describing the agent, configure channels and skills, and run `openclaw onboard` (or `openclaw daemon`). No Python, no chains, no graphs. Each agent has an isolated **workspace** at `~/.openclaw/workspaces/<agent-name>/` containing its `SOUL.md`, memory, channels, and skill bindings.

## When this skill is relevant

- "Create an OpenClaw agent that does X with tools Y and Z"
- Editing or generating a `SOUL.md` file
- Configuring channels (e.g. wiring up Slack or Telegram)
- Adding skills or MCP servers to an agent
- Multi-agent routing, broadcast groups, or group chats
- Using the `openclaw` CLI (`onboard`, `agent`, `agents`, `gateway`, `mcp`, `skills`, `channels`, `cron`, etc.)
- Hooks, scheduled tasks, standing orders, taskflows
- Gateway / workspace / daemon setup
- Memory engines (builtin, Honcho, QMD), context engineering, compaction
- Migrating agents between models (Claude, GPT-5.4, Grok 4, Gemini, MiniMax, GLM, local Ollama)
- Anything mentioning Verus Auctor (the agent built on OpenClaw in this workspace)

## How to use this skill

When triggered, follow this loop:

1. **Identify what the user actually needs.** OpenClaw work usually falls into one of these buckets:
   - Authoring/editing a `SOUL.md`
   - Configuring channels (`channels.<name>.*` keys in the workspace config)
   - Adding skills (built-in or custom) to an agent
   - Wiring an MCP server (`openclaw mcp ...` or `openclaw mcp serve`)
   - Onboarding a new agent (`openclaw onboard`)
   - Scheduling work (cron jobs, hooks, standing orders, taskflows)
   - Multi-agent setup (routing, sub-agents, broadcast groups)
   - Debugging (`openclaw doctor`, logs, health, channels troubleshooting)

2. **Consult the bundled docs before answering.** This skill ships the full OpenClaw documentation. The user expects answers grounded in those docs, not guesses.

   - **`reference/cheatsheet.md`** — start here. Distilled essentials: SOUL.md anatomy, key CLI commands, channel config shape, skills config, MCP config, common file paths.
   - **`reference/llms.txt`** — a flat index of every doc page with URLs. Use this to find which page covers a topic.
   - **`reference/llms-full.txt`** — the complete OpenClaw documentation (~100K lines) as a single file. Each page is delimited by a `# <Page Title>` heading and a `Source: <url>` line. Use `grep -n "^# " reference/llms-full.txt` to map sections, then `grep -n -A N "<topic>" reference/llms-full.txt` or `Read` with offset/limit to pull the relevant page.
   - **`reference/official-SOUL-template.md`** — the official SOUL.md template from docs.openclaw.ai.
   - **`reference/templates/`** — six production SOUL.md examples (quickstart, coding-assistant, customer-support, research-analyst, project-manager, threat-monitor). Use these as starting points or style references.

3. **Author the artifact.** When generating a SOUL.md or workspace config, prefer the structure used by `reference/official-SOUL-template.md` and the templates in `reference/templates/`. Standard SOUL.md sections: `Identity`, `Responsibilities` (or `Skills`), `Rules`, `Tone`, optional `Greeting`, `Boundaries`, `Example Interactions`.

4. **Cite sources when it matters.** When you give a concrete claim about behavior (e.g. "OpenClaw stores workspaces under `~/.openclaw/workspaces/`"), point to the file in `reference/llms-full.txt` so the user can verify. Don't fabricate CLI flags or config keys — grep first.

5. **Stay in the OpenClaw idiom.** OpenClaw is config-first. Default to a SOUL.md + workspace config rather than writing custom code. Only suggest plugin/skill code when the docs say a built-in path doesn't cover the requirement.

## Authoring a SOUL.md — quick recipe

When the user says "create an OpenClaw agent that does X":

1. Pick the closest template in `reference/templates/` and use it as a skeleton.
2. Fill out **Identity** (role + tone), **Responsibilities/Skills** (what it does), **Rules** (guardrails), **Tone** (voice), and optionally **Greeting** and **Example Interactions**.
3. If the agent needs specific tools or skills, list them under a `## Skills` or `## Tools` section, and follow up with the channel/skill config (separate file — *not* SOUL.md) the user will need to add to their workspace.
4. Mention the file path the SOUL.md should live at: `~/.openclaw/workspaces/<agent-name>/SOUL.md`.
5. Tell the user the next CLI step (typically `openclaw onboard` for new agents, or `openclaw agent reload <name>` to pick up SOUL.md changes — verify exact command in the docs before stating).

## Adding tools/skills/MCP servers

OpenClaw exposes external capability through three mechanisms — pick the right one:

- **Skills** — first-class OpenClaw capability bindings, configured per agent. See `reference/llms-full.txt` for skill setup pages.
- **MCP servers (outbound)** — OpenClaw can launch agents that consume MCP servers. Manage via `openclaw mcp list/show/set/unset`.
- **MCP server (inbound)** — `openclaw mcp serve` exposes OpenClaw's own conversations to MCP clients (e.g. Claude Code, Claude Desktop).

When uncertain which to use, grep `reference/llms-full.txt` for the user's specific tool name or use case.

## Don't

- Don't invent CLI flags or config keys. Always grep `reference/llms-full.txt` first.
- Don't suggest writing a custom Python/Node agent loop — OpenClaw is config-first; the SOUL.md + workspace config is the agent.
- Don't conflate the **`openclaw mcp serve`** bridge (OpenClaw → MCP clients) with the **MCP server registry** (`openclaw mcp set/unset` for outbound servers). They are different features.
- Don't claim a feature exists if you can't find it in the bundled docs. Say so and offer to check the live docs at https://docs.openclaw.ai/.

## File index

| File | Purpose |
|---|---|
| `reference/cheatsheet.md` | Distilled essentials — read first |
| `reference/llms.txt` | Flat index of all doc pages with URLs |
| `reference/llms-full.txt` | Full OpenClaw docs (~100K lines) — grep this |
| `reference/official-SOUL-template.md` | Official SOUL.md template |
| `reference/templates/quickstart.md` | Minimal helpful-assistant SOUL.md |
| `reference/templates/coding-assistant.md` | Coding-focused SOUL.md |
| `reference/templates/customer-support.md` | Support-agent SOUL.md |
| `reference/templates/research-analyst.md` | Research/analysis SOUL.md |
| `reference/templates/project-manager.md` | PM-style SOUL.md |
| `reference/templates/threat-monitor.md` | Security analyst SOUL.md (longest, shows Example Interactions) |
