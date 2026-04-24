#!/usr/bin/env bash
# Deploy the compose stack to a host over Tailscale SSH.
#
# Usage:
#   scripts/deploy.sh --host <tailscale-hostname> [--user <ssh-user>] \
#                     [--image-tag <tag>] [--services <csv>] [--dry-run]
#
# --host        Tailscale hostname of the target host (required)
# --user        SSH user on the target host (default: $DEPLOY_USER or "ubuntu")
# --image-tag   Image tag to pull (default: latest)
# --services    Which compose projects to deploy: dev, openclaw, or dev,openclaw
#               (default: dev,openclaw)
# --dry-run     Print every rsync/ssh command that WOULD run, exit 0
#
# The dev + openclaw .prod.yml overrides point at ghcr.io images,
# so IMAGE_TAG propagates through compose var substitution.

set -euo pipefail

# -----------------------------------------------------------------------------
# Parse args
# -----------------------------------------------------------------------------
HOST=""
USER_NAME="${DEPLOY_USER:-ubuntu}"
IMAGE_TAG="latest"
SERVICES="dev,openclaw"
DRY_RUN=0

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --host)
      HOST="${2:-}"
      shift 2
      ;;
    --user)
      USER_NAME="${2:-}"
      shift 2
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --services)
      SERVICES="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$HOST" ]; then
  echo "ERROR: --host is required" >&2
  usage >&2
  exit 2
fi

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

run() {
  # Pretty-print the command; execute only when not dry-run.
  printf '  $ %s\n' "$*"
  if [ "$DRY_RUN" -eq 0 ]; then
    eval "$@"
  fi
}

# -----------------------------------------------------------------------------
# Sanity: for non-dry-run, ensure the host shows up in `tailscale status`.
# -----------------------------------------------------------------------------
if [ "$DRY_RUN" -eq 0 ]; then
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "ERROR: tailscale CLI not found; install it or run with --dry-run" >&2
    exit 3
  fi
  if ! tailscale status --json 2>/dev/null | grep -q "\"HostName\":\"${HOST}\""; then
    echo "ERROR: host '$HOST' not reachable via Tailscale. Run 'tailscale status' to check." >&2
    exit 4
  fi
fi

# -----------------------------------------------------------------------------
# 1. Ship config to the host.
# -----------------------------------------------------------------------------
echo "==> Syncing compose config to ${HOST}"
run "rsync -a --delete ${REPO_ROOT}/infrastructure/compose/ ${USER_NAME}@${HOST}:/srv/aca/infrastructure/compose/"

# -----------------------------------------------------------------------------
# 2. For each requested compose project: pull + up -d.
# -----------------------------------------------------------------------------
IFS=',' read -r -a PROJECTS <<< "$SERVICES"
for project in "${PROJECTS[@]}"; do
  case "$project" in
    dev|openclaw) ;;
    *)
      echo "ERROR: unknown service '$project' (valid: dev, openclaw)" >&2
      exit 5
      ;;
  esac

  base="/srv/aca/infrastructure/compose/${project}"
  compose_cmd="IMAGE_TAG=${IMAGE_TAG} docker compose -f ${base}/compose.yml -f ${base}/compose.prod.yml"

  echo "==> Pulling ${project} images on ${HOST} (tag=${IMAGE_TAG})"
  run "ssh ${USER_NAME}@${HOST} '${compose_cmd} pull'"

  echo "==> Bringing ${project} up on ${HOST}"
  run "ssh ${USER_NAME}@${HOST} '${compose_cmd} up -d'"
done

if [ "$DRY_RUN" -eq 1 ]; then
  echo "==> Dry run complete. No commands were executed."
else
  echo "==> Deploy complete."
fi
