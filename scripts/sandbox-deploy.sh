#!/usr/bin/env bash
set -euo pipefail

# sandbox-deploy.sh — create or re-deploy an ephemeral compose sandbox.
#
# Usage: scripts/sandbox-deploy.sh <SANDBOX_ID> [WORKTREE] [SERVICES...]
#
# Arg 1: SANDBOX_ID            — required, ^[a-z0-9][a-z0-9-]{0,40}$
# Arg 2: WORKTREE  (optional)  — defaults to the current repo root.
# Arg 3+: SERVICES (optional)  — defaults to "backend frontend keycloak".
#
# Exit codes: 0 ok, 1 build failed, 2 port allocation exhausted,
#             3 compose up failed, 4 health wait timed out.

usage() {
  cat >&2 <<EOF
Usage: $0 <SANDBOX_ID> [WORKTREE] [SERVICES...]

  SANDBOX_ID  lowercase alphanumeric + hyphen, 1-41 chars, must start with
              [a-z0-9]. Matches ^[a-z0-9][a-z0-9-]{0,40}\$.
  WORKTREE    path to build image contexts from. Defaults to the repo root
              (\$(git rev-parse --show-toplevel)) or pwd if not a git repo.
  SERVICES    one or more of {backend, frontend, keycloak}. Defaults to all
              three.
EOF
}

if [ $# -lt 1 ]; then
  usage
  exit 1
fi

SANDBOX_ID="$1"
shift

if ! [[ "$SANDBOX_ID" =~ ^[a-z0-9][a-z0-9-]{0,40}$ ]]; then
  echo "invalid SANDBOX_ID: '$SANDBOX_ID'" >&2
  usage
  exit 1
fi

# Default worktree to repo root (or pwd if not inside a git repo).
if [ $# -ge 1 ] && [ -n "${1:-}" ]; then
  WORKTREE="$1"
  shift
else
  WORKTREE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi

# Remaining args are SERVICES. Default to all three.
if [ $# -ge 1 ]; then
  SERVICES=("$@")
else
  SERVICES=(backend frontend keycloak)
fi

# ---------------------------------------------------------------------------
# Port allocation: deterministic hash + collision-bump.
# ---------------------------------------------------------------------------
hash=$(printf '%s' "$SANDBOX_ID" | cksum | awk '{print $1}')
base=$((20000 + (hash % 1000) * 10))

# Collect ports claimed by OTHER env-* compose projects (not the one we're
# (re)deploying). Works against a running Docker daemon; if docker/jq are
# missing the caller will hit a later step that needs them anyway.
collect_project_ports() {
  local other_projects
  other_projects=$(docker compose ls --all --format json 2>/dev/null \
    | jq -r --arg self "env-${SANDBOX_ID}" \
        '.[] | select(.Name|startswith("env-")) | select(.Name != $self) | .Name' \
    2>/dev/null || true)
  local name port
  for name in $other_projects; do
    for svc in frontend backend keycloak; do
      port=$(docker compose -p "$name" port "$svc" 8080 2>/dev/null | cut -d: -f2)
      if [ -n "${port:-}" ]; then
        echo "$port"
      fi
    done
  done
}

port_in_use() {
  # Returns 0 if port is occupied (by a listener OR another env-* project).
  local p="$1"
  if lsof -iTCP:"$p" -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  fi
  if printf '%s\n' "$project_ports" | grep -qx "$p"; then
    return 0
  fi
  return 1
}

project_ports=$(collect_project_ports || true)

attempts=0
while :; do
  if ! port_in_use "$base" && ! port_in_use "$((base+1))" && ! port_in_use "$((base+2))"; then
    break
  fi
  attempts=$((attempts+1))
  if [ $attempts -ge 1000 ]; then
    echo "port space exhausted" >&2
    exit 2
  fi
  base=$((base + 10))
  if [ $base -gt 29990 ]; then
    base=20000
  fi
done

# ---------------------------------------------------------------------------
# Build images from the worktree for the requested services.
# ---------------------------------------------------------------------------
for svc in "${SERVICES[@]}"; do
  case "$svc" in
    backend)
      echo "Building backend:${SANDBOX_ID} from ${WORKTREE}..."
      docker build \
        -t "backend:${SANDBOX_ID}" \
        -f "${WORKTREE}/projects/application/backend/dockerfiles/prod.Dockerfile" \
        "${WORKTREE}/projects/application/backend" || exit 1
      ;;
    frontend)
      echo "Building frontend:${SANDBOX_ID} from ${WORKTREE}..."
      docker build \
        -t "frontend:${SANDBOX_ID}" \
        -f "${WORKTREE}/projects/application/frontend/dockerfiles/prod.Dockerfile" \
        "${WORKTREE}/projects/application/frontend" || exit 1
      ;;
    keycloak)
      echo "Building keycloak:${SANDBOX_ID} from ${WORKTREE}..."
      docker build \
        -t "keycloak:${SANDBOX_ID}" \
        -f "${WORKTREE}/projects/application/keycloak/dockerfiles/Dockerfile" \
        "${WORKTREE}/projects/application/keycloak" || exit 1
      ;;
    *)
      echo "unknown service '$svc', skipping" >&2
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Compose up.
# ---------------------------------------------------------------------------
SANDBOX_ID="$SANDBOX_ID" \
SANDBOX_BASE_PORT_FRONTEND="$base" \
SANDBOX_BASE_PORT_BACKEND="$((base+1))" \
SANDBOX_BASE_PORT_KEYCLOAK="$((base+2))" \
IMAGE_TAG="$SANDBOX_ID" \
docker compose \
  -p "env-${SANDBOX_ID}" \
  -f infrastructure/compose/sandbox/compose.yml \
  up -d \
  || { echo "compose up failed" >&2; exit 3; }

# ---------------------------------------------------------------------------
# Wait for backend /health.
# ---------------------------------------------------------------------------
healthy=0
for _ in {1..45}; do
  if curl -sf "http://localhost:$((base+1))/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "backend /health did not respond within 90s" >&2
  exit 4
fi

# ---------------------------------------------------------------------------
# Print URLs + JSON summary.
# ---------------------------------------------------------------------------
cat <<EOF
Sandbox env-${SANDBOX_ID} ready.
  frontend: http://localhost:$base
  backend:  http://localhost:$((base+1))
  keycloak: http://localhost:$((base+2))
{"sandbox":"env-${SANDBOX_ID}","worktree":"$WORKTREE","urls":{"frontend":"http://localhost:$base","backend":"http://localhost:$((base+1))","auth":"http://localhost:$((base+2))"}}
EOF
