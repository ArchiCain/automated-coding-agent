# OpenClaw

The agent runtime for this monorepo. Owns `projects/application/` — its agents read the application's `.docs/` specs, write code to match, run tests in sandboxes, and open PRs. Runs as a two-service docker-compose project (gateway + git-sync sidecar) under `infrastructure/compose/openclaw/`.

THE Dev Team (`projects/the-dev-team/`) was the first orchestrator; it's frozen reference material now. See `CLAUDE.md` → Division of labor.

OpenClaw itself is **edited via Claude Code** in the user's laptop CLI — skills, dockerfiles, task wiring all live under `projects/openclaw/`. See `.docs/overview.md` for the full spec.

## Quickstart

Prerequisites: the rest of the compose stack comes up with `task up` from the repo root. OpenClaw shares the same compose runtime.

1. **Set env vars** in `infrastructure/compose/openclaw/.env` (start from the template):
   ```
   ANTHROPIC_API_KEY=<your API key>
   OPENAI_API_KEY=<your API key>
   OPENCLAW_AUTH_TOKEN=<any strong random string>
   GITHUB_APP_ID=
   GITHUB_APP_INSTALLATION_ID=
   # Place your GitHub App private key at the path referenced by the compose file.
   ```

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

## EC2 deploy

On EC2, the same compose project runs with `infrastructure/compose/openclaw/compose.prod.yml` overlaid — image refs flip to GHCR and Caddy terminates TLS at `https://openclaw.{DOMAIN}`.
