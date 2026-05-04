# Model tiering decision

**Date:** 2026-04-30 (planned topology; not yet deployed — both machines down for the household move)
**Status:** Adopted — captures the OpenAI-first three-tier topology described in `CLAUDE.md`.

## What we picked

Three model tiers, each on a different machine, each with a single primary job:

| Tier | Where | Model | Job |
|---|---|---|---|
| Brain (Tier-1) | OpenAI cloud (OAuth via ChatGPT Pro 5×) | `openai-codex/gpt-5.5` | All four core agents' reasoning. Long agentic loops, tool use, code synthesis. |
| Brain fallback (Tier-1 local) | `graphics-machine` (RTX 2080 Ti, 96 GiB RAM) | `qwen-coder-next-256k` (Qwen3-Next 80B MoE / 3B active per token, Q4_K_M, 256K ctx) | Resilience only. Used when the OAuth path is unreachable. |
| Tier-2 fast | `host-machine` (Mac mini i7, CPU-only) | `gemma4:e4b` (Gemma 4 E4B, ~4.5B effective, 128K ctx, native JSON, Apache 2.0) | Honcho deriver workload + per-skill routing for triage / classification / JSON extraction inside the email and backpacking agents. |
| Embeddings | `host-machine` | `bge-m3-8k` (1024-dim, 8K ctx) | QMD vector search + Honcho's memory embeddings. |

## Why three tiers and not one

Two failed alternatives we considered and rejected:

1. **One model for everything.** Forces the brain choice onto Honcho's deriver, which is a short, frequent, JSON-emitting workload. Today the deriver runs on `qwen-coder-32k` (Qwen2.5-Coder 32B, Q6_K, CPU on Mac mini) at ~5 tok/s. That's wildly oversized for its actual job and is the source of the deriver's slow tail latencies on bursts. Pinning it to a small fast instruct model is a multi-x speedup with no quality loss for this workload.
2. **Brain-and-embeddings only.** No fast classification path → every "is this email noise?" or "extract action items from this thread" round-trips to the brain. On OpenAI Codex that's measurable subscription quota burn; on the local Qwen fallback it's measurable latency. A small instruct model on host-machine costs nothing per call and is purpose-built for this job.

## Why these specific models

### Brain: `openai-codex/gpt-5.5` via subscription OAuth

- Frontier coding capability on tap, with best-in-class tool-call reliability — the make-or-break property for an agent that loops.
- No per-token billing on the user's existing ChatGPT Pro 5× subscription (vs. the API-key route which is metered per call). The subscription path is explicitly supported by OpenAI for external tools and by OpenClaw via its first-class `openai-codex` provider (OAuth, device-code flow for headless install).
- 1M native context capped at OpenClaw's default 272K runtime. The smaller cap has better latency and quality characteristics in practice; we're not overriding it until an actual context-overflow case shows up.

### Brain fallback: Qwen3-Coder-Next 80B-A3B (kept, not deleted)

- Was the right Tier-1 pick before OpenClaw shipped subscription auth. Still the strongest local agentic-coding model available to a single-prosumer GPU.
- The MoE-on-modest-hardware property is load-bearing: 80B total / 3B active per token, with experts paging from 96 GB system RAM, runs on an 11 GB-VRAM RTX 2080 Ti at ~3.85 tok/s over the tailnet. A 30B-class dense model would not run on this box at usable speeds.
- Resilience: when the brain endpoint is unreachable (graphics-machine off, OAuth lapsed, network blip), the agent stays useful via local fallback rather than hard-failing.

### Tier-2: Gemma 4 E4B

- ~4.5B effective parameters → fits well within host-machine's CPU budget. We expect 30–60 tok/s on the same i7-8700B that runs the existing 32B coder at ~1.24 tok/s. That's ~30× faster on workloads that don't need 32B reasoning depth.
- 128K context window — more than enough for any single-thread triage call.
- **Native structured JSON output.** Honcho's deriver and the planned `triage_inbox` / `extract_action_items` skills are JSON-emitting — having a model trained on structured output tightens reliability vs. asking a general instruct model to "return JSON only please."
- Apache 2.0 licensed; no usage restrictions for self-hosted deployment.

## Why MoE is non-negotiable for the brain on this hardware

The local fallback brain runs on a Turing-era 11 GB-VRAM card. Any dense model in the 30B+ range either won't fit at all or will run at unusable speeds because of constant VRAM-to-RAM swapping mid-token. MoE architectures route each token to a small subset of experts — Qwen3-Next-80B activates 3B params per token, so the per-token compute footprint is small even though total size is 80B. Experts page from system RAM as needed; the GPU carries only the active routing.

If we ever swap the local brain, the replacement must also be MoE. A 30B dense Coder-style model would seem competitive on paper but be unusable in practice.

## What this is not

- **Not consolidation.** Brain and Tier-2 are different workloads. We're not trying to make one model do both.
- **Not OpenAI-only.** The local stack is the resilience layer, not a vestigial backup. Honcho's deriver, embeddings, and per-skill classification all stay local by design — they fit the user's stated philosophy ("route real thinking to OpenAI; use local for embeddings, async, and small-worker tasks").
- **Not a per-token cost optimization.** With Pro 5× the subscription path is flat. The reason for keeping things on local isn't dollars; it's latency, privacy, and offline resilience.

## What we'll re-evaluate

- **Pro 5× rate limits in practice.** The user's stated position is "wire it OpenAI-first, observe real usage, escalate the subscription if quota becomes a real problem." Don't pre-optimize until a real signal appears.
- **Gemma 4 Coder release.** If a coder-tuned variant of Gemma 4 ships, it's a candidate for the Tier-2 slot. Re-test then.
- **Ollama tool-parser fixes for Gemma 4.** If tool-call reliability turns out to be the limiting factor for any Tier-2 skill, that's the symptom to watch.
- **New Qwen brain releases.** The local fallback only matters when OAuth is unreachable. Replacement bar is high — must be MoE, must run on the same RTX 2080 Ti / 96 GiB RAM, must be at least as good at agentic coding as Qwen3-Coder-Next-80B-A3B. Don't churn unless something materially better lands.

## References

- `CLAUDE.md` — the active session plan that captures this decision and assigns it work
- `projects/openclaw/.docs/overview.md` — runtime topology
- `infrastructure/.docs/hosts.md` — concrete per-host inventory
- `ideas/openclaw-local-llm-hybrid.md` — earlier history (single-tier local brain era)
