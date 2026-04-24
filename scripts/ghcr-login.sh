#!/usr/bin/env bash
# Log the current shell into ghcr.io using a GitHub App installation token.
#
# Required env vars (typically sourced from the openclaw compose .env on
# the host):
#   GITHUB_APP_ID                      App's numeric ID
#   GITHUB_APP_INSTALLATION_ID         Installation ID on this repo
#   GITHUB_APP_PRIVATE_KEY_HOST_PATH   Path to the .pem on this host
#
# Mints a ~1h installation token via RS256-signed JWT → installation
# access_tokens endpoint, then `docker login ghcr.io` with it. Caller is
# responsible for `docker logout ghcr.io` when done.
#
# Same minting pattern as infrastructure/compose/openclaw/git-sync.sh —
# inlined here so this script stays dependency-free (no jq, no python).

set -euo pipefail

for v in GITHUB_APP_ID GITHUB_APP_INSTALLATION_ID GITHUB_APP_PRIVATE_KEY_HOST_PATH; do
  if [ -z "${!v:-}" ]; then
    echo "[ghcr-login] $v is not set" >&2
    exit 2
  fi
done

PEM="$GITHUB_APP_PRIVATE_KEY_HOST_PATH"
if [ ! -r "$PEM" ]; then
  echo "[ghcr-login] PEM not readable at $PEM" >&2
  exit 3
fi

b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

NOW=$(date +%s)
IAT=$((NOW - 60))
EXP=$((NOW + 540))
HEADER='{"alg":"RS256","typ":"JWT"}'
PAYLOAD="{\"iat\":$IAT,\"exp\":$EXP,\"iss\":\"$GITHUB_APP_ID\"}"
H=$(printf '%s' "$HEADER"  | b64url)
P=$(printf '%s' "$PAYLOAD" | b64url)
SIG=$(printf '%s.%s' "$H" "$P" | openssl dgst -sha256 -sign "$PEM" -binary | b64url)
JWT="$H.$P.$SIG"

RESP=$(curl -sS -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/app/installations/$GITHUB_APP_INSTALLATION_ID/access_tokens")

TOKEN=$(printf '%s' "$RESP" | grep -oE '"token":[[:space:]]*"[^"]+"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')

if [ -z "$TOKEN" ]; then
  echo "[ghcr-login] Token mint failed. Response was:" >&2
  printf '%s\n' "$RESP" >&2
  exit 4
fi

printf '%s' "$TOKEN" | docker login ghcr.io -u x-access-token --password-stdin
echo "[ghcr-login] docker login ghcr.io OK (token expires ~60m from now)"
