#!/usr/bin/env bash
set -euo pipefail

# Start Plan Watcher in tmux session

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN_ID="${1:-}"
CHECK_INTERVAL="${2:-60}"

if [ -z "$PLAN_ID" ]; then
  echo "Usage: $0 <plan-id> [check-interval-seconds]"
  exit 1
fi

SESSION_NAME="watcher-$PLAN_ID"

# Check if watcher session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Watcher already running for plan: $PLAN_ID"
  echo ""
  echo "Attach to watcher:"
  echo "  tmux attach -t $SESSION_NAME"
  echo ""
  echo "Stop watcher:"
  echo "  tmux kill-session -t $SESSION_NAME"
  exit 0
fi

# Make watcher executable
chmod +x "$SCRIPT_DIR/plan-watcher.sh"

# Create new tmux session for watcher
echo "════════════════════════════════════════════════════════════"
echo "Starting Plan Watcher"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Plan ID: $PLAN_ID"
echo "Check Interval: ${CHECK_INTERVAL}s"
echo "Session: $SESSION_NAME"
echo ""

tmux new-session -d -s "$SESSION_NAME" \
  "$SCRIPT_DIR/plan-watcher.sh $PLAN_ID $CHECK_INTERVAL"

echo "✓ Watcher started in background"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "Monitor Watcher:"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Attach to session:"
echo "    tmux attach -t $SESSION_NAME"
echo ""
echo "  View heartbeat:"
echo "    cat .backlog/$PLAN_ID/watcher-heartbeat.json"
echo ""
echo "  Stop watcher:"
echo "    tmux kill-session -t $SESSION_NAME"
echo ""
