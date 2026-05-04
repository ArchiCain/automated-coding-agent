# Hosts

Concrete inventory of the tailnet hosts referenced by role in
`ecosystem.md`. Updated when a host is reprovisioned or its installed
software changes — not on every deploy. Use this when you need to
know *what's actually on the box* (specs, Ollama version, installed
models, listen addresses) without having to SSH in.

Roles are stable; hostnames may not be. This doc names hosts by their
**Tailscale machine name**, not their `/etc/hostname`.

## host-machine

Always-on Ubuntu box. Runs the OpenClaw compose stack, the dev app
stack, sandboxes, embeddings, the Tier-2 fast model (Gemma 4 E4B, planned),
and the local resilience fallback brain.

**Last verified:** 2026-04-26 via `ssh scain@host-machine`. Currently
**offline for the household move** (2026-04-30); the box was running Ubuntu
before the move and the user is doing a clean Ubuntu reinstall during the
rebuild. All sections below describe the post-move target state — not yet
re-verified.

### Hardware

| | |
|---|---|
| Model | Apple Mac mini (2018, T2) repurposed |
| `/etc/hostname` | `mac-mini` |
| Tailscale name | `host-machine` (`100.71.239.27` — pre-move) |
| OS (target) | Ubuntu 24.04.x LTS (clean reinstall during the move) |
| CPU | Intel Core i7-8700B @ 3.20 GHz — 6 cores / 12 threads, AVX2 |
| RAM | 62 GiB + 8 GiB swap |
| GPU | Intel UHD 630 iGPU only — **no CUDA**, not used for inference |
| Disk | 1.8 TB root, ~1.7 TB free (will rebuild fresh on reinstall) |

### Ollama

Installed as a systemd service, listens on `0.0.0.0:11434` so it's
reachable from the rest of the tailnet.

| | |
|---|---|
| Version | `0.21.1` |
| systemd unit | `/etc/systemd/system/ollama.service` (drop-in: `override.conf`) |
| `OLLAMA_HOST` | `0.0.0.0:11434` |
| `OLLAMA_KEEP_ALIVE` | `24h` |
| `OLLAMA_NUM_PARALLEL` | `1` |
| `OLLAMA_MAX_LOADED_MODELS` | `2` |
| Listen | `tcp *:11434` (any iface) |
| OpenAI-compat shim | `http://host-machine:11434/v1/{chat/completions,embeddings}` |
| Native API | `http://host-machine:11434/api/{generate,embeddings,tags,...}` |

Concurrency floor: `MAX_LOADED_MODELS=2` means the embed model and one
LLM can be hot at the same time. Pulling in a third model evicts one.

### Installed models (post-move target)

| Tag | Size | Role | Notes |
|---|---|---|---|
| `bge-m3-8k:latest` | 1.2 GB | Embeddings — current memory model | Modelfile derivative of `bge-m3` with `num_ctx 8192`. 1024-dim vectors. **The repo's openclaw.json points memory search here.** |
| `bge-m3:latest` | 1.2 GB | Base embedding model | 512 ctx default. Kept around as the source for the `-8k` derivative; not directly referenced by config. |
| `openai/text-embedding-3-small:latest` | 1.2 GB | Honcho-facing alias | `ollama cp bge-m3-8k openai/text-embedding-3-small:latest`. Honcho's `embedding_client.py` hardcodes this OpenAI model name; the alias makes the request resolve to bge-m3 weights without code changes. |
| `gemma4-e4b-128k:latest` *(planned)* | ~3 GB | **Tier-2 fast model.** Honcho deriver + future fast-classification skills (email triage, gear classification, etc.) | Pull `gemma4:e4b` then `ollama cp gemma4:e4b gemma4-e4b-128k:latest`. ~4.5B effective params, 128K ctx, native structured JSON, Apache 2.0. Repo's `honcho-config.toml` points the deriver here. Expected 30–60 tok/s on this box. |
| `qwen-coder-32k:latest` | 26 GB | Honcho deriver fallback (no longer primary) | Modelfile derivative of `qwen2.5-coder:32b-instruct-q6_K` with `num_ctx 32768`. CPU-only on this box (~1.24 tok/s measured — wildly oversized for the deriver workload, which is why we're moving deriver to Gemma 4 E4B). Kept installed as the fallback per the planned topology; can be removed later once Tier-2 has been observed working. |
| `qwen2.5-coder:32b-instruct-q6_K` | 26 GB | Base of `qwen-coder-32k` | Q6_K quant of Qwen2.5-Coder-32B. Source of the `-32k` derivative; not directly referenced by config. |

The derivative tags (`bge-m3-8k`, `qwen-coder-32k`, `gemma4-e4b-128k`) exist
because the operator wanted the larger context windows baked into the model
identity rather than passed as a per-call option. **The embedding model
commitment is sticky** — switching it later requires reindexing QMD and
Honcho's vector store, so don't churn on it casually.

### Cold-start behavior

A `/v1/chat/completions` request to `qwen-coder-32k` will time out at
~12 s if the model isn't already loaded — the 26 GB load + first token
takes longer. Either pre-warm with a `POST /api/generate` ahead of
expected use, or budget timeouts at ≥60 s for the first call after
keep-alive expires. Once the deriver is repointed to `gemma4-e4b-128k`
(planned), this stops being an issue for the deriver's hot path —
~3 GB cold-loads in ~1 s on this box. `bge-m3-8k` is small enough to
stay warm indefinitely under `KEEP_ALIVE=24h`. With `MAX_LOADED_MODELS=2`,
plan for embeddings + Tier-2 hot at the same time; the resilience-only
`qwen-coder-32k` will cold-load on the rare occasion it's actually called.

### Other relevant software

- **Docker Engine 29.4.1** + `docker compose` plugin — runs the
  OpenClaw + dev compose stacks.
- **Tailscale** — joined to the tailnet, machine name `host-machine`.

### Deploy target layout

`scripts/deploy.sh` rsyncs to `/srv/aca/` on this host. See
`ecosystem.md` for the full deploy flow.

## graphics-machine

Intermittent dual-boot box (Ubuntu for inference, Windows for gaming).
Serves the **local resilience fallback brain** via Ollama when booted
into Ubuntu. Powered down or in Windows/gaming mode otherwise.

**Last verified:** 2026-04-26 against the prior Windows-only configuration.
The box is currently **offline for the household move** (2026-04-30) and
is being moved off Windows-only onto a dual-boot Ubuntu setup. All
sections below describe the post-move target state.

### Hardware (post-move target)

| | |
|---|---|
| Tailscale name | `graphics-machine` |
| OS layout | **Dual-boot fall-through.** Ubuntu 24.04 LTS lives on an external **OWC Envoy Pro FX 2TB** Thunderbolt 3 / USB 3.2 Gen 2 SSD (~2800 MB/s over TB3, ~1000 MB/s over USB 3.2 fallback). Internal disk preserves the existing Windows install untouched. BIOS boot order: external first, internal Windows second. **Plug the drive in → Ubuntu boots; unplug → Windows boots for gaming.** |
| CPU | Intel i9 (exact model not yet re-recorded; refresh on first reboot) |
| RAM | 96 GiB |
| GPU | NVIDIA RTX 2080 Ti (11 GB VRAM, Turing) |
| Disk | 2 internal HDDs (Windows) + 1 external NVMe SSD (Ubuntu boot, OWC Envoy Pro FX 2TB) |

### NVIDIA stack (Ubuntu side)

| | |
|---|---|
| Driver | `nvidia-driver-535` (or current LTS-supported branch) — known-good for Turing on Ubuntu 24.04 |
| CUDA | 12.x |
| Verify | `nvidia-smi` should report the 2080 Ti |

### Ollama (Ubuntu side, post-move)

| | |
|---|---|
| Source | Official Linux install script (`curl -fsSL https://ollama.com/install.sh \| sh`) |
| systemd unit | `/etc/systemd/system/ollama.service` (drop-in for `OLLAMA_HOST`) |
| `OLLAMA_HOST` | `0.0.0.0:11434` (must be set explicitly — default is `127.0.0.1`) |
| `OLLAMA_KEEP_ALIVE` | `24h` |
| `OLLAMA_NUM_PARALLEL` | `1` |
| `OLLAMA_MAX_LOADED_MODELS` | `1` |
| Tailscale ACL | Allow `host-machine` and the user's laptop on port 11434 |

### Installed models (post-move target)

| Tag | Size | Role | Notes |
|---|---|---|---|
| `qwen-coder-next-256k` | ~48 GB | **Local resilience fallback brain** (no longer primary) | Modelfile derivative of `frob/qwen3-coder-next:80b-a3b-q4_K_M` (Qwen3-Next 80B MoE / 3B active per token, Q4_K_M) with `num_ctx 262144`. ~3.85 tok/s output measured over the tailnet from the laptop, pre-move. The primary brain is now `openai-codex/gpt-5.5` via OAuth — this model is the fallback when the Codex path is unreachable. **The repo's openclaw.json lists this as the single fallback for all four core agents.** Re-pull on first boot: `ollama pull frob/qwen3-coder-next:80b-a3b-q4_K_M` then `ollama cp` to the `qwen-coder-next-256k` alias (~50 GB pull). |

### Operator policy

Gaming and inference are mutually exclusive by hardware: the box can boot
either Ubuntu (external SSD plugged in) or Windows (external SSD unplugged).
Plan for the brain endpoint being unreachable whenever the operator is
gaming. The architecture compensates via:

- **Primary brain stays up regardless** — `openai-codex/gpt-5.5` is in OpenAI's cloud, not on this box.
- **Local fallback is best-effort** — when graphics-machine is in Windows mode and Codex is also unreachable, agents hard-fail-with-retry. Both being down at once is a rare double-fault.

### Refreshing this doc

When graphics-machine is back online post-move, run an SSH inventory pass
and update this section. At minimum: confirmed Ubuntu version, exact CPU
model, NVIDIA driver version, Ollama version, exact installed model tag +
size. Then change "Last verified" up top.

## Tailnet roster (snapshot 2026-04-26)

| Tailscale name | Tailscale IP | Role | Notes |
|---|---|---|---|
| `host-machine` | `100.71.239.27` | Documented above | — |
| `graphics-machine` | (offline at snapshot) | Documented above | Not in `tailscale status` output when this snapshot was taken |
| `dev-env` | `100.76.161.91` | **Unclassified** | Linux node tagged to the operator. Role not yet documented; flag if encountered |
| `github-runnervmeorf*` | various | Ephemeral CI runners | Auto-joined and torn down by `.github/workflows/deploy-dev.yml`. Tag: `tag:ci` |
