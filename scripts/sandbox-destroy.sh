#!/usr/bin/env bash
set -euo pipefail

# sandbox-destroy.sh — tear down an ephemeral compose sandbox.
#
# Usage: scripts/sandbox-destroy.sh <SANDBOX_ID>
#
# Removes the compose project (containers + named volume) and best-effort
# removes the three tagged images. Image removal is soft-fail because
# another compose project (unlikely, but possible) may reference the tag.

usage() {
  cat >&2 <<EOF
Usage: $0 <SANDBOX_ID>

  SANDBOX_ID  lowercase alphanumeric + hyphen, 1-41 chars, must start with
              [a-z0-9]. Matches ^[a-z0-9][a-z0-9-]{0,40}\$.
EOF
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

SANDBOX_ID="$1"

if ! [[ "$SANDBOX_ID" =~ ^[a-z0-9][a-z0-9-]{0,40}$ ]]; then
  echo "invalid SANDBOX_ID: '$SANDBOX_ID'" >&2
  usage
  exit 1
fi

docker compose \
  -p "env-${SANDBOX_ID}" \
  -f infrastructure/compose/sandbox/compose.yml \
  down -v

# Soft-fail image removal — the tag may be absent (never built) or shared.
docker image rm -f \
  "backend:${SANDBOX_ID}" \
  "frontend:${SANDBOX_ID}" \
  "keycloak:${SANDBOX_ID}" >/dev/null 2>&1 || true

printf '{"sandbox":"env-%s","status":"destroyed"}\n' "$SANDBOX_ID"
