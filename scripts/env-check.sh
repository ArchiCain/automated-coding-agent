#!/usr/bin/env bash
# Validate that the root .env has every value the GH Actions deploy workflow
# needs, before `task gh:setup` tries to push them.
#
# Exit 0 on success, 1 on any missing/placeholder value. `--quiet`
# suppresses the success line (used by gh-setup.sh as a preflight).

set -uo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
ISSUES=0

# Read a key from a .env file. Strips surrounding quotes. Returns empty
# string if file doesn't exist or key isn't present.
get_env() {
  local file="$1" key="$2"
  [ -f "$file" ] || { printf ''; return; }
  local val
  val=$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2-)
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  printf '%s' "$val"
}

# Does the value look like a placeholder rather than a real secret?
is_placeholder() {
  [[ "$1" =~ REPLACE ]] || [[ "$1" =~ ^/Users/YOU ]] \
    || [[ "$1" =~ ^/home/YOU ]] || [[ "$1" =~ PASTE ]] \
    || [[ "$1" =~ ^YOUR_ ]] || [[ "$1" =~ CHANGEME ]]
}

# Check that key exists, isn't empty, and isn't a placeholder.
check() {
  local key="$1" used_by="$2"
  local val
  val=$(get_env "$ENV_FILE" "$key")
  if [ -z "$val" ] || is_placeholder "$val"; then
    echo "  .env: ${key}"
    echo "      needed for: ${used_by}"
    ISSUES=$((ISSUES+1))
  fi
}

# Check that a file exists and is non-empty. `key` is the .env key whose
# value is the path.
check_file() {
  local key="$1" used_by="$2"
  local path
  path=$(get_env "$ENV_FILE" "$key")
  if [ -z "$path" ]; then
    echo "  .env: ${key} (path not set)"
    echo "      needed for: ${used_by}"
    ISSUES=$((ISSUES+1)); return
  fi
  # Resolve relative paths against REPO_ROOT
  [[ "$path" != /* ]] && path="${REPO_ROOT}/${path}"
  if [ ! -f "$path" ]; then
    echo "  file missing: ${path}"
    echo "      needed for: ${used_by}"
    ISSUES=$((ISSUES+1)); return
  fi
  if [ ! -s "$path" ]; then
    echo "  file empty: ${path}"
    echo "      needed for: ${used_by}"
    ISSUES=$((ISSUES+1))
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo ".env missing at ${ENV_FILE}"
  echo "  cp .env.template .env  and populate"
  exit 1
fi

# --- Tailscale (CI tailnet join) ---
check TS_AUTHKEY                 "CI runner joins the tailnet (tailscale/github-action)"

# --- Deploy target ---
check DEPLOY_HOST                "scripts/deploy.sh ssh target (Tailscale hostname)"

# --- Ollama provider activation ---
# Non-empty placeholder ('ollama-local') is enough for self-hosted Ollama.
# Real endpoints are pinned in projects/openclaw/app/openclaw.json.
check OLLAMA_API_KEY             "openclaw bundled Ollama provider plugin (placeholder ok)"

# --- OpenClaw ---
check OPENCLAW_AUTH_TOKEN        "openclaw browser-to-gateway pairing"

# --- GitHub App (for openclaw git-sync, not for GHCR) ---
check GITHUB_APP_ID              "openclaw git-sync: repo clone/pull auth"
check GITHUB_APP_INSTALLATION_ID "openclaw git-sync: repo clone/pull auth"
check_file GITHUB_APP_PRIVATE_KEY_PATH "openclaw git-sync: repo clone/pull auth (PEM contents pushed as GH secret)"

# DEPLOY_USER and DOCKER_SOCKET_GID are optional — defaults handled by
# scripts/deploy.sh and infrastructure/compose/openclaw/compose.yml.

if [ $ISSUES -eq 0 ]; then
  [ $QUIET -eq 0 ] && echo "✓ all required .env values present"
  exit 0
fi

[ $QUIET -eq 0 ] && { echo ""; echo "${ISSUES} value(s) missing or placeholder. Fix them in .env, then re-run."; }
exit 1
