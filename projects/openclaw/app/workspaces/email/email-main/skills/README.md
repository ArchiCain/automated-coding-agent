# Email skills (placeholder)

This directory will hold AgentSkill folders for the email agent. None are written yet — the user will iterate on these.

## Planned skills and their model routing

| Skill | Purpose | Model |
|---|---|---|
| `triage_inbox` | Fast classification of incoming threads (matter / soft-matter / noise) | `ollama-host/gemma4-e4b-128k` (Tier-2) |
| `extract_action_items` | Structured-JSON extraction of "what does this thread ask of me" | `ollama-host/gemma4-e4b-128k` (Tier-2) |
| `draft_reply` | Tone-aware reply drafting | `openai-codex/gpt-5.5` (brain) |

## Routing convention

- Cheap classification and JSON extraction → Tier-2 (Gemma 4 E4B on host-machine)
- Tone-sensitive synthesis → OpenAI Codex brain

Skills express this via the `model` field in their `SKILL.md`. Without an explicit override, skills inherit the agent's default — `openai-codex/gpt-5.5`. That's correct for `draft_reply` and wrong for the other two, so classification skills must include an explicit `model:` directive when written.

## Out of scope until the IMAP/Gmail MCP server is wired

These skills can't be useful without inbox access. The MCP server is a separate work item — see `AGENTS.md` and `CLAUDE.md` for current status.
