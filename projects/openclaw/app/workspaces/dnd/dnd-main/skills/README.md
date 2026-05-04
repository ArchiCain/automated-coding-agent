# D&D lead skills (placeholder)

This directory will hold AgentSkill folders for the D&D lead. None are written yet.

## Routing convention

- Cheap retrieval and classification (`rules_lookup`, `spell_lookup`, `feature_lookup`, `decision_log_search`) → Tier-2 (`ollama-host/gemma4-e4b-128k`)
- Multi-step synthesis ("what can I do on my turn?", level-up advice, multiclass comparisons) → OpenAI Codex brain (`openai-codex/gpt-5.5`)
- Pure code (`dice_roll`) → no model

Skills express this via `model:` in `SKILL.md`. The agent default is the brain; classification skills must opt down to Tier-2 explicitly.

## Out of scope until upstream tools land

- 5e SRD vector index (separate pgvector instance + ingestion pipeline) — needed for `rules_lookup`
- Character sheet JSON store + schema — needed for `character_get` / `character_update`

See `ideas/dnd-5e-agents.md` for the full plan.
