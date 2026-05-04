# Dungeon Master skills (placeholder)

This directory will hold AgentSkill folders for the DM specialist. None are written yet.

## Routing convention

- Generative work (`encounter_build`, `npc_generate`, `session_recap`) → OpenAI Codex brain (`openai-codex/gpt-5.5`)
- Structured retrieval (`monster_lookup`, `loot_roll`, `rules_lookup`) → Tier-2 (`ollama-host/gemma4-e4b-128k`)
- Pure code (`initiative_track`, `dice_roll`) → no model

Skills express this via `model:` in `SKILL.md`.

## Out of scope until upstream tools land

- 5e SRD vector index — shared with the D&D lead
- Encounter difficulty calculator (CR/XP math)
- Initiative tracker state store
- Campaign state store (Honcho-backed; format TBD)

See `ideas/dnd-5e-agents.md` § Phase 2.
