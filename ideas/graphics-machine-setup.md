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

- `qwen-coder-72b-32k` — a derivative of `qwen2.5-coder:72b-instruct-q8_0`
  with 32K context baked in via Modelfile.

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

The chosen model and quant:

- **Model:** `qwen2.5-coder:72b-instruct-q8_0`
- **Size on disk:** ~76 GB
- **Why this model:** Qwen2.5-Coder-72B is the open-source accuracy
  ceiling for code that fits in this machine's 96 GB of RAM. Larger
  models (DeepSeek-Coder-V2 236B MoE, DeepSeek-V3 671B,
  Qwen3-Coder-480B) do not fit at any reasonable quant.
- **Why Q8_0** instead of the more popular Q4_K_M: Q8_0 is
  indistinguishable from full FP16 in coding evals. The original plan
  for this machine called for Q4_K_M for VRAM headroom; the operator
  has revised that to "absolute most accurate" — Q8 is the answer.
  Trade-off: ~0.5–1 tok/s generation vs Q4's ~2–3 tok/s. Acceptable
  for autonomous overnight coding runs.

Pull it (downloads ~76 GB; this will take a while):
```powershell
ollama pull qwen2.5-coder:72b-instruct-q8_0
```

Verify:
```powershell
ollama list
```
Expected: a row for `qwen2.5-coder:72b-instruct-q8_0` with a SIZE
column near 76 GB.

---

## Step 6 — Create the 32K-context derivative

Ollama's default context window is 2048 tokens — far too small for
real coding work. Bake 32K context into a named derivative model:

1. Create a file `qwen-coder-72b-32k.Modelfile` anywhere convenient
   (Documents is fine). Use Notepad or any text editor. Contents:

   ```
   FROM qwen2.5-coder:72b-instruct-q8_0

   PARAMETER num_ctx 32768

   # Low-temperature for deterministic code-review / sync work.
   PARAMETER temperature 0.1
   PARAMETER top_p 0.9
   ```

2. Create the derivative:
   ```powershell
   cd <directory containing the Modelfile>
   ollama create qwen-coder-72b-32k -f qwen-coder-72b-32k.Modelfile
   ```

3. Verify:
   ```powershell
   ollama list
   ```
   Expected: a new row for `qwen-coder-72b-32k`. It shares weights
   with the base, so the on-disk footprint barely grows.

> **VRAM/RAM headroom note.** At 32K context, the 72B KV cache is
> roughly 10–11 GB at FP16. With ~76 GB for weights and Windows OS
> overhead of 4–6 GB, total memory pressure is ~90–93 GB on a 96 GB
> machine. Tight but workable. If the model fails to load with
> out-of-memory errors, fall back to Q6_K (`qwen2.5-coder:72b-instruct-q6_K`,
> ~58 GB) — quality drop vs Q8 is minor; total memory pressure drops
> to ~75 GB.

---

## Step 7 — Local smoke test

Generate something to confirm everything is wired correctly:

```powershell
ollama run qwen-coder-72b-32k "Write a Python function that returns the nth Fibonacci number iteratively. Return only the function, no commentary."
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
  -d '{"model":"qwen-coder-72b-32k","prompt":"hello","stream":false}'
```

Expected:

- `/api/tags` returns JSON listing both `qwen2.5-coder:72b-instruct-q8_0`
  and `qwen-coder-72b-32k`.
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
- [ ] `ollama list` shows `qwen2.5-coder:72b-instruct-q8_0`
- [ ] `ollama list` shows `qwen-coder-72b-32k`
- [ ] Local `ollama run qwen-coder-72b-32k "…"` produces coherent code
- [ ] From host-machine: `curl http://graphics-machine:11434/api/tags` returns JSON listing both models
- [ ] From host-machine: a generate call against `qwen-coder-72b-32k` returns a non-empty `response` field

## Hand-back

When complete, report to the operator:

1. The exact tailnet hostname (`graphics-machine`, confirmed in
   Tailscale admin).
2. The two model names available on the endpoint
   (`qwen2.5-coder:72b-instruct-q8_0`, `qwen-coder-72b-32k`).
3. Any deviations from this guide (e.g., fallback to Q6_K, different
   firewall scope). The operator will use these to update OpenClaw's
   provider config on host-machine.
