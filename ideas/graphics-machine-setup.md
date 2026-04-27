# graphics-machine setup (Windows host)

Handoff doc for the agent setting up the GPU host of an OpenClaw
multi-machine environment. Wider design context lives in
`ideas/openclaw-local-llm-hybrid.md` of the
`ArchiCain/automated-coding-agent` repo on the operator's Mac mini.

## What this machine does

Hosts the **primary coding LLM** for an autonomous coding agent system
(OpenClaw). The agent runs on a separate always-on Mac mini
(`host-machine`); when this machine is online, OpenClaw routes its
heavy generation work here over the user's Tailscale tailnet. When this
machine is offline, OpenClaw falls back to a smaller CPU-served model
on the Mac mini.

Accuracy is the priority. Speed is not. This machine runs autonomous
overnight coding work; a 0.5–1 tok/s generation rate is acceptable if
it produces better code.

## Naming

| Role | Tailscale hostname |
|---|---|
| This machine (GPU box) | `graphics-machine` |
| Always-on Mac mini | `host-machine` |

The Tailscale admin UI must show this machine as `graphics-machine`
(lowercase, exact). The OpenClaw stack on the Mac mini is configured to
call `http://graphics-machine:11434`.

## Hardware assumptions

| | |
|---|---|
| CPU | Intel i9 (model not material to this guide) |
| RAM | 96 GB |
| GPU | NVIDIA RTX 2080 Ti, 11 GB VRAM (Turing, Flash Attn v1) |
| Storage | 100+ GB free on the drive Ollama uses (default `C:\Users\<you>\.ollama\models`) |
| OS | Windows 11 with admin rights |

If any of these are off (especially the 96 GB RAM number), stop and
escalate — the model choice below assumes them.

## Operating policy the user has accepted

- **Gaming and inference are mutually exclusive.** When the user wants
  to game, they will manually quit Ollama from the system tray; when
  done gaming, they will relaunch it. No automation needed for this.
- **Don't sleep / hibernate.** The machine should remain network-reachable
  on the tailnet whenever it's powered on. Display sleep is fine.
- **Windows Update active hours** should be configured to cover the
  user's working window so forced reboots don't interrupt long runs.

## End state to verify against

A reachable Ollama HTTP endpoint at `http://graphics-machine:11434` on
the user's tailnet, serving:

- `qwen-coder-next-256k` — a derivative of
  `frob/qwen3-coder-next:80b-a3b-q4_K_M` (Qwen3-Next 80B MoE with 3B
  active params per token, Q4_K_M quant) with 256K context baked in
  via Modelfile.

> **Why this model.** Qwen3-Next 80B-A3B is the strongest open-source
> coder that fits on a single non-data-center machine in late April
> 2026. The MoE architecture (3B active per token out of 80B total)
> means generation speed is comparable to a small dense model while
> quality reflects the much larger total parameter count. Q4_K_M was
> chosen over higher quants because the operator's machine has 96 GB
> RAM and Q8 (~80 GB) would leave too little headroom for the 256K KV
> cache + OS overhead. The earlier plan to use Qwen2.5-Coder-72B at
> Q8_0 was abandoned when the agent setting this up couldn't get that
> exact tag from Ollama's library; the Qwen3-Next pivot is an upgrade
> on multiple axes (larger total params, newer architecture, much
> larger context window).

The acceptance checklist at the end of this doc enumerates every probe
that must pass before declaring the setup done.

---

## Step 0 — Pre-checks

Run in PowerShell. Stop and escalate on any failure.

1. **NVIDIA driver / GPU visible**
   ```powershell
   nvidia-smi
   ```
   Expected: output includes `RTX 2080 Ti` and a CUDA driver version
   ≥ 12.0. If `nvidia-smi` is not recognized, install or update the
   NVIDIA Game Ready / Studio driver from <https://nvidia.com/drivers>
   first, then reboot.

2. **System RAM**
   ```powershell
   wmic computersystem get TotalPhysicalMemory
   ```
   Expected: a number ≥ 96000000000 (96 GB). If lower, stop — the
   model below won't fit.

3. **Free disk on the model drive**
   ```powershell
   Get-PSDrive C
   ```
   Expected: `Free` column ≥ 100 GB. The Q8 quant of the chosen model
   is ~76 GB; we want headroom for additional pulls and OS overhead.

---

## Step 1 — Install Tailscale

1. Download the Windows installer from
   <https://tailscale.com/download/windows>.
2. Run the installer; click through accepting defaults.
3. Sign in with the operator's Tailscale account when prompted (the
   browser will open).
4. Open the system tray → right-click the Tailscale icon → "Change
   machine name…" → set to `graphics-machine` (lowercase, exact).
   Save.
5. Verify in PowerShell:
   ```powershell
   tailscale status
   ```
   Expected: this machine listed as `graphics-machine`, and at least
   `host-machine` listed as a peer with an IP. Note the
   `host-machine` IP for later steps.
6. Connectivity check:
   ```powershell
   ping host-machine
   ```
   Expected: replies. If MagicDNS isn't on, ping the IP from step 5
   instead and ask the operator to enable MagicDNS in the Tailscale
   admin → DNS settings.

---

## Step 2 — Install Ollama for Windows

1. Download the installer from <https://ollama.com/download/windows>.
2. Run it. The installer registers Ollama as a background service that
   starts on login and adds a system tray icon.
3. Verify in PowerShell:
   ```powershell
   ollama --version
   ```
   Expected: a version string (any version ≥ 0.5).
4. Confirm Ollama is running:
   ```powershell
   curl http://localhost:11434/api/tags
   ```
   Expected: JSON `{"models":[]}`. If `curl` errors with connection
   refused, open the Start menu and launch "Ollama" once to start the
   tray app.

---

## Step 3 — Configure Ollama env vars

Ollama on Windows reads its config from User-level environment
variables. Set these so they persist across reboots and so the tray
service picks them up.

In PowerShell (as the user who runs Ollama — not as Administrator):

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_HOST",              "0.0.0.0:11434", "User")
[Environment]::SetEnvironmentVariable("OLLAMA_KEEP_ALIVE",        "24h",           "User")
[Environment]::SetEnvironmentVariable("OLLAMA_NUM_PARALLEL",      "1",             "User")
[Environment]::SetEnvironmentVariable("OLLAMA_MAX_LOADED_MODELS", "1",             "User")
```

Rationale:

- `OLLAMA_HOST=0.0.0.0:11434` — listen on all interfaces (not just
  `localhost`). Required for the tailnet to reach it.
- `OLLAMA_KEEP_ALIVE=24h` — keep the model resident in RAM between
  calls. Loading the 72B model from disk into RAM takes 1–2 minutes;
  we don't want that to happen on every request.
- `OLLAMA_NUM_PARALLEL=1` — single-stream generation. A 72B partial-offload
  can't multiplex; trying to causes both requests to fail or thrash.
- `OLLAMA_MAX_LOADED_MODELS=1` — never try to keep two large models
  loaded at the same time.

**Restart Ollama** to pick up the new env vars: right-click tray icon →
Quit → relaunch from Start menu (or sign out and back in).

Verify:
```powershell
[Environment]::GetEnvironmentVariable("OLLAMA_HOST",       "User")
[Environment]::GetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "User")
```
Expected: `0.0.0.0:11434` and `24h`.

---

## Step 4 — Open the firewall (tailnet only)

Pre-allow port 11434 inbound from the Tailscale CGNAT range, so peers
on the tailnet can reach Ollama but the wider local LAN cannot.

PowerShell **as Administrator**:

```powershell
New-NetFirewallRule -DisplayName "Ollama (tailnet)" -Direction Inbound `
  -Protocol TCP -LocalPort 11434 -RemoteAddress 100.64.0.0/10 -Action Allow
```

`100.64.0.0/10` is the Tailscale CGNAT block — every tailnet peer has
an IP inside it. Connections from outside that range (regular LAN,
internet) are not matched by this rule and remain blocked by default.

Verify:
```powershell
Get-NetFirewallRule -DisplayName "Ollama (tailnet)" |
  Format-List DisplayName, Direction, Action, Enabled
```
Expected: `Direction = Inbound`, `Action = Allow`, `Enabled = True`.

---

## Step 5 — Pull the model

The chosen model:

- **Model:** `frob/qwen3-coder-next:80b-a3b-q4_K_M`
- **Architecture:** Qwen3-Next, MoE with 80B total params and 3B active
  per token. Hybrid attention (linear + standard).
- **Quant:** Q4_K_M
- **Size on disk:** ~48 GB
- **Why this model:** Qwen3-Next 80B-A3B is the strongest
  fits-on-this-hardware coder available. The MoE 3B-active design
  means inference compute is closer to a small dense model than to
  the 80B total parameter count would suggest. Larger models
  (DeepSeek-V3, Qwen3-Coder-480B) don't fit at any reasonable quant
  on 96 GB RAM.
- **Why Q4_K_M:** at higher quants (Q6 ~60 GB, Q8 ~80 GB) the working
  set + 256K KV cache + Windows overhead becomes too tight on a 96 GB
  box. Q4_K_M leaves comfortable headroom and the quality difference
  vs Q8 is small for MoE models of this size.

Pull it (downloads ~48 GB; this will take a while):
```powershell
ollama pull frob/qwen3-coder-next:80b-a3b-q4_K_M
```

Verify:
```powershell
ollama list
```
Expected: a row for `frob/qwen3-coder-next:80b-a3b-q4_K_M` with a SIZE
column near 48 GB.

---

## Step 6 — Create the 256K-context derivative

Ollama's default context window is 2048 tokens — far too small for
real coding work. Bake 256K context into a named derivative model so
OpenClaw can ask for the full window without per-call configuration:

1. Create a file `qwen-coder-next-256k.Modelfile` anywhere convenient
   (Documents is fine). Use Notepad or any text editor. Contents:

   ```
   FROM frob/qwen3-coder-next:80b-a3b-q4_K_M

   PARAMETER num_ctx 262144

   # Low-temperature for deterministic code-review / sync work.
   PARAMETER temperature 0.1
   PARAMETER top_p 0.9
   ```

2. Create the derivative:
   ```powershell
   cd <directory containing the Modelfile>
   ollama create qwen-coder-next-256k -f qwen-coder-next-256k.Modelfile
   ```

3. Verify:
   ```powershell
   ollama list
   ```
   Expected: a new row for `qwen-coder-next-256k`. It shares weights
   with the base, so the on-disk footprint barely grows (both rows
   show ~48 GB).

> **Memory headroom note.** Qwen3-Next is a hybrid-attention model, so
> KV cache scaling at long context is more efficient than for a vanilla
> transformer. 256K context is workable on this machine alongside the
> 48 GB weights; if it fails to load with out-of-memory errors, drop
> `num_ctx` to 131072 (128K) or 65536 (64K) and re-create the
> derivative. Most coding tasks don't need 256K — 64K is plenty for
> almost everything; the bigger window is for whole-codebase summary /
> review work.

---

## Step 7 — Local smoke test

Generate something to confirm everything is wired correctly:

```powershell
ollama run qwen-coder-next-256k "Write a Python function that returns the nth Fibonacci number iteratively. Return only the function, no commentary."
```

What to expect:

- **First call**: 1–2 minute pause while the model loads from disk
  into RAM. Then output begins streaming slowly (~0.5–1 tok/s).
- **Output**: a syntactically valid Python `def fib(n): …` with an
  iterative loop.
- **Resource check while it runs**: open Task Manager → Performance →
  GPU. VRAM should be near 11 GB used (model partial-offload + KV
  cache). CPU should be substantially busy. RAM should show ~80+ GB
  in use.

If the model never loads (errors about RAM / VRAM), see the headroom
note in step 6 about falling back to Q6_K.

---

## Step 8 — Remote smoke test from the tailnet

Ask the operator to run, **on host-machine** (the Mac mini):

```bash
# 1. Endpoint reachable?
curl -sS http://graphics-machine:11434/api/tags

# 2. Generation works?
curl -sS http://graphics-machine:11434/api/generate \
  -d '{"model":"qwen-coder-next-256k","prompt":"hello","stream":false}'
```

Expected:

- `/api/tags` returns JSON listing both `frob/qwen3-coder-next:80b-a3b-q4_K_M`
  and `qwen-coder-next-256k`.
- `/api/generate` returns JSON with a `response` field containing a
  generation. (May take a while for the first call after a cold
  start.)

If both pass, this machine is ready and OpenClaw on host-machine can
be configured to use it as the primary coding LLM.

---

## Acceptance checklist

Mark each as the agent verifies it. **Do not declare done until every
box is checked.**

- [ ] `nvidia-smi` reports the RTX 2080 Ti with a current CUDA driver
- [ ] `tailscale status` on this machine sees `host-machine`
- [ ] `tailscale status` on `host-machine` sees `graphics-machine`
- [ ] `ping host-machine` from this machine succeeds
- [ ] `ollama --version` returns a version ≥ 0.5
- [ ] `[Environment]::GetEnvironmentVariable("OLLAMA_HOST", "User")` returns `0.0.0.0:11434`
- [ ] `[Environment]::GetEnvironmentVariable("OLLAMA_KEEP_ALIVE", "User")` returns `24h`
- [ ] `Get-NetFirewallRule -DisplayName "Ollama (tailnet)"` exists, Enabled, Allow, port 11434, RemoteAddress 100.64.0.0/10
- [ ] `ollama list` shows `frob/qwen3-coder-next:80b-a3b-q4_K_M`
- [ ] `ollama list` shows `qwen-coder-next-256k`
- [ ] Local `ollama run qwen-coder-next-256k "…"` produces coherent code
- [ ] From host-machine: `curl http://graphics-machine:11434/api/tags` returns JSON listing both models
- [ ] From host-machine: a generate call against `qwen-coder-next-256k` returns a non-empty `response` field

## Hand-back

When complete, report to the operator:

1. The exact tailnet hostname (`graphics-machine`, confirmed in
   Tailscale admin).
2. The two model names available on the endpoint
   (`frob/qwen3-coder-next:80b-a3b-q4_K_M`, `qwen-coder-next-256k`).
3. Any deviations from this guide (e.g., fallback to Q6_K, different
   firewall scope). The operator will use these to update OpenClaw's
   provider config on host-machine.
