# OpenClaw

Second autonomous coding agent in this monorepo, deployed alongside THE Dev Team for side-by-side comparison. Phase 1 scope: a gateway pod you can talk to via the Web UI. No cron, no skills, no autonomous behavior.

See `.docs/overview.md` for the full spec.

## Quickstart

Prerequisites: the rest of the cluster already comes up with `task up` from the repo root. OpenClaw piggybacks on the same helmfile, registry, and Traefik tunnel.

1. **Set env vars** in the repo-root `.env`:
   ```
   CLAUDE_CODE_OAUTH_TOKEN=<from `claude setup-token`>
   OPENCLAW_AUTH_TOKEN=<any strong random string>
   ```
   Do NOT set `ANTHROPIC_API_KEY` on openclaw's behalf — the container refuses it.

2. **Build and deploy** from the repo root:
   ```
   task build:openclaw
   task deploy:apply
   ```

3. **Install the dev TLS cert** (one-time per machine):
   ```
   task certs:install
   ```
   This runs `mkcert -install`, issues a wildcard cert for `*.${DEV_HOSTNAME}`, and loads it into Traefik as the default TLS store. Every ingress with `tls: true` serves this cert.

4. **Pair your browser** (one-time per browser):
   ```
   task openclaw:k8s:pair
   ```
   Follow the prompts: open `https://openclaw.${DEV_HOSTNAME}`, enter `OPENCLAW_AUTH_TOKEN`, click Connect, come back and press Enter.

5. **Talk to it.** `https://openclaw.${DEV_HOSTNAME}`.

## Useful tasks

| Task | Purpose |
|------|---------|
| `task openclaw:k8s:status`   | Show pod and ingress state |
| `task openclaw:k8s:logs`     | Tail pod logs |
| `task openclaw:k8s:shell`    | Bash into the pod |
| `task openclaw:k8s:restart`  | Rollout restart |
| `task openclaw:k8s:forward`  | Port-forward svc to `localhost:18789` (fallback if TLS setup breaks) |
| `task openclaw:k8s:pair`     | Approve a pending browser device |
| `task openclaw:k8s:health`   | Curl `/health` through the ingress |

## What's NOT in Phase 1

- No cron / hooks / autonomous work loop
- No skills loaded (empty `app/skills/`)
- No GitHub App, no workspace repo clone
- No `ANTHROPIC_API_KEY` anywhere — OAuth token only
- No the-dev-team-in-openclaw port (planned for a later phase)
