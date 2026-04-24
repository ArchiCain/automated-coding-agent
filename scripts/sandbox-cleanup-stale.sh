#!/usr/bin/env bash
set -euo pipefail

# sandbox-cleanup-stale.sh — destroy env-* compose projects older than HOURS.
#
# Usage: scripts/sandbox-cleanup-stale.sh [HOURS=24]
#
# For each env-* compose project, inspects the oldest container's CreatedAt
# and — if the age in hours exceeds the threshold — calls sandbox-destroy.sh.

HOURS="${1:-24}"

if ! [[ "$HOURS" =~ ^[0-9]+$ ]]; then
  echo "invalid HOURS: '$HOURS' (want a non-negative integer)" >&2
  exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

names=$(docker compose ls --all --format json \
  | jq -r '.[] | select(.Name|startswith("env-")) | .Name')

reaped=0
retained=0
failed=0

now_epoch=$(date +%s)
cutoff_seconds=$((HOURS * 3600))

for name in $names; do
  created=$(docker ps -a \
    --filter "label=com.docker.compose.project=$name" \
    --format '{{.CreatedAt}}' \
    | sort | head -1)
  if [ -z "$created" ]; then
    retained=$((retained+1))
    continue
  fi

  # `docker ps` CreatedAt looks like: "2026-04-22 18:14:03 -0400 EDT".
  # Strip the trailing TZ abbreviation so `date -d` / `date -j` parse it.
  created_trim=$(echo "$created" | awk '{print $1" "$2" "$3}')

  created_epoch=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "$created_trim" +%s 2>/dev/null \
    || date -d "$created_trim" +%s 2>/dev/null \
    || echo "")

  if [ -z "$created_epoch" ]; then
    echo "could not parse CreatedAt for $name ('$created'); skipping" >&2
    failed=$((failed+1))
    continue
  fi

  age=$((now_epoch - created_epoch))
  if [ "$age" -gt "$cutoff_seconds" ]; then
    id="${name#env-}"
    echo "Reaping stale sandbox: $name (age: $((age/3600))h)"
    if bash "$SCRIPT_DIR/sandbox-destroy.sh" "$id"; then
      reaped=$((reaped+1))
    else
      failed=$((failed+1))
    fi
  else
    retained=$((retained+1))
  fi
done

printf '{reaped: %d, retained: %d, failed: %d}\n' "$reaped" "$retained" "$failed"
