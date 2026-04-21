# OpenClaw — Overview

## What This Is

OpenClaw is the second autonomous coding agent running side-by-side with THE Dev Team in this monorepo. It is a long-lived gateway service that spawns Claude Code ACP sessions to work on docs, memories, and apps, and exposes a built-in Web UI so humans can pair with it and chat.

**Comparison purpose:** THE Dev Team is a NestJS orchestrator using the Claude Agent/Claude Code SDKs. OpenClaw is the `ghcr.io/openclaw/openclaw` gateway. Running both in the same cluster lets us compare their orchestration models on identical infrastructure.

## Scope — Phase 1 (current)

Phase 1 is the minimum viable deployment:

- Gateway container deployed to Minikube/K3s alongside THE Dev Team
- Accessible via Traefik ingress at `openclaw.${DEV_HOSTNAME}`
- Authenticated via `CLAUDE_CODE_OAUTH_TOKEN` only — `ANTHROPIC_API_KEY` is never passed in
- Web UI reachable, device pairing works, basic chat works
- Empty `SOUL.md` / `HEARTBEAT.md` placeholders (identity and safety-net content deferred)
- No cron, no hooks, no skills, no workspace repo clone, no GitHub App

Later phases will add skills, autonomous memory-building, doc authoring, and an in-openclaw port of THE Dev Team for side-by-side comparison.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | `ghcr.io/openclaw/openclaw:latest` base image |
| Agent backend | Claude Code CLI via `@openclaw/acpx` plugin |
| Config | `app/openclaw.json` |
| Identity files | `app/SOUL.md`, `app/HEARTBEAT.md` |
| Container | `dockerfiles/prod.Dockerfile` + `entrypoint.sh` |
| Deployment | Helm chart in `chart/`, wired into `infrastructure/k8s/helmfile.yaml.gotmpl` |
| Ingress | Traefik at `openclaw.${DEV_HOSTNAME}` |
| Persistence | `ReadWriteOnce` PVC at `/workspace` |

## Auth Model

Two distinct credentials are involved; keep them separate.

**1. Gateway Web UI auth — `OPENCLAW_AUTH_TOKEN`**
Shared secret the browser presents to the gateway when connecting. Set via `openclaw config set gateway.auth.token` in `entrypoint.sh`. After submitting the token, the browser device must also be approved via `openclaw devices approve <id>` — this is the "pairing" step.

**2. Claude Code auth — `CLAUDE_CODE_OAUTH_TOKEN`**
OAuth token from `claude setup-token` (Claude Max plan). Picked up automatically by the Claude Code CLI inside the container; used by ACP sessions spawned through acpx.

**`ANTHROPIC_API_KEY` must never reach this container.** The entrypoint defensively `unset`s it, and the Helmfile release does not include it in `secretEnv`. Openclaw authenticates solely through the OAuth token.

## Pairing Flow

The Web UI requires a browser **secure context** (HTTPS origin or `localhost`) to do device crypto. We satisfy that by running the openclaw ingress on HTTPS with a mkcert-signed wildcard cert trusted by the local system — so `https://openclaw.${DEV_HOSTNAME}` works directly, no warning, no port-forward.

1. Browser: open `https://openclaw.${DEV_HOSTNAME}/`
2. Enter `OPENCLAW_AUTH_TOKEN` as the Gateway Token, click Connect → "pairing required"
3. Terminal: `task openclaw:k8s:pair` — finds the pending device UUID via `openclaw devices list` and calls `openclaw devices approve <id>` inside the pod
4. Browser re-clicks Connect → authenticated session

The `task openclaw:k8s:forward` task remains as a fallback if TLS setup is broken — it port-forwards the gateway to `localhost:18789`, which is also a secure context.

## TLS Setup

One-time per machine:

```
task certs:install
```

Behind the scenes:
- `mkcert -install` trusts the mkcert root CA in the system keychain (macOS) and Firefox's store
- Generates `.certs/dev-wildcard.{crt,key}` valid for `*.${DEV_HOSTNAME}` and `${DEV_HOSTNAME}`
- Creates a `dev-wildcard-tls` Secret in the `traefik` namespace
- Applies a `TLSStore/default` CRD so Traefik uses that secret as the default cert for any ingress with `tls: true`

The openclaw chart's ingress sets the `websecure` entrypoint and `router.tls=true` annotations but omits `spec.tls` — Traefik falls back to the default TLSStore for the cert. No per-service cert plumbing needed.

Other ingresses (`devteam`, `app`, `api`, `auth`) are still plain HTTP by default. Opt them in by flipping `tls: true` in the helmfile entry for each — the same wildcard cert will cover them.

## Directory Layout

```
projects/openclaw/
├── .docs/overview.md           ← this file
├── README.md                   ← human quickstart
├── Taskfile.yml                ← local / remote / k8s / pairing tasks
├── app/
│   ├── openclaw.json           ← gateway config (cron off, hooks off, acpx)
│   ├── SOUL.md                 ← agent identity (empty in Phase 1)
│   ├── HEARTBEAT.md            ← safety-net monitor (empty in Phase 1)
│   └── skills/                 ← empty — populated in later phases
├── chart/                      ← Helm chart (deployment, service, ingress, PVC, RBAC, SA)
└── dockerfiles/
    ├── prod.Dockerfile         ← minimal: base image + Claude Code CLI + acpx
    └── entrypoint.sh           ← unsets ANTHROPIC_API_KEY, configures gateway auth
```

## Relationship to Other Projects

| Project | Role |
|---------|------|
| `projects/application/` | The benchmark app. Both THE Dev Team and OpenClaw may eventually work on it. |
| `projects/the-dev-team/` | First orchestrator (NestJS + Mastra). Already deployed. |
| `projects/openclaw/` | Second orchestrator (OpenClaw gateway). This project. |

All three deploy from the same `infrastructure/k8s/helmfile.yaml.gotmpl`. OpenClaw lives in its own namespace (`openclaw`) so RBAC and lifecycle stay isolated from THE Dev Team.

## Hostnames

| Surface | Host |
|---------|------|
| OpenClaw Web UI | `openclaw.${DEV_HOSTNAME}` |
| THE Dev Team Chat UI | `devteam.${DEV_HOSTNAME}` |
| Application frontend | `app.${DEV_HOSTNAME}` |

Reached via the existing `task tunnel` flow — no new DNS or port-forward wiring is needed.
