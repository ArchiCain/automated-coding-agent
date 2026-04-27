# OpenClaw on a Local Hybrid LLM Stack — Brainstorming Summary

_Session: 2026-04-23 → 2026-04-24. Context: tinkering / learning environment, not production. "Accuracy is king, speed is not a priority" for autonomous background coding runs._

## The shape of the idea

Two boxes, split by role:

- **mac-mini** (always-on, CPU-only) → runs OpenClaw itself + the memory embedding model + owns the memory index
- **gaming PC** (intermittent, GPU-equipped) → runs the heavy coding LLM when it's up

OpenClaw is the orchestrator; its memory system and embedding layer stay on mac-mini because they're cheap, constantly active, and need to persist. The expensive generation work goes to whichever GPU box is available. If the gaming PC is off / in Windows, OpenClaw can fall back to a CPU-served model on mac-mini (OpenClaw has native multi-provider failover per their docs).

## Hardware inventory

| Box | CPU | RAM | GPU | Storage | OS | Role |
|---|---|---|---|---|---|---|
| mac-mini | Intel i7-8700B (6C/12T, AVX2) | 62 GiB | UHD 630 iGPU (unusable for inference) | 1.82 TB NVMe | Ubuntu 24.04 | OpenClaw app + memory embeddings + fallback LLM |
| gaming PC | Intel i9 (model TBC) | 96 GiB | RTX 2080 Ti (11 GB VRAM, Turing, FA v1) | 2 HDDs, dual-boot | Ubuntu (Linux side) | Primary coding LLM generation |

## Model selection — decisions & rationale

### Coding LLM (generation)
- **Gaming PC (primary): Qwen2.5-Coder-72B, Q4_K_M (~43 GB)** — partial GPU offload (~20 of 80 layers on 2080 Ti), rest on CPU in 96 GB system RAM. This is the open-source accuracy ceiling for code. Estimated ~2–3 tok/s. Q4_K_M chosen over Q5/Q6 so there's meaningful VRAM headroom for KV cache at 32K context.
- **mac-mini (fallback): Qwen2.5-Coder-32B Q6_K** — already installed, tagged `qwen-coder-32k` with 32 768 `num_ctx` baked in via Modelfile. Confirmed ~1.24 tok/s on CPU-only.

Why not 14B full-GPU at 40+ tok/s? Tempting, but the jump from 14B→72B is a bigger quality step than users typically realize on harder coding tasks, and this environment is non-interactive. Autonomous runs win more from accuracy than tok/s.

### Memory / embeddings
- **mac-mini: `bge-m3-8k`** (custom Modelfile, `num_ctx 8192`). 568M params, 1024-dim vectors, 8K context. Chosen over OpenClaw's bundled EmbeddingGemma-300M for better retrieval quality — bge-m3 is currently the strongest OSS general retriever and handles code chunks well at 8K.
- Note: **embedding model is committed once — switching later requires full reindex**. Don't churn on this.

### What OpenClaw memory does NOT need
- No separate reranker model (OpenClaw uses BM25/FTS5 for hybrid search)
- No separate summarizer/classifier model
- Just embeddings + vector store + keyword index

## Architecture at a glance

```
┌─────────────────────────────────────────────────┐
│  mac-mini (always-on, CPU)                      │
│                                                 │
│  [OpenClaw Gateway] ──→ [Ollama :11434]         │
│        │                   │                    │
│        │                   ├─ bge-m3-8k         │
│        │                   └─ qwen-coder-32k    │
│        │                      (fallback)        │
│        │                                        │
│        └──(primary LLM calls)──────┐            │
└────────────────────────────────────┼────────────┘
                                     ↓
┌─────────────────────────────────────────────────┐
│  gaming PC (intermittent, 2080 Ti + 96 GB RAM)  │
│                                                 │
│  [Ollama :11434] ── qwen2.5-coder-72B (Q4_K_M)  │
└─────────────────────────────────────────────────┘
```

OpenClaw provider config, roughly:
- Main model → `http://gaming-pc:11434` model `qwen-coder-72b` (primary), `http://mac-mini:11434` model `qwen-coder-32k` (fallback)
- Memory embedding → `http://mac-mini:11434` model `bge-m3-8k`

## Revisions to the original plan

**2026-04-26.** Two updates to the design above as the operator iterates:

- **Graphics-machine OS:** stays on Windows (no Ubuntu dual-boot). Ollama
  has native Windows support; gaming and inference are mutually exclusive
  by operator policy (Ollama quit from tray when gaming). See
  `ideas/graphics-machine-setup.md` for the handoff doc.
- **Brain model:** the agent setting up graphics-machine could not get
  Qwen2.5-Coder-72B Q8_0 working from Ollama's library, and pivoted to
  `frob/qwen3-coder-next:80b-a3b-q4_K_M` — Qwen3-Next 80B MoE with
  3B active params per token, Q4_K_M quant, 48 GB on disk. Wrapped in
  a Modelfile derivative named `qwen-coder-next-256k` with `num_ctx`
  baked to 262144. Net result: bigger total parameter count than the
  original 72B-dense plan, faster generation (3B active makes inference
  fast on partial GPU offload), and a massive 256K context window for
  codebase-aware tasks. The Q4 quant trades some accuracy headroom for
  the comfortable memory footprint (~48 GB weights + KV cache fits
  inside 96 GB with room for OS overhead).
- **OpenClaw replacement coming.** The current `projects/openclaw/` will
  be replaced wholesale by a polished OpenClaw the operator is bringing
  in from another repo. Migration plan + open questions:
  `ideas/migration-plan-polished-openclaw.md`. Provider config swap
  (cloud APIs → local stack) is part of that migration.

## Current state (as of 2026-04-24)

**Done on mac-mini:**
- LV extended 100 GB → 1.82 TB
- k3s uninstalled (reclaimed ~60 GB — prior prototype state wiped per user)
- Docker purged
- Ollama v0.21.1 installed, systemd override: `OLLAMA_HOST=0.0.0.0:11434`, `OLLAMA_KEEP_ALIVE=24h`, `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=2`
- Models loaded: `qwen-coder-32k` (26 GB, 32 768 ctx), `bge-m3-8k` (1.2 GB, 8192 ctx)
- Generation sanity-check passed: 1.24 tok/s, output coherent
- Embedding sanity-check passed: 1024-dim vectors returned

**Done — graphics-machine (gaming PC) side, 2026-04-26:**
- Installed Ollama for Windows directly (Ubuntu dual-boot abandoned per
  the revisions note above).
- Joined tailnet as `graphics-machine` via Tailscale for Windows.
- `OLLAMA_HOST=0.0.0.0:11434`, `OLLAMA_KEEP_ALIVE=24h`,
  `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_MAX_LOADED_MODELS=1` set as user-level
  env vars; firewall rule allows port 11434 from the Tailscale CGNAT
  range only.
- Pulled `frob/qwen3-coder-next:80b-a3b-q4_K_M` (Qwen3-Next 80B MoE / 3B
  active, Q4_K_M, 48 GB on disk) instead of the originally-planned
  Qwen2.5-Coder-72B Q4_K_M.
- Created `qwen-coder-next-256k` Modelfile derivative with
  `num_ctx 262144` instead of 32K — the model's hybrid attention makes
  the long context tractable on this hardware.
- Validated: model loads, generates coherent code over the tailnet from
  host-machine.

**Not yet started — OpenClaw side:**
- Stand up OpenClaw (deployment method TBD — last prototype used Helm on k3s, but that's wiped; user may choose a simpler install path now)
- Wire provider config with failover
- Define what OpenClaw actually *does* in this environment — see open questions below

## Open questions / things to explore next

1. **OpenClaw deployment shape.** The prior k3s-based install was prototype and has been wiped. Options: native install on mac-mini (simpler), docker compose (if we re-add docker), or a fresh lighter k3s/k8s if the user wants to exercise that pattern again. Depends on what the user wants to *learn*.

2. **What are the autonomous coding tasks?** The whole stack assumes "background coding projects" but we haven't defined the task surface. Candidates worth exploring:
   - Repo maintenance bots (dependency bumps, lint fixes)
   - Issue triage / auto-reply drafts
   - PR-first-pass reviews
   - Long-form refactoring runs on chosen directories
   - Research/spike mode: "investigate X overnight, leave notes"

3. **GitHub integration.** Previous prototype had a `github-app-pem` secret in the openclaw namespace. Likely means OpenClaw was wired to a GitHub App. Decide whether to recreate that App and re-register or start with simpler token-based auth.

4. **Memory seed strategy.** Fresh memory index = cold start. Worth thinking about what initial corpus should be indexed (e.g., which repos, docs, past conversations) to make the agent useful from day one rather than having to learn everything from scratch.

5. **Eval loop.** Tinkering env is the right place to build a simple eval harness — e.g., a fixed set of prompts run nightly against whatever model config is current, with outputs written to a log. Enables before/after comparisons when swapping quants/models without reindexing memory.

6. **Failure modes for intermittent GPU box.** When gaming PC is off, what does OpenClaw do? Options: (a) hard-fail the run, (b) transparent fallback to mac-mini 32B, (c) queue until back. OpenClaw's multi-provider failover supports (b) natively — worth adopting.

7. **Is the 2080 Ti the right long-term GPU?** 11 GB VRAM is tight for anything beyond 14B full-offload. A used 3090 (24 GB) would fit the 32B fully on GPU at Q4. Not urgent — this is a tinker setup — but worth noting as the natural upgrade path if this grows into something real.

8. **Observability.** A lightweight way to see what OpenClaw is *doing* (tokens consumed, memory queries, tool calls) without building a full SRE stack. Maybe just structured logs → ripgrep for now.

## Design principles to stay true to

- **Accuracy over speed.** This has been explicitly stated and is the hardest thing to remember to protect during "hey let me just try a smaller faster model" moments.
- **Keep stateful things on the always-on box.** Memory index, OpenClaw itself, config. Stateless compute (generations) goes to whichever box is available.
- **Commit once to the embedding model.** Changing it means reindexing. Don't A/B on this casually.
- **Don't treat the gaming PC as persistent.** Builds that assume it's always up will silently break. Design the app with intermittent backend as a first-class case.
