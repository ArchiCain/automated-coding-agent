# Backpacking skills (placeholder)

This directory will hold AgentSkill folders for the backpacking agent. None are written yet — the user will iterate on these.

## Routing convention

- Cheap classification and structured extraction → Tier-2 (`ollama-host/gemma4-e4b-128k` on host-machine)
- Multi-step synthesis (route plans, trip briefs, comparing options) → OpenAI Codex brain (`openai-codex/gpt-5.5`)

Skills express this via the `model` field in their `SKILL.md`. The agent default is the brain; classification-style skills must opt down to Tier-2 explicitly.

## Out of scope until upstream tools land

- Maps MCP server (Caltopo / Gaia / similar) — needed for any route / terrain skill
- Gear inventory store — needed for `gear_lookup` / `pack_list_diff`

Skills that depend on these can't be useful until the integrations exist. See `AGENTS.md` for current status.
