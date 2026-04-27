# OpenClaw

The agent runtime for this monorepo. Owns `projects/application/` — its agents read the application's `.docs/` specs, write code to match, run tests in sandboxes, and open PRs. Runs as a two-service docker-compose project (gateway + git-sync sidecar) under `infrastructure/compose/openclaw/`.

THE Dev Team (`projects/the-dev-team/`) was the first orchestrator; it's frozen reference material now. See `CLAUDE.md` → Division of labor.

OpenClaw itself is **edited via Claude Code** in the user's laptop CLI — skills, dockerfiles, task wiring all live under `projects/openclaw/`. See `.docs/overview.md` for the full spec.

## Quickstart

Prerequisites: the rest of the compose stack comes up with `task up` from the repo root. OpenClaw shares the same compose runtime.

1. **Set env vars** in the root `.env` (start from `.env.template` at the repo root):
   ```
   OLLAMA_API_KEY=ollama-local       # any non-empty placeholder
   OPENCLAW_AUTH_TOKEN=<any strong random string>
   GITHUB_APP_ID=
   GITHUB_APP_INSTALLATION_ID=
   GITHUB_APP_PRIVATE_KEY_PATH=.github-app-private-key.pem
   ```
   The agent brain (`graphics-machine` Ollama) and embedding model
   (`host-machine` Ollama) endpoints are pinned in
   `app/openclaw.json` — they don't need API keys.

2. **Build and start** from the repo root:
   ```
   task openclaw:build
   task openclaw:up
   ```

3. **Pair your browser** (one-time per browser):
   - Open `http://localhost:3001` (localhost qualifies as a secure context).
   - Enter `OPENCLAW_AUTH_TOKEN` as the Gateway Token.
   - Click Connect → you'll see "pairing required".
   - From a terminal: `task openclaw:pair` — approves the pending device.
   - Re-click Connect in the browser.

4. **Talk to it.** `http://localhost:3001`.

## Useful tasks

| Task | Purpose |
|------|---------|
| `task openclaw:ps`       | Show service state |
| `task openclaw:logs`     | Tail gateway + git-sync logs |
| `task openclaw:shell`    | Bash into the gateway container |
| `task openclaw:restart`  | Restart the gateway (git-sync stays up) |
| `task openclaw:pair`     | Approve a pending browser device |
| `task openclaw:health`   | Curl `/health` on the gateway |
| `task openclaw:down`     | Stop everything, preserve the workspace volume |
| `task openclaw:down:clean` | Stop and wipe the workspace volume (forces fresh clone) |

## Tailnet host deploy

On `host-machine`, the same compose project runs from images on GHCR — pushed and deployed automatically by `.github/workflows/deploy-dev.yml` on every push to `dev`. Browser access from any tailnet member at `http://host-machine:3001`.
