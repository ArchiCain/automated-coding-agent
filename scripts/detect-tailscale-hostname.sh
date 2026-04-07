#!/usr/bin/env bash
# Detect this machine's Tailscale hostname.
# Usage: ./scripts/detect-tailscale-hostname.sh
# Output: the short Tailscale hostname, or empty if Tailscale isn't installed.

set -e

if ! command -v tailscale >/dev/null 2>&1; then
  echo ""
  exit 0
fi

# `tailscale status --json` reports this node under the "Self" key. Extract
# the HostName field with a small sed pipeline so we don't require jq.
HOSTNAME=$(tailscale status --json 2>/dev/null \
  | tr -d '\n' \
  | sed -n 's/.*"Self":{[^}]*"HostName":"\([^"]*\)".*/\1/p')

echo "${HOSTNAME:-}"
