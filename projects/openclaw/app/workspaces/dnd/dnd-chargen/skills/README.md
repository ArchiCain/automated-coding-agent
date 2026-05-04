# Character Builder skills (placeholder)

This directory will hold AgentSkill folders for the chargen specialist. None are written yet.

## Routing convention

- Advice + synthesis (`character_template`, `ability_score_optimizer`, `feat_select`, `spell_select`) → OpenAI Codex brain (`openai-codex/gpt-5.5`). The reasoning is the whole point.
- Mechanical validation (`character_validate`) → Tier-2 (`ollama-host/gemma4-e4b-128k`). Structured rule-checking.
- Cheap retrieval (`rules_lookup`) → Tier-2.

## Out of scope until upstream tools land

- 5e SRD vector index — shared with the D&D lead
- Character sheet JSON schema + store
- Optional: D&D Beyond / Roll20 character import

See `ideas/dnd-5e-agents.md` § Phase 1 use case "Character building & leveling".
