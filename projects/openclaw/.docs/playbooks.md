# Agent playbooks

Detailed workflows for orchestrator / devops / worker / tester. The
short rules + tool scopes live in each agent's
`projects/openclaw/app/workspaces/<agent>/AGENTS.md`. When an agent
hits a situation that isn't covered there, it should search this
file (`Bash: qmd search "<keyword>"` works) for the matching playbook.

Search hints by agent:

- orchestrator → "orchestrator playbook"
- devops → "devops playbook"
- tester → "tester playbook"

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
