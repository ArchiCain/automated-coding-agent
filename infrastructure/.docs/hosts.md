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
stack, sandboxes, embeddings, and the fallback coding LLM.

**Verified:** 2026-04-26 via `ssh scain@host-machine`.

### Hardware

| | |
|---|---|
| Model | Apple Mac mini (2018, T2) repurposed |
| `/etc/hostname` | `mac-mini` |
| Tailscale name | `host-machine` (`100.71.239.27`) |
| OS | Ubuntu 24.04.4 LTS (Noble), kernel `6.8.0-101-generic` |
| CPU | Intel Core i7-8700B @ 3.20 GHz — 6 cores / 12 threads, AVX2 |
| RAM | 62 GiB + 8 GiB swap |
| GPU | Intel UHD 630 iGPU only — **no CUDA**, not used for inference |
| Disk | 1.8 TB root (`/dev/mapper/ubuntu--vg-ubuntu--lv`), ~1.7 TB free |

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

### Installed models

| Tag | Size | Role | Notes |
|---|---|---|---|
| `bge-m3-8k:latest` | 1.2 GB | Embeddings — current memory model | Modelfile derivative of `bge-m3` with `num_ctx 8192`. 1024-dim vectors. **The repo's openclaw.json points memory search here.** |
| `bge-m3:latest` | 1.2 GB | Base embedding model | 512 ctx default. Kept around as the source for the `-8k` derivative; not directly referenced by config. |
| `qwen-coder-32k:latest` | 26 GB | Fallback coding LLM | Modelfile derivative of `qwen2.5-coder:32b-instruct-q6_K` with `num_ctx 32768`. CPU-only on this box (~1.24 tok/s measured). Suitable for Honcho's deriver/summary workload and as a fallback brain when graphics-machine is offline. |
| `qwen2.5-coder:32b-instruct-q6_K` | 26 GB | Base of `qwen-coder-32k` | Q6_K quant of Qwen2.5-Coder-32B. Kept around as the source for the `-32k` derivative; not directly referenced by config. |

The two derivative tags (`bge-m3-8k`, `qwen-coder-32k`) exist because
the operator wanted the larger context windows baked into the model
identity rather than passed as a per-call option. **The embedding
model commitment is sticky** — switching it later requires reindexing
QMD and Honcho's vector store, so don't churn on it casually.

### Cold-start behavior

A `/v1/chat/completions` request to `qwen-coder-32k` will time out at
~12 s if the model isn't already loaded — the 26 GB load + first token
takes longer. Either pre-warm with a `POST /api/generate` ahead of
expected use, or budget timeouts at ≥60 s for the first call after
keep-alive expires. `bge-m3-8k` is small enough to stay warm
indefinitely under `KEEP_ALIVE=24h`.

### Other relevant software

- **Docker Engine 29.4.1** + `docker compose` plugin — runs the
  OpenClaw + dev compose stacks.
- **Tailscale** — joined to the tailnet, machine name `host-machine`.

### Deploy target layout

`scripts/deploy.sh` rsyncs to `/srv/aca/` on this host. See
`ecosystem.md` for the full deploy flow.

## graphics-machine

Intermittent Windows + GPU box. Serves the primary coding brain via
Ollama when it's up. Powered down or in gaming mode otherwise.

**Last verified:** 2026-04-26 (per the running notes in
`ideas/openclaw-local-llm-hybrid.md`). Not always reachable from this
laptop, so this section is best-effort and may drift.

### Hardware (per running notes)

| | |
|---|---|
| Tailscale name | `graphics-machine` |
| OS | Windows (Ubuntu dual-boot abandoned 2026-04-26) |
| CPU | Intel i9 (exact model not yet recorded) |
| RAM | 96 GiB |
| GPU | NVIDIA RTX 2080 Ti (11 GB VRAM, Turing) |
| Disk | 2 HDDs |

### Ollama

| | |
|---|---|
| Source | Ollama for Windows (native installer, not WSL) |
| `OLLAMA_HOST` | `0.0.0.0:11434` |
| `OLLAMA_KEEP_ALIVE` | `24h` |
| `OLLAMA_NUM_PARALLEL` | `1` |
| `OLLAMA_MAX_LOADED_MODELS` | `1` |
| Firewall | Port 11434 allowed from the Tailscale CGNAT range only |

### Installed models (per running notes)

| Tag | Size | Role | Notes |
|---|---|---|---|
| `qwen-coder-next-256k` | ~48 GB | **Primary coding brain** | Modelfile derivative of `frob/qwen3-coder-next:80b-a3b-q4_K_M` (Qwen3-Next 80B MoE / 3B active per token, Q4_K_M) with `num_ctx 262144`. ~3.85 tok/s output measured over the tailnet from the laptop. **The repo's openclaw.json points all four agents here.** |

### Operator policy

Gaming and inference are mutually exclusive — the operator quits
Ollama from the system tray when gaming. Plan for the brain endpoint
being unreachable on a regular basis. The architecture compensates
either via the qwen-coder-32k fallback on host-machine or via
hard-fail-with-retry, depending on whether multi-provider failover is
wired in `openclaw.json`.

### Refreshing this doc

When graphics-machine is reachable, an SSH or remote-PowerShell
inventory pass should update this section. See `host-machine` above
for the shape — at minimum: OS build, CPU model, Ollama version,
exact installed model tags + sizes.

## Tailnet roster (snapshot 2026-04-26)

| Tailscale name | Tailscale IP | Role | Notes |
|---|---|---|---|
| `host-machine` | `100.71.239.27` | Documented above | — |
| `graphics-machine` | (offline at snapshot) | Documented above | Not in `tailscale status` output when this snapshot was taken |
| `dev-env` | `100.76.161.91` | **Unclassified** | Linux node tagged to the operator. Role not yet documented; flag if encountered |
| `github-runnervmeorf*` | various | Ephemeral CI runners | Auto-joined and torn down by `.github/workflows/deploy-dev.yml`. Tag: `tag:ci` |
