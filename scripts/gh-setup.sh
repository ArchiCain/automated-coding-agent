#!/usr/bin/env bash
# Read the root .env + the GitHub App PEM, preview (char counts only),
# then push each value to this repo's GitHub Actions secrets + variables.
#
# Values reach `gh` via stdin — they never appear in argv, shell history,
# or `ps`. Non-sensitive values (hostnames, App IDs, gids) go as
# variables so they appear in-the-clear in logs instead of being
# redacted as `***`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

command -v gh >/dev/null || { echo "gh CLI not installed — see https://cli.github.com/"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh CLI not authenticated — run: gh auth login"; exit 1; }

echo "==> Preflight: scripts/env-check.sh --quiet"
bash "${REPO_ROOT}/scripts/env-check.sh" --quiet || {
  echo "Run 'task setup:check' (or 'bash scripts/env-check.sh') to see what's missing." >&2
  exit 1
}
echo "    all required values present"

get_env() {
  local file="$1" key="$2" val
  val=$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2-)
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  printf '%s' "$val"
}

# --- Required values ---
SEC_TS=$(get_env "$ENV_FILE"   TS_AUTHKEY)
SEC_ANTH=$(get_env "$ENV_FILE" ANTHROPIC_API_KEY)
SEC_OAI=$(get_env "$ENV_FILE"  OPENAI_API_KEY)
SEC_OCT=$(get_env "$ENV_FILE"  OPENCLAW_AUTH_TOKEN)

VAR_HOST=$(get_env "$ENV_FILE" DEPLOY_HOST)
VAR_APP=$(get_env "$ENV_FILE"  GITHUB_APP_ID)
VAR_INST=$(get_env "$ENV_FILE" GITHUB_APP_INSTALLATION_ID)

# Resolve the App PEM path (relative paths → repo root).
PEM_PATH=$(get_env "$ENV_FILE" GITHUB_APP_PRIVATE_KEY_PATH)
[[ "$PEM_PATH" != /* ]] && PEM_PATH="${REPO_ROOT}/${PEM_PATH}"
PEM_BYTES=$(wc -c < "$PEM_PATH" | tr -d ' ')

# --- Optional values (push only if non-empty) ---
VAR_USER=$(get_env "$ENV_FILE" DEPLOY_USER)
VAR_GID=$(get_env "$ENV_FILE"  DOCKER_SOCKET_GID)

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

cat <<EOF

GitHub configuration for ${REPO}
============================================================
Secrets (content hidden; only lengths shown):
  TS_AUTHKEY                 ${#SEC_TS} chars
  ANTHROPIC_API_KEY          ${#SEC_ANTH} chars
  OPENAI_API_KEY             ${#SEC_OAI} chars
  OPENCLAW_AUTH_TOKEN        ${#SEC_OCT} chars
  GITHUB_APP_PRIVATE_KEY     ${PEM_BYTES} bytes    (from ${PEM_PATH})

Variables (set in-the-clear; visible in GH UI + Actions logs):
  DEPLOY_HOST                = ${VAR_HOST}
  GITHUB_APP_ID              = ${VAR_APP}
  GITHUB_APP_INSTALLATION_ID = ${VAR_INST}
EOF

if [ -n "$VAR_USER" ]; then
  echo "  DEPLOY_USER                = ${VAR_USER}"
else
  echo "  DEPLOY_USER                = (skipped — defaults to 'ubuntu')"
fi
if [ -n "$VAR_GID" ]; then
  echo "  DOCKER_SOCKET_GID          = ${VAR_GID}"
else
  echo "  DOCKER_SOCKET_GID          = (skipped — defaults to 999)"
fi

cat <<EOF

Repo-level actions permission:
  default_workflow_permissions = write (required for GHCR push)

EOF
read -rp "Proceed? [y/N] " CONF
[[ "$CONF" =~ ^(y|Y|yes)$ ]] || { echo "aborted"; exit 0; }

# --- Push secrets (values piped via stdin; never in argv) ---
echo "==> Pushing secrets"
printf '%s' "$SEC_TS"   | gh secret set TS_AUTHKEY            --repo "$REPO"
printf '%s' "$SEC_ANTH" | gh secret set ANTHROPIC_API_KEY     --repo "$REPO"
printf '%s' "$SEC_OAI"  | gh secret set OPENAI_API_KEY        --repo "$REPO"
printf '%s' "$SEC_OCT"  | gh secret set OPENCLAW_AUTH_TOKEN   --repo "$REPO"
gh secret set GITHUB_APP_PRIVATE_KEY --repo "$REPO" < "$PEM_PATH"

# --- Push variables ---
echo "==> Pushing variables"
gh variable set DEPLOY_HOST                --repo "$REPO" --body "$VAR_HOST"
gh variable set GITHUB_APP_ID              --repo "$REPO" --body "$VAR_APP"
gh variable set GITHUB_APP_INSTALLATION_ID --repo "$REPO" --body "$VAR_INST"
[ -n "$VAR_USER" ] && gh variable set DEPLOY_USER       --repo "$REPO" --body "$VAR_USER"
[ -n "$VAR_GID" ]  && gh variable set DOCKER_SOCKET_GID --repo "$REPO" --body "$VAR_GID"

# --- Workflow permissions at the repo level ---
echo "==> Setting repo-level default workflow permissions to 'write' (GHCR push)"
gh api -X PUT "/repos/${REPO}/actions/permissions/workflow" \
  -F default_workflow_permissions=write \
  -F can_approve_pull_request_reviews=false >/dev/null

echo ""
echo "==> Done. Current state:"
echo ""
echo "Secrets:"
gh secret list   --repo "$REPO"
echo ""
echo "Variables:"
gh variable list --repo "$REPO"
