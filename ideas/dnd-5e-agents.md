# D&D 5e agents (multi-phase idea)

**Date:** 2026-04-30
**Status:** Idea captured. No implementation yet. The player-sidekick phase is concrete enough to start; the DM and voice phases need real prototyping before they're scoped.

## What this is

Two future OpenClaw agents to support the user's D&D 5e play:

1. **`dnd-player`** — a sidekick the user talks to *while playing*. Looks up rules, remembers character decisions, helps the user (a new player) understand what they can actually do with their character on any given turn.
2. **`dnd-dm`** — a Dungeon Master assistant. Initially a co-DM tool (helps a human DM with prep, encounter design, NPC voicing). Eventually, maybe, a solo DM that runs sessions for a player group.

Both fit the same "personal-life agent" pattern as `email` and `backpacking` — user-facing peers, not subagents of orchestrator. They live in `projects/openclaw/app/workspaces/{dnd-player, dnd-dm}/` when built.

A third strand — voice-driven at-the-table interaction ("phone call to the agent during the session") — is a separate prototyping problem layered on top of either agent.

## Why this fits OpenClaw

- **Multi-agent runtime is already shipped.** Adding a new persona is a workspace folder + an `agents.list[]` entry — same pattern email and backpacking just established.
- **Honcho is built for cross-session character/campaign memory.** "What did my character decide about the cult of Vecna last session?" is exactly the kind of thing Honcho's deriver and `honcho_search_conclusions` were designed for. No new memory infrastructure needed.
- **The three-tier model topology covers the workload mix.** Quick rule lookups and structured extraction → Tier-2 (Gemma 4 E4B). Multi-step synthesis (encounter design, narrative pacing) → OpenAI Codex brain. Embeddings for RAG → bge-m3 already running on host-machine.

What's *missing* and would need to be added: a vector store for the 5e rules corpus (QMD doesn't fit — it's repo-only and indexes Markdown; the SRD ingestion is a different shape), and a small set of tools (dice roller, character sheet reader/writer, optionally Roll20/Foundry sync).

## Phase 1 — `dnd-player` sidekick

The shippable starting point. Concrete enough to start designing now.

### Use cases (in priority order)

1. **"What can I do on my turn?"** Given a character's class, level, prepared spells, current conditions, remaining slots, and the situation, list the genuine options (action / bonus action / reaction / movement). This is the single biggest pain point for new players and the highest-leverage thing the agent can do.
2. **Rule lookups.** "How does Sneak Attack interact with disadvantage?" "Can I cast a spell and shove someone in the same turn?" Returns the rule with a citation back to the source page/section, plus the common-table-ruling caveats.
3. **Character building & leveling.** Walk through level-up choices for the user's character. Compare options ("if you take War Caster vs. Resilient (Con) at level 4...") — opinionated, with reasoning, not just stat dumps.
4. **Decision log.** "What did we decide about the artifact in the dragon's hoard last session?" Honcho persists this across sessions; the agent surfaces it on demand.
5. **Spell/feature/condition lookups.** Fast structured retrieval — what does *Counterspell* do, what does *Frightened* do, what does Action Surge cost.
6. **Pre-session prep.** "Remind me what's on my character sheet" / "what did the party agree to do at the end of last session" — read-back, not synthesis.

### Persona sketch (rough)

Voice should be:
- Patient with new-player questions, but not condescending. The user *is* a new player and wants to learn, not be hand-held.
- Opinionated about choices when there's a defensible "better" answer ("at level 3, Eldritch Blast + Agonizing Blast is genuinely strong; you don't need to feel bad picking it"), and honest when there isn't ("between these two feats, it's a wash — pick what fits your concept").
- Cites rules with page or section references when reading from the SRD. Doesn't make up rules. If it's not sure, says so.
- Treats the user's character sheet and campaign decisions as ground truth, not suggestions.

Candidate emoji: 🐉 (the obvious one) or 🎲. Both work; 🐉 is more evocative.

### Tools needed

| Tool | Purpose | Provider |
|---|---|---|
| `dice_roll` | Roll Nd{4,6,8,10,12,20,100} with modifiers, advantage/disadvantage, exploding dice. Show every die, not just the total. | Self-contained — small Python/JS module shipped as a skill. |
| `rules_lookup` | RAG over the SRD corpus. Returns relevant rules text with section anchor. | New: vector DB + embedding pipeline (see below). |
| `character_get` / `character_update` | Read and update the user's character sheet. | Backed by a JSON file in the agent's workspace, or syncing to Roll20/Foundry/D&D Beyond if the user wants. |
| `spell_lookup` / `feature_lookup` / `condition_lookup` | Structured retrieval (faster than RAG when the user names the exact thing they want). | Pre-extracted JSON from the SRD; ships with the agent. |
| `decision_log_search` | Surface prior session decisions. | Honcho — already exists. |
| `session_note_write` | Append a structured note to the current session log. | Honcho `messages` + a small skill for formatting. |

### Knowledge corpus (the RAG part)

This is the one piece that requires real care. **What's safe to ingest:**

- **5e SRD 5.1** — Wizards of the Coast publishes this under Creative Commons (CC-BY-4.0 since 2023). It covers ~80% of what a new player encounters: core rules, common spells, common monsters, the basic classes and races. **This is the foundation of the corpus.**
- **5e SRD 5.2 / "2024 Free Rules"** — the 2024 rules update, also CC-BY. Pull this if/when the user's table is on the 2024 rules.
- **The user's own campaign notes** — session logs, NPC names, party decisions. These can live in a separate index.
- **Public OGL content** — many third-party adventures and supplements are released under the OGL or CC. Case-by-case, with the license file checked.

**What's NOT safe to ingest:**

- The PHB, DMG, MM, or any official WotC product beyond the SRD. These are not freely redistributable, and feeding them into a private vector DB the user owns is gray-zone at best — fine for personal-use lookup, but worth flagging because the user said "find a PDF and load it." A pirated PDF would be the wrong move; an SRD-only index covers most of the actual play needs anyway.
- Published adventures the user doesn't own.

**Ingestion shape:**

- Source: SRD distributed as Markdown (the community-maintained `5e.tools` data files are a good starting point — CC-licensed and already chunked sensibly).
- Chunking: by section, then by sub-rule. A spell description is one chunk; a class feature is one chunk. Don't paragraph-chunk a long table.
- Embeddings: `bge-m3-8k` (already on host-machine, 1024-dim, 8K ctx). Same model that powers the existing memory search. No new install.
- Index: standalone pgvector DB? Extend Honcho's? *Recommend* a separate pgvector instance — the SRD is a static, reindex-on-source-change corpus; mixing it into Honcho's per-conversation pgvector confuses both. A second pgvector container in `infrastructure/compose/openclaw/` is cheap.
- Retrieval: top-k vector search + BM25 reranking on rule-name keywords (rule names are highly distinctive — "Eldritch Blast" → exact-match wins over fuzzy semantic). The skill that wraps retrieval should support both modes.

### Memory model

Honcho already covers this:

- **Per-character workspace** in Honcho. The user's wizard "Mira" has her own conclusions namespace; switching to a different campaign or PC creates a new workspace.
- **Decision log via the deriver.** The deriver (now on Gemma 4 E4B) extracts "decisions made" / "facts learned" from each session as Honcho conclusions. `honcho_search_conclusions` makes them retrievable.
- **Character sheet as a workspace file.** Plain JSON in `/workspace/.openclaw/workspaces/dnd-player/characters/{name}.json`. Source-of-truth, edited by the agent and the user.

The character-sheet-as-JSON file is deliberately *not* in Honcho — it's authoritative state, not memory. Honcho holds episodic ("we agreed to investigate the cult"), the JSON file holds current ("Mira is level 5, has 3 third-level slots remaining").

### Skill routing (Tier-1 vs Tier-2)

| Skill | Tier | Why |
|---|---|---|
| `dice_roll` | n/a (deterministic) | Pure code, no LLM. |
| `rules_lookup` (RAG retrieval) | Tier-2 (`gemma4-e4b-128k`) | Retrieve top-k chunks, summarize and cite. Cheap classification of the question type ("which rule is being asked about?") fits Tier-2. |
| `character_get` / `_update` | Tier-2 for parsing, Tier-1 if the request involves rule interpretation ("am I allowed to multiclass into Paladin?") | Most updates are mechanical; multiclass eligibility checks need real reasoning. |
| "What can I do on my turn?" | **Tier-1 (brain)** | Combines character state + rules + situation. Multi-step. The agent flagship; quality matters more than latency. |
| Level-up advice | Tier-1 | Synthesis. |
| Pre-session recall | Tier-2 | Honcho retrieval + light formatting. |

### Out of scope for Phase 1

- Image generation (character portraits, battle maps).
- Voice (handled separately in Phase 3).
- DM-side anything.
- Deep integration with Roll20 / Foundry / D&D Beyond — read-only character sheet import is fine to add later, but writes back to those systems are a much bigger lift.

## Phase 2 — `dnd-dm` agent

Significantly harder than Phase 1. Two viable scopes; pick deliberately.

### Scope option A — co-DM tool (shippable in months)

The human DM runs the session. The agent helps with:

- **Encounter design.** "Build a CR-appropriate encounter for a 4-character level-5 party in a swamp." Returns monsters, environment hazards, suggested tactics, expected difficulty.
- **NPC generation.** Name, stat block, voice/personality notes, a hook to plug them into the campaign.
- **Initiative tracker.** Spreadsheet-shaped tool that tracks rounds, conditions, HP. Run via chat: "Goblin 2 takes 8 damage, is now bloodied."
- **Loot generator.** Random treasure tables, scaled to encounter CR.
- **Rules adjudication on demand.** Same lookup capability as `dnd-player` but called from the DM side.
- **Session log writer.** End-of-session: synthesize a recap from the chat transcript + DM notes.

This is fundamentally a smarter version of `dnd-player` with a different persona and different tools. Achievable.

### Scope option B — solo DM (years away, possibly never)

The agent runs the table. Players talk to it; it narrates; it adjudicates; it improvises.

The hard problems:
- **Long-horizon memory.** A campaign runs weeks-to-months. The agent has to remember NPCs, plot threads, party promises, foreshadowing. Honcho helps but doesn't solve it — long-arc plot pacing is qualitatively different from session memory.
- **Pacing.** A good DM cuts away from a slow scene, escalates a dragging fight, lets a poignant moment breathe. This is taste, not rules.
- **Fairness.** A DM who fudges in players' favor is loved; a DM who fudges against them is fired. The agent has to model what's fair.
- **Improv.** The party will do something the agent didn't plan for. Every session.
- **Voice (literal).** Solo DM almost requires the voice prototype from Phase 3 — typing all DM narration is friction-heavy at the table.

Realistic posture: Scope A is on the roadmap. Scope B is a "maybe, eventually" — pursue only if Scope A is solid and the user actively wants it. Don't try to build B by gradually extending A; it's a different agent.

### Persona sketch (Scope A)

Candidate emoji: 🧙 or 🐲. The DM's voice should be:

- Confident on rulings but explicit about when something is rules-as-written vs. rule-of-cool.
- Detail-oriented on NPC and encounter generation (names, motivations, tactics) without becoming a wall of text.
- Bluntly honest about encounter difficulty ("this fight is a 70% TPK risk for a level-3 party — are you sure?").
- Generative on demand: when asked for "three goblin warlords with hooks," delivers three actually-different goblin warlords, not three name-swaps.

### Tools the DM agent needs (over and above the player's)

| Tool | Purpose |
|---|---|
| `encounter_build` | CR/XP-budgeted encounter generation, environment-aware. |
| `monster_lookup` | Structured monster stat block retrieval (SRD or user's own bestiary). |
| `npc_generate` | Name + stat block + voice notes + plot hook. |
| `initiative_track` | Stateful combat tracker. |
| `loot_roll` | Treasure tables. |
| `session_recap` | End-of-session synthesis. |
| `campaign_state_get` / `_update` | Long-arc state (NPC dispositions, plot flags, location states). |

## Phase 3 — voice + at-the-table interaction

Real prototyping needed. This is the one the user said "will take lots of planning and prototyping" — agree.

### The vision

The agent is on speakerphone (or in a Discord voice channel, or on an actual phone call). The user — or the whole table — talks to it. It talks back. Latency feels conversational.

Two distinct deployment shapes worth prototyping:

1. **Single-player, at-the-table.** User has the agent on their laptop or phone. Speakerphone, push-to-talk to avoid picking up other players. Agent answers rule questions in real time without the user typing. This is the easier of the two — single user, controlled audio environment.
2. **Whole-table-driven, agent-as-DM.** Far harder. Agent listens to the room, picks out who's speaking, knows when to interject vs. let players talk to each other. Needs speaker diarization and turn-taking.

### Component choices

**Speech-to-text:**
- `whisper.cpp` running locally on host-machine (Mac mini i7) — privacy-preserving, zero per-call cost, ~real-time on `whisper-small` or `-medium`. Good first-prototype choice.
- OpenAI Whisper API — better accuracy on noisy audio, but introduces cloud dependency for a use case where privacy matters (the table's actual conversation).
- OpenAI Realtime API — single-stream STT+LLM+TTS, lowest latency, but pulls everything cloud-side and forecloses local-first.

**Text-to-speech:**
- Piper (local, Apache 2.0, decent voices, fast on CPU). Good first-prototype choice.
- ElevenLabs (cloud, best voice quality, costs add up if used heavily).
- OpenAI TTS (cloud, OK quality, lower cost than ElevenLabs).

**Recommended starting stack:** whisper.cpp (small/medium model) → Tier-2 Gemma for routing/classification → either Tier-1 Codex (cloud) or local fallback for synthesis → Piper for TTS. Mostly local; cloud only when the question genuinely needs the brain.

### Latency budget

Conversational speech feels natural when the response starts within ~800 ms of end-of-utterance. Budget breakdown for the recommended stack:

| Stage | Target | Notes |
|---|---|---|
| End-of-speech detection | ~200 ms | VAD on the input stream. |
| STT (whisper.cpp small) | ~150-300 ms | ~real-time on i7 for short utterances. |
| LLM inference | varies wildly | Tier-2 Gemma local: ~100-200 ms first token. Tier-1 Codex cloud: ~400-1000 ms first token + tailnet RTT. |
| TTS first audio frame | ~100-200 ms | Piper streams. |
| **Total to first audible** | **~600-1700 ms** | At the upper end, the conversation feels laggy. |

The latency math says: route as much as possible through Tier-2 + local TTS. Reserve Codex for when the question genuinely needs synthesis (encounter design, narrative beats), and accept the ~1.5 s wait for those.

### Form factors worth prototyping (in cost order)

1. **Laptop on the table, speakerphone + push-to-talk.** Lowest friction, highest privacy. Same setup the user already has. Build this first.
2. **Discord voice channel with the agent as a bot.** OpenClaw has Discord channel support; could plug in. Useful if the table plays remotely.
3. **Actual phone call (Twilio).** "Dial the DM." Cute, demo-friendly. Probably never the daily driver.
4. **Smart speaker / dedicated hardware.** A Raspberry Pi + mic array + speaker dedicated to the DM. Real prototype-grade work. Years out, if ever.

### Privacy

The table's conversation includes the user, friends, possibly improvised personal references. **Default should be: audio never leaves the local network.** That's the killer argument for whisper.cpp + Piper local. Cloud LLM call for the synthesis step is fine — it sees only the (heavily summarized) prompt, not the raw audio.

## Storage and infrastructure additions needed

| Component | Why | Where it lives |
|---|---|---|
| Second pgvector instance | Static SRD corpus; mixing with Honcho's per-conversation store is wrong. | New service in `infrastructure/compose/openclaw/`. ~100 MB indexed. |
| SRD ingestion pipeline | Pull SRD Markdown → chunk → embed → upsert. Re-runnable. | Small Python or Bun script under `projects/dnd/` or `scripts/`. |
| Character sheet schema | JSON Schema definition for character files. | `projects/dnd/.docs/character-schema.md` + a JSON Schema file. |
| Optional: dice roller skill | Pure code, no model. | `projects/openclaw/app/skills/dice-roll/SKILL.md`. |
| (Phase 3) STT/TTS workers | Audio pipeline. | New compose services or sidecars on host-machine. |

## Open questions

- **Single dnd-player vs. per-character agents?** The user might play multiple characters across multiple campaigns. Probably one `dnd-player` agent with a "current character" pointer in its workspace, switchable on demand. Multi-character is a config detail, not a multi-agent problem.
- **2014 vs. 2024 rules?** SRD covers both eventually. Pick which the user's table runs and use that as the primary corpus; index the other if/when the table switches.
- **Roll20 / Foundry / D&D Beyond integration?** The user's table presumably uses one of these. Read-only character import is a reasonable Phase-1.5 add-on. Bidirectional sync is a Phase 3 problem (or never).
- **Tools at the table.** Does the user actually want the agent open during play, or only between sessions? This affects whether voice (Phase 3) is essential or a "nice to have."
- **DM agent quality bar.** Where's the line where the DM agent is "good enough" to use? Co-DM (Phase 2 Scope A) probably needs to be ~as good as a competent human DM at encounter design and rules adjudication. Solo DM (Scope B) needs to be at least competent at improv, which is much harder to evaluate.

## What this doesn't change

- The OpenClaw runtime, the four core software agents, the existing memory stack, or anything in `projects/application/`.
- The model topology — Tier-1 brain + Tier-2 fast + embeddings is exactly the right shape for this work.
- The personal-life-agent pattern email and backpacking established. `dnd-player` is the third instance of that pattern.

## Suggested next moves (when picking this up)

1. Pull the SRD source files and stand up the ingestion pipeline locally first — no agent, just "can I retrieve `Magic Missile`'s description by vector search." This tells you everything about whether the corpus is right and the chunking is sensible.
2. Build the `dnd-player` skeleton (SOUL/AGENTS/IDENTITY) the same way email and backpacking just got built.
3. Wire the `rules_lookup` and `dice_roll` skills as the minimum viable toolset.
4. Use the agent for one actual game session. Find out where it falls short. Iterate.
5. Only after Phase 1 has been used in anger should Phase 2 start. And Phase 3 should not start until the user has a strong opinion (from real Phase 1 use) about what voice would actually solve.

## References

- 5e SRD 5.1 (CC-BY-4.0): <https://dnd.wizards.com/resources/systems-reference-document>
- 5e Free Rules 2024: <https://dnd.wizards.com/resources/2024-free-rules>
- `5e.tools` data: community-maintained, useful as a starting corpus shape (check license per file before redistributing)
- `whisper.cpp`: <https://github.com/ggerganov/whisper.cpp>
- Piper TTS: <https://github.com/rhasspy/piper>
- `projects/openclaw/.docs/overview.md` — runtime topology this would slot into
- `ideas/model-tiering-decision.md` — the brain/Tier-2/embeddings reasoning that this idea inherits
