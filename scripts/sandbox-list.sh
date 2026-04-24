#!/usr/bin/env bash
set -euo pipefail

# sandbox-list.sh — enumerate every env-* compose project.
#
# Usage: scripts/sandbox-list.sh
#
# Prints a padded table (name, status, age, frontend URL) and — at the end,
# for scripting — the raw JSON array of project entries from docker.

projects=$(docker compose ls --all --format json \
  | jq -c '[.[] | select(.Name|startswith("env-"))]')

if [ "$projects" = "[]" ] || [ -z "$projects" ]; then
  echo "(no sandboxes)"
  exit 0
fi

printf '%-30s  %-12s  %-28s  %s\n' "NAME" "STATUS" "AGE" "FRONTEND"

echo "$projects" | jq -r '.[] | "\(.Name)\t\(.Status)"' | while IFS=$'\t' read -r name status; do
  age=$(docker ps -a \
    --filter "label=com.docker.compose.project=$name" \
    --format '{{.CreatedAt}}' \
    | sort | head -1)
  if [ -z "$age" ]; then
    age="-"
  fi

  front_mapping=$(docker compose -p "$name" port frontend 8080 2>/dev/null || true)
  if [ -n "$front_mapping" ]; then
    front_port=$(echo "$front_mapping" | cut -d: -f2)
    frontend="http://localhost:${front_port}"
  else
    frontend="-"
  fi

  printf '%-30s  %-12s  %-28s  %s\n' "$name" "$status" "$age" "$frontend"
done

echo ""
echo "$projects"
