#!/usr/bin/env bash
# openclaw-auth-codex.sh — Streamlined OpenAI Codex OAuth onboarding for the
# OpenClaw gateway, end-to-end.
#
# What it does, in order:
#   1. Validates that the gateway container is up.
#   2. Drops you into an interactive `openclaw models auth login --provider
#      openai-codex` session inside the gateway container. You pick "Browser
#      Login," sign in with ChatGPT in your laptop browser, and paste the
#      callback URL back into the wizard. (URL-paste is the universal flow —
#      the localhost:1455 callback page can't reach the gateway listener
#      from a remote browser, so the wizard expects you to paste the URL.)
#   3. Propagates the resulting auth-profiles.json from the "main" agentDir
#      to every per-agent agentDir under /workspace/.openclaw/agents/<id>/
#      agent/. Required because OpenClaw stores auth per-agent and the
#      onboard wizard only writes to the main dir; without this step every
#      agent fails with "No API key found for provider openai-codex".
#   4. Restarts the gateway. Honcho's plugin memoizes _ensureWorkspace()
#      rejections and only a restart clears them; same logic applies to
#      auth state caches.
#
# Usage:
#   bash scripts/openclaw-auth-codex.sh <mode> [--propagate-only]
#
#   <mode>             prod | dev
#   --propagate-only   Skip the OAuth login. Only useful if you ran
#                      `openclaw models auth login` manually (e.g. via the
#                      Web UI's onboarding flow) and just need the
#                      per-agent propagation + restart.
#
# Prerequisites:
#   - Gateway container is up (`task openclaw:up` for prod, `task
#     openclaw:up:local` for dev).
#   - You have a ChatGPT account on the Pro 5× plan (or the equivalent
#     subscription that exposes Codex/gpt-5.5; Pro Lite alone does not).
#
# Subscription model notes (Pro 5×, May 2026):
#   - Pro 5× OAuth exposes exactly one model: openai-codex/gpt-5.5
#     (1M native context, runtime cap observed at 195k via Pro 5×).
#   - No mini variant. Lighter calls cannot be routed to a smaller cloud
#     model under this subscription. If you want a smaller cloud model,
#     you need a separate OPENAI_API_KEY (the openai/gpt-5.4-mini path).
#   - Embeddings are NOT included in ChatGPT subscriptions — they're API-
#     platform billed separately. We use local bge-m3 for embeddings.
#
# How OAuth tokens flow:
#   The wizard writes auth-profiles.json into the gateway's STATE_DIR
#   ($OPENCLAW_STATE_DIR or ~/.openclaw/), specifically at
#     <state>/agents/main/agent/auth-profiles.json
#   The state dir is the workspace volume in production but defaults to
#   /home/node/.openclaw inside the dev container (writable container
#   layer — non-persistent across recreate). To keep tokens portable, we
#   copy auth-profiles.json to each agent's per-agent dir under
#   /workspace/.openclaw/agents/<id>/agent/auth-profiles.json — and that
#   IS in the workspace volume, so it survives `task openclaw:down*` (but
#   not `down:local:clean`, which wipes volumes).

set -euo pipefail

MODE="${1:-}"
shift || true
PROPAGATE_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --propagate-only) PROPAGATE_ONLY=1 ;;
    *) echo "ERROR: unknown flag '$arg'" >&2; exit 2 ;;
  esac
done

case "$MODE" in
  prod)
    COMPOSE_FILES="-f infrastructure/compose/openclaw/compose.yml"
    ;;
  dev)
    COMPOSE_FILES="-f infrastructure/compose/openclaw/compose.yml -f infrastructure/compose/openclaw/compose.dev.yml"
    ;;
  *)
    echo "ERROR: mode must be 'prod' or 'dev' (got '$MODE')" >&2
    echo "Usage: bash scripts/openclaw-auth-codex.sh <prod|dev> [--propagate-only]" >&2
    exit 2
    ;;
esac

# The 9 agent ids from openclaw.json. If the agent roster changes, update
# this list (it's a one-time copy per run; out-of-date entries are harmless,
# missing ones cause the agent to fail with the auth error).
AGENTS=(dev-main devops worker tester email-main backpacking-main dnd-main dnd-dm dnd-chargen)

# ---------- Preflight: confirm the gateway is running ----------

if ! docker compose $COMPOSE_FILES ps --status running --services 2>/dev/null | grep -q '^gateway$'; then
  echo "ERROR: gateway is not running." >&2
  if [ "$MODE" = "prod" ]; then
    echo "  → Run: task openclaw:up" >&2
  else
    echo "  → Run: task openclaw:up:local" >&2
  fi
  exit 1
fi

# ---------- Step 1: interactive OAuth (skip if --propagate-only) ----------

if [ "$PROPAGATE_ONLY" -eq 0 ]; then
  cat <<'BANNER'

================================================================================
OpenAI Codex OAuth onboarding
================================================================================

About to drop you into an interactive prompt inside the gateway container.

When the menu appears:
  1. Pick "OpenAI Codex Browser Login" (the first option, NOT device pairing).
  2. The wizard prints a URL — open it in your laptop browser.
  3. Sign in with the ChatGPT account that has the Pro 5× subscription.
  4. The browser will redirect to http://localhost:1455/auth/callback?code=...
     This page WILL fail to load — that is expected. The wizard cannot
     listen on your laptop; it just needs the URL.
  5. Click the address bar in the failed-page tab, copy the ENTIRE URL.
  6. Switch back to this terminal. The wizard is waiting at:
        "Paste the authorization code (or full redirect URL):"
  7. Paste the URL and hit Enter. The wizard parses the code, exchanges it
     for tokens, and writes them into the gateway's auth store.

If the wizard hangs or you see "device pairing" instead of browser login,
Ctrl-C and re-run this script — sometimes the menu remembers your last pick.

================================================================================

BANNER

  # `exec -it` requires a TTY. If this is invoked from a CI context without a
  # TTY (rare for an interactive auth flow), the wizard will exit immediately.
  docker compose $COMPOSE_FILES exec gateway openclaw models auth login --provider openai-codex

  echo ""
  echo "OAuth login returned. Propagating auth profile to per-agent dirs..."
  echo ""
fi

# ---------- Step 2: propagate auth-profiles.json to each agent's dir ----------
#
# The wizard writes to <state>/agents/main/agent/auth-profiles.json, where
# <state> is whichever state dir is in effect for the openclaw CLI inside
# the container (typically /home/node/.openclaw unless OPENCLAW_STATE_DIR
# is set). We probe both paths and copy the first one we find to all 9
# per-agent dirs under /workspace/.openclaw/agents/<id>/agent/, which IS
# the persistent workspace volume.

docker compose $COMPOSE_FILES exec -T gateway sh -c '
SRC=""
# Preferred sources — written by the OAuth wizard. /workspace/... persists
# across container recreate (named volume); /home/node/... does not.
for CANDIDATE in /workspace/.openclaw/agents/main/agent/auth-profiles.json \
                 /home/node/.openclaw/agents/main/agent/auth-profiles.json; do
  if [ -f "$CANDIDATE" ]; then
    SRC="$CANDIDATE"
    break
  fi
done

# Fallback: any previously-propagated per-agent file under the workspace
# volume. Useful after agent renames or container recreate cycles where
# the "main" agentDir is gone but per-agent copies survive (they were
# identical when propagated, and refresh tokens regenerate quietly).
if [ -z "$SRC" ]; then
  SRC=$(find /workspace/.openclaw/agents -mindepth 3 -maxdepth 3 \
            -name auth-profiles.json -type f 2>/dev/null | head -1)
fi

if [ -z "$SRC" ]; then
  echo "ERROR: no auth-profiles.json found at any expected location." >&2
  echo "  Did the OAuth login succeed? Re-run without --propagate-only." >&2
  exit 1
fi

echo "Source: $SRC"

for AGENT in '"${AGENTS[*]}"'; do
  DST="/workspace/.openclaw/agents/$AGENT/agent/auth-profiles.json"
  mkdir -p "$(dirname "$DST")"
  cp "$SRC" "$DST"
  chmod 600 "$DST"
  echo "  → $DST"
done
'

# ---------- Step 3: restart the gateway to clear cached auth/Honcho state ----------

echo ""
echo "Restarting gateway to clear memoized auth + Honcho state..."
docker compose $COMPOSE_FILES restart gateway >/dev/null

cat <<'DONE'

================================================================================
Done.
================================================================================

Verify by sending a message to the orchestrator:
  - Web UI:  http://localhost:3001    (dev)
             https://<host>.<tailnet>.ts.net/   (prod via Tailscale Serve)

Or list available models from inside the gateway:
  task openclaw:shell:local      # or `task openclaw:shell` for prod
  openclaw models list

You should see openai-codex/gpt-5.5 with "yes" under Auth and "configured"
under Tags. If you still see "No API key found for provider openai-codex",
re-run this script with --propagate-only — the propagation step is
idempotent.

DONE
