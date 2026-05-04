# Agent playbooks

Detailed workflows for `dev-main` / `devops` / `worker` / `tester`. The
short rules + tool scopes live in each agent's
`projects/openclaw/app/workspaces/<vertical>/<agent>/AGENTS.md`. When an
agent hits a situation that isn't covered there, it should search this
file (`Bash: qmd search "<keyword>"` works) for the matching playbook.

Note on naming: prose uses each agent's friendly **Name** ("Orchestrator,"
"Devops") which matches what users see in chat. Technical IDs (`dev-main`,
`devops`, etc.) appear in code, configs, and search hints.

Search hints by agent:

- `dev-main` → "Orchestrator playbook"
- `devops` → "Devops playbook"
- `tester` → "Tester playbook"

---

## Orchestrator playbook

### Branching model

- `dev` is the daily-driver. Doc and config changes commit directly to `dev` as part of conversations with the user.
- Feature work happens on `feat/X` branches inside sandboxes managed by devops. The orchestrator does not edit those branches.
- `main` is promoted from `dev` only when the user explicitly asks.

### When the user asks for a feature

1. Read relevant existing `.docs/` to understand context. `Bash: qmd search "<query>"` for hybrid keyword+semantic search; `honcho_ask` / `honcho_search_conclusions` for prior conversation context.
2. **Confirm the feature's `.docs/` path before writing anything.** Feature docs live INSIDE the feature directory, not at repo root.
   - Frontend: `projects/application/frontend/app/src/app/features/{X}/.docs/`
   - Backend: `projects/application/backend/app/src/features/{X}/.docs/`
   - **Never** `.docs/features/{X}/` at repo root. Repo root `.docs/` is for standards and overview only.
3. Draft `spec.md`, `flows.md`, optionally `contracts.md` and `test-plan.md` per the DDD convention (`.docs/standards/docs-driven-development.md`).
4. Confirm the spec with the user before delegating.
5. Delegate to devops: "Create a sandbox for feature {X} from a new `feat/{X}` branch off `dev`."
6. Delegate to worker: "Implement feature {X} in the `feat/{X}` worktree. Test in sandbox {sandbox_id} per `test-plan.md`."
7. Worker coordinates with tester for verification. When the PR opens, report the URL.

Favor SMALL, VERTICAL slices. A 150-line PR reviewed in 10 minutes is worth more than a 2000-line one that sits a week.

### Self-check before every `.docs/` write

- Feature in a specific project? → docs go **inside the feature directory**.
- Repo-wide standard / convention / overview? → only then, root `.docs/`.
- Never create `.docs/features/{name}/` at repo root.

### Doc review mode

When the user asks for a doc review:

1. Identify the scope they want reviewed.
2. Read every file in that `.docs/` subtree.
3. Walk the corresponding code. Look for: endpoints/signatures that don't exist or changed shape; undocumented behavior introduced since the doc was written; spec vs. implementation drift; outdated paths/env vars/command names.
4. Propose each change as a diff. Apply only after the user approves.
5. Commit and push to `dev` in one step.

### Escalations

- If a sub-agent asks you to revise `spec.md`: treat as a real spec change. Discuss with the user before approving.
- If a sub-agent reports being blocked: gather context and return to the user with a clear summary and proposed next steps.

---

## Devops playbook

### "Create a sandbox for feature X"

1. `git -C /srv/aca/repo fetch origin dev` (use `/srv/aca` paths — see the /srv/aca rule in your AGENTS.md).
2. Create a worktree at `/workspace/worktrees/feat-{X}` on a new branch `feat/{X}` from `origin/dev`.
3. `task env:create -- feat-{X}` (resolves through `/srv/aca/...`).
4. Wait for health: `task env:health -- feat-{X}`.
5. Report back to orchestrator: `{ branch: "feat/{X}", worktree: "/workspace/worktrees/feat-{X}", sandbox: "env-feat-{X}", urls: { frontend: "http://host-machine:{port}", ... } }`. Translate any `localhost`/`host.docker.internal` URLs to `host-machine` before reporting up.

### "Destroy the sandbox for feature X"

1. Confirm with orchestrator that work is done or abandoned.
2. `task env:destroy -- feat-{X}`.
3. `git worktree remove /workspace/worktrees/feat-{X}`.
4. Push the branch if it has unpushed commits, OR delete it if abandoned.
5. Report: `{ sandbox: "destroyed", branch: "{deleted|retained}", worktree: "removed" }`.

### "What's running?" / "Tail logs" / "Clean up"

- `task env:list` — active sandboxes with age, branch, status.
- `task env:logs -- {id}` — stream logs from one sandbox.
- `task env:cleanup-stale -- 24` — sweep sandboxes older than 24h.
- For one service: `docker compose -p env-{id} logs {service}` or `docker logs env-{id}-{service}-1`.

### Dev stack lifecycle

If orchestrator reports the dev stack appears down or unhealthy:

1. `cd /srv/aca/infrastructure/compose/dev` (NOT `/workspace/repo/...` — see the /srv/aca rule).
2. `docker compose ps` to confirm the state.
3. If stopped or unhealthy: `docker compose down && docker compose up -d`.
4. Verify: `curl -sf http://localhost:3000/health` (from inside the gateway). Report `http://host-machine:3000` etc. up to orchestrator.

### GitHub Actions failures

You're the primary operator. If a workflow fails: `gh run view --log`, summarize the failure:

- Infra issue → open a fix plan for orchestrator.
- Code issue → file an issue and notify orchestrator so they can route it to worker.

---

## Tester playbook

### Verification flow

When worker says "verify feature {X} in sandbox env-{id}":

1. Read `.docs/features/{X}/test-plan.md` and `spec.md`.
2. Read existing tests to see what coverage exists.
3. Confirm the sandbox is healthy (`task env:status -- {id}`, `task env:health -- {id}`, `curl ... -w "%{http_code}\n" http://host.docker.internal:{FRONTEND_PORT}/`).
4. Write missing tests based on `test-plan.md`. Commit them to `feat/{X}` in `/workspace/worktrees/feat-{X}/`, **not** `/workspace/repo/`.
5. For each test-plan item: drive the browser (or HTTP), assert, capture evidence.
6. Report findings as JSON to worker (see structure below).
7. On worker fix + re-verify: rerun failing tests first, then full suite.

### Findings JSON shape

```json
{
  "status": "pass | fail | partial",
  "sandbox": "env-feat-{X}",
  "covered": N,
  "uncovered": ["test-plan items you couldn't verify — explain why"],
  "passed": [
    {
      "test": "name",
      "spec_ref": "section in spec.md",
      "evidence": "screenshot path, brief DOM/HTTP excerpt"
    }
  ],
  "failed": [
    {
      "test": "name",
      "spec_ref": "section in spec.md",
      "expected": "what the spec says should happen",
      "actual": "what you observed",
      "evidence": "screenshot path, console logs, HTTP body, etc.",
      "hypothesis": "best guess at root cause (optional but helpful)"
    }
  ]
}
```

### Browser tool patterns

| Action | Purpose |
|---|---|
| `navigate` | Go to a URL |
| `snapshot` | AI-friendly tree of interactive elements (returns numeric refs) |
| `screenshot` | Pixel capture as evidence |
| `act` (click/type/hover/select) | Interact with an element by ref |
| `evaluate` | Run JS in page context for assertions |
| `wait` | Wait for URL patterns, load states, selectors, predicates |
| `cookies set/get` | Session management |
| `errors` | Collect JS errors and console messages |

Typical flow: navigate → login (API cookie inject OR form-fill) → navigate to feature URL → snapshot for key elements → evaluate or act for behavioral assertions → screenshot for evidence → errors → attach console errors to report.

### Authentication shortcuts (Keycloak)

Every sandbox Keycloak is provisioned with `testuser / password` via `realm-export.json`. Use these for authenticated tests unless the test itself exercises user management. Use `admin / admin` for admin-scoped tests.

**API login (fast):**

```bash
curl -c /tmp/cookies.txt -H "Content-Type: application/json" \
  -X POST "http://host.docker.internal:{BACKEND_PORT}/auth/login" \
  -d '{"username":"testuser","password":"password"}'
```

Then inject cookie via `browser cookies set` or `browser evaluate` with `document.cookie`, navigate to the app.

**Form-fill login (thorough, for tests touching auth UI):**

```
browser navigate http://host.docker.internal:{FRONTEND_PORT}/login
browser snapshot --format ai
browser type <username-ref> "testuser"
browser type <password-ref> "password" --submit
browser wait --url "**/home"
```

Use form-fill when the feature under test includes the login page, logout button, auth guards, or permission routing.

### Test plan maintenance

`test-plan.md` is authored initially by orchestrator but evolves with you. Update it when:

- A test case from the plan turns out to be impossible to write (note why).
- You discover a test case not in the plan that catches real bugs (add it).
- A selector, endpoint, or fixture stabilizes on a specific value (record it).

Update in the same PR that lands the test code.

## Operator playbook: local dev mode

For when the tailnet hosts (`host-machine`, `graphics-machine`) are unavailable or you want a tight iteration loop on a laptop with native Ollama. This is **dev mode**, not a production substitute — the laptop sleeps and goes offline; the always-on tailnet pattern is still the deployment target.

### Prerequisites (one-time)

1. **Install Ollama natively** on the host (NOT in Docker — Docker Desktop has no Metal/GPU access on macOS, so model speed would crater to CPU-only ~1-2 tok/s on the 80B model):

   ```bash
   # macOS:
   brew install ollama
   # or download from ollama.com

   # Linux:
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Pull the models** the agent config references. Same model names as production so the dev openclaw.json (regenerated from prod) doesn't have to know about local-only aliases:

   ```bash
   ollama pull bge-m3
   ollama cp bge-m3 bge-m3-8k:latest
   ollama cp bge-m3-8k openai/text-embedding-3-small:latest
   ollama pull gemma4:e4b
   ollama cp gemma4:e4b gemma4-e4b-128k:latest
   ollama pull frob/qwen3-coder-next:80b-a3b-q4_K_M
   ollama cp frob/qwen3-coder-next:80b-a3b-q4_K_M qwen-coder-next-256k:latest
   ```

   The brain (`openai-codex/gpt-5.5`) reaches OpenAI Codex via OAuth — no local pull needed. The qwen pull is large (~50 GB); kick it off and walk away.

3. **Verify Ollama is ready:**

   ```bash
   task openclaw:ollama:check
   ```

   This pings `http://localhost:11434/api/tags` and confirms each expected model alias is present.

4. **Establish the OpenClaw OAuth profile** for the brain — one-time:

   ```bash
   task openclaw:up:local
   task openclaw:auth:codex:local
   ```

   `auth:codex:local` runs three things: the interactive `openclaw models auth login --provider openai-codex` wizard, a per-agent propagation step that copies `auth-profiles.json` into each of the 9 agent dirs (without it, every agent fails with `No API key found for provider openai-codex`), and a gateway restart to clear cached auth + Honcho `_ensureWorkspace()` rejections.

   When the wizard menu appears, **pick "OpenAI Codex Browser Login"** (the first option, NOT device pairing — device pairing's CLI hides the actual code behind a placeholder string in this build).

   The wizard prints a URL → open it in your laptop browser → sign in with the **Pro 5×** ChatGPT account → the browser will redirect to `http://localhost:1455/auth/callback?code=...` and **the page will fail to load (this is expected — the gateway listener inside the container can't be reached from a remote browser)**. Copy the entire URL from the address bar, paste it at the wizard's *"Paste the authorization code (or full redirect URL):"* prompt, hit Enter. The wizard parses the code, exchanges it for tokens, and the script does the propagation + restart automatically.

   The propagated tokens live at `/workspace/.openclaw/agents/<id>/agent/auth-profiles.json` (workspace named volume) and persist across `down:local` / `up:local` cycles. They DO get wiped by `down:local:clean`. If you only need to redo the propagation (e.g. you onboarded via the Web UI directly), run `task openclaw:auth:propagate:local` — same script, skips the OAuth step.

### About the ChatGPT Pro 5× subscription

What the OAuth path exposes (verified via `openclaw models list` after onboarding):

| Field | Value | Notes |
|---|---|---|
| Models available | `openai-codex/gpt-5.5` | One model only. No mini/lighter variant. |
| Native context | 1,000,000 tokens | Per the catalog. |
| Effective context cap | ~195k tokens | Pro 5× appears to apply a tighter runtime cap than the documented 272k default. |
| Embeddings | Not included | ChatGPT subscriptions don't include embedding API calls — that's an OpenAI Platform billing surface. We use local `bge-m3` for embeddings. |

Implications:
- **You can't route lighter/cheaper calls to a smaller cloud model** under Pro 5× alone. If you want that, you'd need a separate OpenAI API key (the `openai/gpt-5.4-mini` provider path), not a different model on Codex OAuth.
- **All thinking work goes through `openai-codex/gpt-5.5`.** Tier-2 (`gemma4-e4b-128k`, local) handles Honcho's deriver and per-skill classification; the brain does everything else.
- **Quota is the variable to watch.** Pro 5× = 5× the standard Pro plan's GPT-5 usage. If you hit the cap, decisions to make: escalate the subscription, or temporarily route specialists to the local `qwen-coder-next-256k` fallback (which is already wired as the resilience fallback in `openclaw.json`).

### Daily flow

| Action | Task |
|---|---|
| Start the dev stack | `task openclaw:up:local` |
| Tail logs | `task openclaw:logs:local` |
| Pair the WebUI (browse `http://localhost:3001` first) | `task openclaw:pair` |
| Restart gateway after editing persona/skill files | `task openclaw:restart:local` |
| Open a shell in the gateway | `task openclaw:shell:local` |
| Stop the stack (preserves volumes) | `task openclaw:down:local` |
| Stop and wipe agent state + Honcho memory | `task openclaw:down:local:clean` |

Persona files (`projects/openclaw/app/workspaces/<id>/{IDENTITY,SOUL,AGENTS}.md`) and skills (`projects/openclaw/app/skills/`) are **bind-mounted** from the local working tree. Edit them locally, then `task openclaw:restart:local` to pick up the changes — no image rebuild needed.

`openclaw.json` is regenerated on every `up:local` from the prod source (with model endpoints rewritten to `host.docker.internal:11434`). Edit `projects/openclaw/app/openclaw.json` (the prod file), then `task openclaw:down:local && task openclaw:up:local` to regenerate and restart.

### What's different from production

| | Production (tailnet) | Local dev mode |
|---|---|---|
| Gateway networking | `network_mode: host` | bridge + port 3001 published |
| Model endpoints | `graphics-machine:11434`, `host-machine:11434` | both → `host.docker.internal:11434` |
| Source of openclaw.json | git-sync sidecar pulling from `origin/dev` | generated from prod file at `up:local` time |
| Source of persona files / skills | git-sync sidecar | local working tree (bind-mount) |
| git-sync sidecar | running | excluded via compose profile |
| OAuth + memory volumes | persistent on host-machine | persistent in Docker Desktop's named volumes |

### When to leave dev mode

- The tailnet hosts come back online and you've validated the agent hierarchy locally.
- You want to test the actual deploy flow (push to `dev` → CI → host-machine).
- The laptop's resource pressure is hurting your iteration speed (sustained 80B inference + IDE + browser is real).

To switch back to the tailnet target: `task openclaw:down:local` (or `down:local:clean` if you want to start fresh on the tailnet too), then deploy normally via the existing `task openclaw:up` against the tailnet host.
