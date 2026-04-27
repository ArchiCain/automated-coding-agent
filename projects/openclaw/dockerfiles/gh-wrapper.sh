#!/usr/bin/env bash
# `gh` wrapper that injects the GitHub App installation token from the shared
# workspace volume so devops/worker/orchestrator agents can use the gh CLI
# without ever running `gh auth login`.
#
# The git-sync sidecar mints a fresh installation token every 50 minutes
# (1 hr token lifetime) and atomically writes it to /workspace/.openclaw/github-token
# on the shared volume. We re-read the file on every invocation so token
# rotation is transparent — no gateway restart required when the old token
# expires.
#
# Installed at /usr/local/bin/gh; that directory is earlier in PATH than
# the real gh at /usr/bin/gh, so any `gh ...` call lands here first.
# We explicitly call /usr/bin/gh by absolute path to avoid recursion.

set -uo pipefail

TOKEN_FILE=/workspace/.openclaw/github-token

if [ -f "$TOKEN_FILE" ]; then
  GH_TOKEN=$(cat "$TOKEN_FILE")
  export GH_TOKEN
fi

# If the token file doesn't exist yet (e.g. first boot before git-sync has
# minted one), let real gh fail with its normal "auth required" message
# rather than swallowing the error.
exec /usr/bin/gh "$@"
