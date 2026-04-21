#!/usr/bin/env bash
set -e

# =============================================================================
# OpenClaw entrypoint (Phase 1)
#
# OpenClaw authenticates solely via CLAUDE_CODE_OAUTH_TOKEN. The Claude Code
# CLI picks that env var up automatically, so nothing to wire here.
#
# ANTHROPIC_API_KEY must NEVER be used by this container. Defensively unset
# it in case something in the surrounding environment leaks it in.
# =============================================================================

unset ANTHROPIC_API_KEY

if [ -z "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "ERROR: CLAUDE_CODE_OAUTH_TOKEN is not set. OpenClaw cannot authenticate." >&2
  echo "  Generate one with: claude setup-token   (requires Claude Max plan)" >&2
  exit 1
fi

# =============================================================================
# OpenClaw state directory (persisted on PVC across restarts)
#
# The gateway loads its config from $OPENCLAW_STATE_DIR/openclaw.json, NOT
# from the baked-in /app/openclaw.json. Seed the state dir from our baseline
# every boot — `openclaw config set` below will overlay the runtime values.
# =============================================================================

export OPENCLAW_STATE_DIR="/workspace/.openclaw"
mkdir -p "$OPENCLAW_STATE_DIR"
cp /app/openclaw.json "$OPENCLAW_STATE_DIR/openclaw.json"

# =============================================================================
# Gateway auth — token presented by the browser on Connect
# =============================================================================

if [ -n "$OPENCLAW_AUTH_TOKEN" ]; then
  openclaw config set gateway.auth.mode token
  openclaw config set gateway.auth.token "$OPENCLAW_AUTH_TOKEN"
fi

if [ -n "$OPENCLAW_ALLOWED_ORIGINS" ]; then
  ORIGINS_JSON=$(echo "$OPENCLAW_ALLOWED_ORIGINS" | awk -F',' '{for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?",":""); print ""}')
  openclaw config set gateway.controlUi.allowedOrigins "[$ORIGINS_JSON]"
fi

exec "$@"
