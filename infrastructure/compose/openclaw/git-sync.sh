#!/bin/sh
set -eu

# openclaw-git-sync image has git + curl + openssl pre-installed.
# If running on a different image that lacks them, this will fail.

# --- sanity checks ---
if [ -z "${GIT_REPO_URL:-}" ]; then
  echo "[git-sync] GIT_REPO_URL is empty — set GIT_REPO_URL in compose/openclaw/.env." >&2
  while true; do sleep 3600; done
fi
if [ -z "${GITHUB_APP_ID:-}" ] || [ -z "${GITHUB_APP_INSTALLATION_ID:-}" ]; then
  echo "[git-sync] GITHUB_APP_ID or GITHUB_APP_INSTALLATION_ID not set — sidecar cannot authenticate." >&2
  while true; do sleep 3600; done
fi
if [ ! -f "$GITHUB_APP_PRIVATE_KEY_PATH" ]; then
  echo "[git-sync] Private key not found at $GITHUB_APP_PRIVATE_KEY_PATH — check GITHUB_APP_PRIVATE_KEY_HOST_PATH in compose/openclaw/.env." >&2
  while true; do sleep 3600; done
fi

# --- JWT-based installation token minting ---
# RS256 JWT → POST /app/installations/:id/access_tokens → { token, expires_at }
# Tokens last 60 minutes. We refresh at 50 minutes to stay safe.
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

mint_token() {
  NOW=$(date +%s)
  IAT=$((NOW - 60))
  EXP=$((NOW + 540))
  HEADER='{"alg":"RS256","typ":"JWT"}'
  PAYLOAD="{\"iat\":$IAT,\"exp\":$EXP,\"iss\":\"$GITHUB_APP_ID\"}"
  H=$(printf '%s' "$HEADER"  | b64url)
  P=$(printf '%s' "$PAYLOAD" | b64url)
  SIG=$(printf '%s.%s' "$H" "$P" | openssl dgst -sha256 -sign "$GITHUB_APP_PRIVATE_KEY_PATH" -binary | b64url)
  JWT="$H.$P.$SIG"

  RESP=$(curl -sS -X POST \
    -H "Authorization: Bearer $JWT" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/app/installations/$GITHUB_APP_INSTALLATION_ID/access_tokens" 2>/dev/null)

  # Extract "token":"xyz" without requiring jq
  printf '%s' "$RESP" | grep -oE '"token":[[:space:]]*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/'
}

mkdir -p "$HOME"
git config --global --add safe.directory "$GIT_CLONE_DIR"
git config --global user.email "openclaw-sync@local"
git config --global user.name  "openclaw-sync"

TOKEN=""
LAST_TOKEN_TIME=0
REFRESH_INTERVAL=3000   # 50 minutes

refresh_token() {
  NEW=$(mint_token)
  if [ -z "$NEW" ]; then
    echo "[git-sync] Token mint failed — will retry next loop." >&2
    return 1
  fi
  TOKEN="$NEW"
  LAST_TOKEN_TIME=$(date +%s)

  # Publish token to the shared workspace for the gateway
  # container's git credential helper. Atomic write via rename.
  # Sidecar runs as uid 1000 (same as gateway) so no chown needed.
  mkdir -p /workspace/.openclaw
  printf '%s' "$NEW" > /workspace/.openclaw/github-token.tmp
  chmod 600 /workspace/.openclaw/github-token.tmp
  mv /workspace/.openclaw/github-token.tmp /workspace/.openclaw/github-token

  echo "[git-sync] Token refreshed at $(date -u +%FT%TZ) (published to /workspace/.openclaw/github-token)"
  return 0
}

auth_url() {
  # Inject x-access-token:$TOKEN into the HTTPS URL.
  echo "$GIT_REPO_URL" | sed -e "s#^https://#https://x-access-token:${TOKEN}@#"
}

# --- Initial clone if needed ---
if [ ! -d "$GIT_CLONE_DIR/.git" ]; then
  refresh_token || { sleep 30; exit 1; }
  echo "[git-sync] Cloning $GIT_REPO_URL (branch $GIT_BRANCH) → $GIT_CLONE_DIR"
  git clone --branch "$GIT_BRANCH" "$(auth_url)" "$GIT_CLONE_DIR"
  # Store the non-auth URL so the on-disk .git/config never contains the token.
  git -C "$GIT_CLONE_DIR" remote set-url origin "$GIT_REPO_URL"
fi

echo "[git-sync] Starting pull loop: branch=$GIT_BRANCH interval=${GIT_INTERVAL}s"
while true; do
  NOW=$(date +%s)
  if [ -z "$TOKEN" ] || [ $((NOW - LAST_TOKEN_TIME)) -ge $REFRESH_INTERVAL ]; then
    refresh_token || { sleep "$GIT_INTERVAL"; continue; }
  fi

  git -C "$GIT_CLONE_DIR" remote set-url origin "$(auth_url)"
  if ! git -C "$GIT_CLONE_DIR" fetch origin "$GIT_BRANCH" 2>&1; then
    echo "[git-sync] fetch failed" >&2
  fi
  git -C "$GIT_CLONE_DIR" remote set-url origin "$GIT_REPO_URL"

  if ! git -C "$GIT_CLONE_DIR" merge --ff-only "origin/$GIT_BRANCH" 2>&1; then
    echo "[git-sync] ff-only merge failed — local diverged from origin/$GIT_BRANCH. Manual reconciliation needed." >&2
  fi

  sleep "$GIT_INTERVAL"
done
