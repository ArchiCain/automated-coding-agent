#!/bin/sh
# git-credential-helper.sh
#
# Git credential helper that reads the GitHub App installation token written
# by the OpenClaw git-sync sidecar at /workspace/.openclaw/github-token.
#
# Usage: wired up via `git config credential.https://github.com.helper`.
# Git invokes this script with an operation arg (get|store|erase) and sends
# a protocol/host blob on stdin; it expects username/password on stdout for
# "get" and nothing for the other ops.
#
# The sidecar refreshes the token every ~50 minutes. The token is short-lived
# (60 min lifetime from GitHub) so compromise blast radius is bounded.

TOKEN_FILE="${OPENCLAW_GITHUB_TOKEN_FILE:-/workspace/.openclaw/github-token}"

case "$1" in
  get)
    # Drain stdin (git sends protocol=... host=... lines).
    while IFS= read -r line && [ -n "$line" ]; do :; done

    if [ ! -f "$TOKEN_FILE" ]; then
      # Silent miss — let git fall through to other helpers or prompt.
      exit 0
    fi

    TOKEN=$(cat "$TOKEN_FILE" 2>/dev/null)
    if [ -n "$TOKEN" ]; then
      echo "username=x-access-token"
      echo "password=$TOKEN"
    fi
    ;;
  store|erase)
    # No-op. The sidecar owns the token lifecycle.
    ;;
esac
