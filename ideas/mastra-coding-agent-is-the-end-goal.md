# Mastra as the Coding Agent Orchestration Layer

## The Problem

We currently have two SDK integrations in `projects/the-dev-team/backend/app/src/features/agent/providers/`:

- **Claude Code SDK** (`claude-code.provider.ts`) — works, but only gives us 5 built-in file tools (`Read`, `Write`, `Edit`, `Glob`, `Grep`) on top of what our MCP server already provides
- **Open Code SDK** (`opencode.provider.ts`) — unimplemented stub, throws on query

Everything interesting (git, sandbox, worktree management — 17 tools total) is already in our own MCP server (`mcp-server.ts`). The SDKs are mostly giving us the agentic loop (tool call -> result -> continue) and file operations.

## Why Mastra

Mastra is a TypeScript AI agent framework that replaces both SDKs with one orchestration layer:

1. **Agentic loop** — handles the tool call -> result -> continue cycle automatically (the main thing we'd lose dropping the SDKs)
2. **Native MCP support** — `MCPClient` connects directly to our existing `mcp-server.ts` via stdio, no changes needed to our 17 tools
3. **Multi-provider LLMs** — swap between Claude, OpenAI, Gemini, local models with `"anthropic/claude-opus-4-6"` / `"openai/gpt-5"` style strings. This solves the dead OpenCode provider — instead of two SDK integrations, one framework routes to any model
4. **Streaming** — full streaming support including tool call events, which our WebSocket gateway needs

## Migration Plan

### Keep as-is
- `mcp-server.ts` (all 17 tools) — Mastra connects to it as an MCP client
- WebSocket gateway, agent controller, session management

### Replace
- `claude-code.provider.ts` -> Mastra agent with our MCP server as a toolset
- `opencode.provider.ts` -> same Mastra agent, different model string
- `provider-registry.ts` -> simplified, since Mastra handles provider routing

### Add to MCP
- `read_file`, `write_file`, `edit_file`, `glob`, `grep` tools in `mcp-server.ts` (the 5 built-ins we currently get from Claude Code SDK)

## Before vs After

### Current Architecture
- Claude Code SDK for Claude + built-in file tools
- OpenCode SDK (unimplemented) for eventually something
- Our MCP server for everything interesting (git, sandbox, worktree)

### Target Architecture
- **One orchestration layer** (Mastra) that talks to any model
- **One tool surface** (all MCP) that's model-agnostic
- No SDK vendor lock-in

The provider-registry pattern we built is essentially what Mastra already does at a more mature level. We'd delete boilerplate and gain model flexibility.

## Local Model Strategy (Mac Mini Worker)

### Hardware
- Intel i7-8700B (6 cores / 12 threads, 4.6GHz turbo)
- 64GB RAM
- 1.82TB NVMe (needs LVM expansion — 1.72TB currently unallocated)
- No discrete GPU — CPU-only inference
- Ubuntu

### Models

**Primary: Qwen 2.5 Coder 32B Q4_K_M (~18GB)**
- Best open-source coding model that fits this hardware
- Beats general-purpose 70B models on coding tasks despite being half the size
- Strong instruction following and tool use — critical for the structured decomp pipeline
- ~2-3 tokens/sec on CPU — slow but accurate
- Use for: decomp agents (plan -> projects -> features -> concerns)

**Secondary: Qwen 2.5 Coder 14B Q4_K_M (~8GB)**
- Good coding accuracy, roughly double the throughput of 32B
- Can run 2 instances in parallel (~16GB total)
- Use for: execution agents (implementing concern-level tasks)

**Mixed strategy (recommended):** One 32B instance for decomp + one 14B instance for execution = ~26GB total, plenty of headroom.

### Runtime

Ollama — simplest path, exposes OpenAI-compatible API that Mastra talks to natively:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5-coder:32b-instruct-q4_K_M
ollama pull qwen2.5-coder:14b-instruct-q4_K_M
```

Mastra connects to `http://mac-mini:11434` as an OpenAI-compatible provider.

### Throughput Estimates

- A typical concern-level task (~2000 tokens output, few tool call rounds): ~10-15 min on 32B
- Full decomp pipeline (plan -> projects -> features -> concerns): ~30 min per plan on 32B
- Overnight batch (8 hours): ~30-40 concern tasks sequential on 32B, or ~50-60 tasks with parallel 14B instances

### Overnight Batch Workflow

```
Developer (local Claude Code) → brainstorm → plan.md → git push
                                                          ↓
Mac Mini (Mastra + Ollama) ← cron picks up new plans
  ├─ Decomp 1-3 (32B, sequential) → ~30 min per plan
  └─ Execution (14B x2 parallel) → chews through concerns all night
                                                          ↓
Morning → git pull, review results, run review agent
```

This is a "let it cook" setup. The 2-3 t/s speed doesn't matter when you're not waiting interactively. The decomp pipeline gives each agent a focused, well-scoped task with concrete acceptance criteria, which is exactly where smaller models excel — they don't need to hold full project context, just follow structured instructions.

### LVM Expansion (prerequisite)

The root LV is only 100GB of the 1.82TB volume group. Expand before pulling models:

```bash
sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv
sudo resize2fs /dev/ubuntu-vg/ubuntu-lv
```

## GPU Upgrade Path: NVIDIA DGX Spark

### Hardware

- NVIDIA Grace Blackwell GB110 Superchip
- 128GB unified memory (shared CPU/GPU — no VRAM wall)
- Up to 1 PFLOPS at FP4
- ARM-based Grace CPU
- Compact desktop form factor

### What this unlocks

128GB unified memory eliminates the quantization-or-nothing tradeoff. Models that required heavy quantization on the Mac Mini can run at full or near-full precision:

| Model | Q4 | Q8 | FP16 | Fits in 128GB? |
|-------|----|----|------|----------------|
| Qwen 2.5 Coder 32B | ~18GB | ~34GB | ~64GB | All three |
| Llama 3.3 70B | ~40GB | ~70GB | ~140GB | Q4 and Q8 |
| DeepSeek-V2.5 (236B MoE) | ~80GB | — | — | Q4 yes |
| Qwen 2.5 72B | ~40GB | ~72GB | — | Q4 and Q8 |

Inference speed jumps from 2-3 t/s (CPU) to 50-100+ t/s on Blackwell.

### Models (DGX Spark)

**Decomp + Review agents: Llama 3.3 70B Q8 (~70GB)**
- Near-lossless quantization of a much larger model
- Superior reasoning for architectural decomposition and code review
- 40-60 t/s on Blackwell
- One instance, used sequentially for planning and review stages

**Execution agents: Qwen 2.5 Coder 32B FP16 (~64GB) x2 parallel**
- Full precision — zero quantization loss, maximum coding accuracy
- With the 70B not loaded simultaneously, two 32B instances fit comfortably
- Parallel execution of concern-level tasks

**Recommended strategy:** Load the 70B for decomp, swap to dual 32B instances for execution, swap back to 70B for review. Ollama handles model loading/unloading automatically.

### Throughput Estimates (DGX Spark)

- Concern-level task: ~1-2 min (vs 10-15 min on Mac Mini CPU)
- Full decomp pipeline: ~5-10 min per plan (vs 30 min)
- Overnight batch (8 hours): could process an entire project — hundreds of concern tasks
- Real-time interactive workflow becomes viable — no longer a "let it cook" compromise

### Workflow Change

The DGX Spark shifts from overnight batch to real-time:

```
Developer (local Claude Code) → brainstorm → plan.md → git push
                                                          ↓
DGX Spark (Mastra + Ollama)
  ├─ Decomp 1-3 (70B Q8) → ~5-10 min per plan
  ├─ Execution (32B FP16 x2 parallel) → tasks complete in minutes
  └─ Review (70B Q8) → immediate feedback
                                                          ↓
Developer can watch progress in real-time, iterate same day
```

The parallel dev team vision becomes fully viable — not as an overnight compromise, but as a real-time workflow where you brainstorm in the morning and review working code by lunch.

## Memory & Knowledge Layer

### The Problem with Current Context Management

Agents currently receive context through distilled markdown files (plan.md, task.md) at each decomposition level, and docs/ content is hardcoded into system prompts. This has three limitations:

1. **Static context** — agents get what was written into their task file, nothing more. No access to sibling agent discoveries.
2. **Docs burn context** — ~3-5K tokens of architectural docs injected into every system prompt, whether needed or not. On a 32K context window, that's 10-15% wasted.
3. **No cross-session learning** — when an execution agent discovers a pattern or gotcha, that knowledge dies with the session.

### Inspiration: Karpathy's LLM Wiki + agentmemory

**Karpathy's thesis**: Stop doing RAG (re-deriving knowledge every query). Maintain a persistent, LLM-curated wiki instead. Three operations: *ingest* (process source, update wiki pages), *query* (search and synthesize), *lint* (find contradictions and stale info).

**agentmemory extends this for multi-agent systems**:
- Confidence scoring — facts carry reliability weights that decay over time
- Consolidation tiers — Working memory → Episodic → Semantic → Procedural (each more compressed, longer-lived)
- Knowledge graph — typed entities and relationships for traversal
- Multi-agent coordination — shared vs private scoping, mesh sync between parallel agents

### Mastra's Built-in Memory (maps directly to these concepts)

| Mechanism | What It Does | Maps To |
|-----------|-------------|---------|
| **Working Memory** | Structured scratchpad in system prompt, updated between turns | Working memory tier |
| **Semantic Recall** | Embeds messages into vector store, retrieves by similarity | Episodic/semantic tiers |
| **Observational Memory** | Background agents compress old messages (5-40x ratio) | Consolidation pipeline |
| **RAG Pipeline** | Chunk, embed, store, retrieve from document corpus | Karpathy's wiki query |

### Architecture

```
Mastra Orchestrator
  ├─ Agents (brainstorm, decomp, execution, review)
  │    ├─ Working Memory (per-agent task state)
  │    ├─ Semantic Recall (cross-agent, shared by feature)
  │    └─ Observational Memory (context compression)
  │
  ├─ RAG Corpus
  │    ├─ docs/ directory (architecture, patterns, conventions)
  │    └─ Plan digests (accumulated execution knowledge)
  │
  ├─ Storage: pgvector (reuse existing PostgreSQL)
  └─ Embeddings: Ollama + nomic-embed-text (local, CPU, 0.5GB)
```

### How It Maps to the Agent Pipeline

**Docs as RAG (Phase 1 — highest impact, lowest effort)**
- Chunk and embed the ~25 files in docs/ with nomic-embed-text via Ollama
- Store in pgvector (already in the stack)
- Give agents a `query_docs` tool — they pull what they need, when they need it
- Remove hardcoded docs from system prompts
- Saves 3-5K tokens per agent, making the 32K Mac Mini context window much more usable

**Observational Memory (Phase 2 — critical for Mac Mini)**
- Execution agents run long conversations (read, edit, read again, fix, retry)
- On a 32K window, raw history fills up fast
- OM compresses older messages automatically — agent remembers what it did without full token cost
- Difference between an execution agent that can do 3 edit cycles vs 10
- Configure threshold at ~15-20K tokens to trigger compression early

**Cross-agent Semantic Recall (Phase 3)**
- All agents working on the same Feature share a `resourceId` (e.g., `feature-auth`)
- When the `service` concern agent discovers a pattern, the `controller` concern agent can query it
- Review agents query all execution agent observations for holistic review
- Context flows sideways (between siblings), not just downward (parent to child)

**Plan History as Compiled Knowledge (Phase 4 — Karpathy pattern)**
- After each plan execution completes, auto-generate a digest: what was built, what patterns worked, what failed
- Embed these digests into the RAG corpus alongside docs
- Over time, the system accumulates procedural knowledge about the codebase
- Future brainstorm and decomp agents benefit from past execution experience
- The system gets smarter over time — month 3 agents know things month 1 agents didn't

### Resource Cost

- Embedding model: nomic-embed-text via Ollama, 0.5GB RAM, CPU-friendly — runs alongside everything else on Mac Mini
- Vector storage: pgvector, minimal overhead on existing PostgreSQL
- Observational Memory background agents: small model or cheap API (Gemini Flash ~$0.15/M tokens)
- Embedding latency: ~100-500ms per query on CPU — negligible vs LLM response times

## Risks

- Mastra is still relatively young (post-1.0 but evolving fast). We'd be trading Anthropic's SDK stability for a more feature-rich but faster-moving dependency.
- Need to verify their streaming event format maps cleanly to what our `AgentGateway` expects before committing.
- The `Edit` tool's diff-based editing logic (find unique old_string, replace with new_string) needs to be reimplemented in our MCP server — straightforward but worth getting right to avoid token waste and edit errors.
- CPU-only inference is slow — viable for overnight batch work, not for interactive use. If interactive speed becomes a priority, adding a discrete GPU (e.g. RTX 3090, 24GB VRAM, ~$700 used) would give 10-20x throughput.
