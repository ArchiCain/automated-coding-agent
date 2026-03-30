#!/usr/bin/env bash
set -e

# Load Nix dev shell PATH (captured at build time, avoids needing `nix develop` at runtime)
if [ -f /etc/nix-env ]; then
  source /etc/nix-env
  export PATH="/usr/local/bin:$NIX_PATHS"
fi

# Configure git credentials from GITHUB_TOKEN if provided
if [ -n "$GITHUB_TOKEN" ]; then
  echo "https://x-access-token:${GITHUB_TOKEN}@github.com" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
fi

# Configure git identity (use env vars or defaults)
git config --global user.name "${GIT_USER_NAME:-coding-agent}"
git config --global user.email "${GIT_USER_EMAIL:-coding-agent@localhost}"

exec "$@"
