#!/usr/bin/env bash
set -euo pipefail

# Plan Watcher - Continuous monitoring with stuck detection and auto-recovery
# Inspired by the Witness agent pattern

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLAN_ID="${1:-}"
CHECK_INTERVAL="${2:-60}"  # Default: check every 60 seconds

if [ -z "$PLAN_ID" ]; then
  echo "Usage: $0 <plan-id> [check-interval-seconds]"
  exit 1
fi

PLAN_DIR=".backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
WATCHER_LOCK="$PLAN_DIR/locks/watcher.lock"
HEARTBEAT_FILE="$PLAN_DIR/watcher-heartbeat.json"

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
  echo -e "${BLUE}[watcher]${NC} [$(date '+%H:%M:%S')] $*"
}

warn() {
  echo -e "${YELLOW}[watcher]${NC} [$(date '+%H:%M:%S')] $*"
}

error() {
  echo -e "${RED}[watcher]${NC} [$(date '+%H:%M:%S')] $*"
}

success() {
  echo -e "${GREEN}[watcher]${NC} [$(date '+%H:%M:%S')] $*"
}

# Cleanup on exit
cleanup() {
  log "Watcher stopping..."
  rm -f "$WATCHER_LOCK"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Check if watcher already running
if [ -f "$WATCHER_LOCK" ]; then
  LOCK_PID=$(cat "$WATCHER_LOCK")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    error "Watcher already running (PID: $LOCK_PID)"
    exit 1
  else
    warn "Stale lock found, removing..."
    rm -f "$WATCHER_LOCK"
  fi
fi

# Acquire lock
echo $$ > "$WATCHER_LOCK"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

get_task_status() {
  local task_id=$1
  jq -r --arg id "$task_id" 'select(.id==$id) | .status' "$TASKS_FILE" 2>/dev/null || echo ""
}

get_task_attempts() {
  local task_id=$1
  jq -r --arg id "$task_id" 'select(.id==$id) | .attempts // 0' "$TASKS_FILE" 2>/dev/null || echo 0
}

update_task_field() {
  local task_id=$1
  local field=$2
  local value=$3

  # Create temp file
  local tmp_file=$(mktemp)

  # Update the field
  jq --arg id "$task_id" --arg field "$field" --argjson value "$value" \
    'if .id == $id then .[$field] = $value else . end' \
    "$TASKS_FILE" > "$tmp_file"

  mv "$tmp_file" "$TASKS_FILE"
}

update_task_status() {
  local task_id=$1
  local status=$2
  update_task_field "$task_id" "status" "\"$status\""
}

increment_attempts() {
  local task_id=$1
  local current=$(get_task_attempts "$task_id")
  local next=$((current + 1))
  update_task_field "$task_id" "attempts" "$next"
}

update_heartbeat() {
  local cycle=$1
  local last_action=$2
  local ready_count=$3
  local active_count=$4

  cat > "$HEARTBEAT_FILE" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "cycle": $cycle,
  "last_action": "$last_action",
  "ready_tasks": $ready_count,
  "active_workers": $active_count,
  "pid": $$
}
EOF
}

session_name_from_task() {
  local task_id=$1
  echo "p-${PLAN_ID}-${task_id//./_}"
}

# ============================================================================
# STUCK DETECTION
# ============================================================================

detect_stuck_reason() {
  local task_id=$1
  local session=$2

  # Capture recent output
  local output=$(tmux capture-pane -t "$session" -p -S -50 2>/dev/null || echo "")

  # Pattern match common issues
  if echo "$output" | grep -qi "docker.*not.*running\|cannot connect to.*docker"; then
    echo "DOCKER: Worker waiting for Docker daemon or services to start"

  elif echo "$output" | grep -qi "health check.*failed\|service.*not ready"; then
    echo "HEALTH_CHECK: Worker stuck waiting for service health checks"

  elif echo "$output" | grep -qi "rate limit\|429\|too many requests"; then
    echo "RATE_LIMIT: Worker hit API rate limit"

  elif echo "$output" | grep -qi "syntaxerror\|typeerror.*unexpected"; then
    echo "SYNTAX_ERROR: Worker encountered code syntax/type error"

  elif echo "$output" | grep -qi "module not found\|cannot find module\|package.*not installed"; then
    echo "DEPENDENCY: Missing package or dependency"

  elif echo "$output" | grep -qi "enoent.*\.env\|environment variable.*not set"; then
    echo "CONFIG: Missing environment configuration or .env file"

  elif echo "$output" | grep -qi "EADDRINUSE\|port.*already in use"; then
    echo "PORT_CONFLICT: Port already in use by another process"

  elif ! tmux has-session -t "$session" 2>/dev/null; then
    echo "SESSION_CRASHED: Worker tmux session exited/crashed unexpectedly"

  else
    echo "UNKNOWN: Worker not making progress (no output changes in 15+ min)"
  fi
}

is_transient_issue() {
  local task_id=$1
  local session=$(session_name_from_task "$task_id")

  # Capture last 20 lines of output
  local output=$(tmux capture-pane -t "$session" -p -S -20 2>/dev/null || echo "")

  # Docker daemon starting (common on Mac after restart)
  if echo "$output" | grep -q "Cannot connect to the Docker daemon"; then
    log "  → Transient: Docker daemon not ready"
    return 0
  fi

  # API rate limit
  if echo "$output" | grep -q "rate limit\|429\|too many requests"; then
    log "  → Transient: API rate limit"
    return 0
  fi

  # Network timeout (but not connection refused)
  if echo "$output" | grep -q "timeout" && ! echo "$output" | grep -q "Connection refused"; then
    log "  → Transient: Network timeout"
    return 0
  fi

  # Health check timeout on first attempt only
  local attempts=$(get_task_attempts "$task_id")
  if echo "$output" | grep -q "health check.*timeout" && [ "$attempts" -eq 0 ]; then
    log "  → Transient: Health check timeout (first run)"
    return 0
  fi

  return 1
}

stuck_detected() {
  local task_id=$1
  local session=$(session_name_from_task "$task_id")
  local status=$(get_task_status "$task_id")

  # Check 1: Worker session exists but task still "ready" for 2+ min
  if [ "$status" = "ready" ] && tmux has-session -t "$session" 2>/dev/null; then
    # Check how long session has existed
    local created=$(tmux display-message -t "$session" -p '#{session_created}' 2>/dev/null || echo 0)
    local now=$(date +%s)
    local age=$((now - created))

    if [ $age -gt 120 ]; then
      log "  → Stuck: Worker spawned but task still ready after ${age}s"
      return 0
    fi
  fi

  # Check 2: Task in_progress but no session (crashed)
  if [ "$status" = "in_progress" ] && ! tmux has-session -t "$session" 2>/dev/null; then
    log "  → Stuck: Worker session crashed/exited unexpectedly"
    return 0
  fi

  # Check 3: Task in_progress, session exists, but no progress for 15+ min
  if [ "$status" = "in_progress" ] && tmux has-session -t "$session" 2>/dev/null; then
    # Check session activity
    local activity=$(tmux display-message -t "$session" -p '#{session_activity}' 2>/dev/null || echo 0)
    local now=$(date +%s)
    local idle=$((now - activity))

    if [ $idle -gt 900 ]; then  # 15 minutes
      log "  → Stuck: Worker idle for ${idle}s (15+ min)"
      return 0
    fi
  fi

  return 1
}

# ============================================================================
# RECOVERY ACTIONS
# ============================================================================

handle_transient_retry() {
  local task_id=$1
  local session=$(session_name_from_task "$task_id")

  warn "Free retry for $task_id (transient issue)"

  # Backoff based on issue type
  local output=$(tmux capture-pane -t "$session" -p -S -20 2>/dev/null || echo "")

  if echo "$output" | grep -q "docker"; then
    log "Waiting 45s for Docker to stabilize..."
    sleep 45
  elif echo "$output" | grep -q "rate limit\|429"; then
    log "Waiting 120s for rate limit to reset..."
    sleep 120
  else
    log "Waiting 30s before retry..."
    sleep 30
  fi

  # Kill and respawn without counting as attempt
  log "Restarting worker (free retry, attempts not incremented)"
  kill_and_respawn "$task_id" false
}

kill_and_respawn() {
  local task_id=$1
  local count_attempt=${2:-true}
  local session=$(session_name_from_task "$task_id")

  # Kill session
  if tmux has-session -t "$session" 2>/dev/null; then
    log "Killing session: $session"
    tmux kill-session -t "$session" 2>/dev/null || true
  fi

  # Clean up worktree and branch
  local worktree_path=".worktrees/p-${PLAN_ID}-t-${task_id}"
  local branch="p-${PLAN_ID}-t-${task_id}"

  if [ -d "$worktree_path" ]; then
    log "Removing worktree: $worktree_path"
    git worktree remove "$worktree_path" --force 2>/dev/null || true
  fi

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    log "Deleting branch: $branch"
    git branch -D "$branch" 2>/dev/null || true
  fi

  # Remove lock
  rm -f "$PLAN_DIR/locks/${task_id}.lock" 2>/dev/null || true

  # Reset status to ready
  update_task_status "$task_id" "ready"

  # Spawn fresh worker via start-next-task
  log "Spawning fresh worker for $task_id"
  bash "$SCRIPT_DIR/start-next-task.sh" "$PLAN_ID"
}

# ============================================================================
# FIXER AGENT
# ============================================================================

spawn_fixer_agent() {
  local task_id=$1
  local worker_session=$(session_name_from_task "$task_id")
  local fixer_session="p-${PLAN_ID}-fixer-${task_id//./_}"

  log "Spawning FIXER for task $task_id"

  # Get stuck reason
  local stuck_reason=$(detect_stuck_reason "$task_id" "$worker_session")
  local last_output=$(tmux capture-pane -t "$worker_session" -p -S -30 2>/dev/null || echo "Session not found")

  # Build simple, direct prompt
  cat > /tmp/fixer-prompt-${task_id}.txt <<FIXER_PROMPT
# Fixer Agent - Unstick Worker

A worker is stuck and needs your help.

## Task Information
$(jq --arg id "$task_id" 'select(.id==$id)' "$TASKS_FILE")

## Worker Session
The stuck worker is running in tmux session: **${worker_session}**

Access it with:
\`\`\`bash
tmux attach -t ${worker_session}
\`\`\`

Or inspect without attaching:
\`\`\`bash
tmux capture-pane -t ${worker_session} -p | tail -50
\`\`\`

## Why It's Stuck
${stuck_reason}

## Last 30 Lines of Worker Output
\`\`\`
${last_output}
\`\`\`

---

## Your Job

**Get this worker unstuck in ONE attempt.**

Common fixes:
- Worker waiting on Docker? → Fix Docker services, worker will continue
- Worker has syntax error? → Fix the file in the worktree, worker will retry
- Worker needs env config? → Create/update .env files
- Worker stuck in a prompt? → Send input to the tmux session
- Worker frozen on a command? → Send Ctrl+C to interrupt, it may recover

## How to Succeed

1. **Investigate**: Look at the worker's output, understand what's blocking it
2. **Fix the blocker**: Docker, env vars, files, dependencies, whatever it needs
3. **Verify**: Check if worker continues and makes progress
4. **Exit successfully**: If worker is now running, just exit - watcher will monitor it

## If You Can't Fix It

If you cannot get the worker unstuck:

1. Document what you tried and why it failed
2. Recommend what a human should do
3. Exit with an error or explicit statement that you couldn't fix it

The watcher will mark this task as "stuck" for human review.

---

**Worker session: ${worker_session}**
**Your time limit: No hard limit, but be efficient**
**You have ONE shot to fix this**

Good luck!
FIXER_PROMPT

  # Spawn fixer with Opus, generous timeout (60 min)
  tmux new-session -d -s "$fixer_session" \
    "claude-code --model opus --max-turns 20 --timeout 3600000 --prompt \"\$(cat /tmp/fixer-prompt-${task_id}.txt)\""

  success "✓ Fixer spawned: $fixer_session"
  log "  Target worker: $worker_session"
  log "  Stuck reason: $stuck_reason"
  log "  Model: Opus, Max turns: 20, Timeout: 60min"
}

worker_is_progressing() {
  local session=$1

  # Check if session exists
  if ! tmux has-session -t "$session" 2>/dev/null; then
    return 1
  fi

  # Capture output, wait, check if it changed
  local output_before=$(tmux capture-pane -t "$session" -p -S -5 2>/dev/null || echo "")
  sleep 10
  local output_after=$(tmux capture-pane -t "$session" -p -S -5 2>/dev/null || echo "")

  # If output is different, worker is doing something
  if [ "$output_before" != "$output_after" ]; then
    return 0  # Progressing
  fi

  return 1  # Not progressing
}

monitor_fixer_progress() {
  local task_id=$1
  local worker_session=$(session_name_from_task "$task_id")
  local fixer_session="p-${PLAN_ID}-fixer-${task_id//./_}"

  local fixer_started=$(date +%s)
  local max_wait=3600  # 1 hour max

  log "Monitoring fixer for task $task_id..."

  while true; do
    local elapsed=$(($(date +%s) - fixer_started))

    # Check if fixer session still exists
    if ! tmux has-session -t "$fixer_session" 2>/dev/null; then
      log "Fixer session ended"

      # Did the worker recover?
      if worker_is_progressing "$worker_session"; then
        success "Worker unstuck! Fixer succeeded."
        update_task_field "$task_id" "attempts" 0  # Reset attempts
        update_task_status "$task_id" "in_progress"
        return 0
      else
        warn "Fixer exited but worker still stuck"
        mark_task_stuck "$task_id"
        return 1
      fi
    fi

    # Check if worker already recovered (fixer still working)
    if worker_is_progressing "$worker_session"; then
      success "Worker recovered while fixer was working!"
      # Kill fixer (no longer needed)
      tmux kill-session -t "$fixer_session" 2>/dev/null || true
      update_task_field "$task_id" "attempts" 0
      update_task_status "$task_id" "in_progress"
      return 0
    fi

    # Timeout check
    if [ $elapsed -gt $max_wait ]; then
      warn "Fixer timeout after ${max_wait}s"
      tmux kill-session -t "$fixer_session" 2>/dev/null || true
      mark_task_stuck "$task_id"
      return 2
    fi

    sleep 30  # Check every 30s
  done
}

mark_task_stuck() {
  local task_id=$1
  local worker_session=$(session_name_from_task "$task_id")
  local fixer_session="p-${PLAN_ID}-fixer-${task_id//./_}"

  # Capture diagnostic info
  local worker_output=$(tmux capture-pane -t "$worker_session" -p -S - 2>/dev/null || echo "Session not found")
  local fixer_output=$(tmux capture-pane -t "$fixer_session" -p -S - 2>/dev/null || echo "Fixer session not found")

  # Save diagnostics
  mkdir -p "$PLAN_DIR/stuck-tasks"
  cat > "$PLAN_DIR/stuck-tasks/${task_id}.md" <<STUCK_DOC
# Stuck Task: ${task_id}

**Status:** Stuck after 3 restart attempts + fixer intervention
**Time:** $(date -Iseconds)

## Task Details
\`\`\`json
$(jq --arg id "$task_id" 'select(.id==$id)' "$TASKS_FILE")
\`\`\`

## Worker Final Output
\`\`\`
${worker_output}
\`\`\`

## Fixer Output
\`\`\`
${fixer_output}
\`\`\`

## Next Steps
- Review the outputs above
- Manually investigate in the worktree (if it still exists)
- Fix the underlying issue
- Reset task to ready when resolved:
  \`\`\`bash
  # Reset task
  jq '(select(.id=="$task_id") | .status) = "ready" | (select(.id=="$task_id") | .attempts) = 0' \\
    .backlog/$PLAN_ID/tasks.jsonl > tmp && mv tmp .backlog/$PLAN_ID/tasks.jsonl

  # Restart execution
  bash scripts/start-next-task.sh $PLAN_ID
  \`\`\`
STUCK_DOC

  # Update task status
  update_task_status "$task_id" "stuck"
  update_task_field "$task_id" "stuck_at" "\"$(date -Iseconds)\""

  # Kill sessions
  tmux kill-session -t "$worker_session" 2>/dev/null || true
  tmux kill-session -t "$fixer_session" 2>/dev/null || true

  error "Task $task_id marked as STUCK - human intervention needed"
  error "Diagnostic saved to: $PLAN_DIR/stuck-tasks/${task_id}.md"
}

# ============================================================================
# MAIN PATROL LOOP
# ============================================================================

log "Starting watcher for plan: $PLAN_ID"
log "Check interval: ${CHECK_INTERVAL}s"
log ""

cycle=0

while true; do
  ((cycle++))

  # Count tasks by status
  COMPLETE=$(jq 'select(.type=="task" and .status=="complete")' "$TASKS_FILE" 2>/dev/null | jq -s 'length' || echo 0)
  IN_PROGRESS=$(jq 'select(.type=="task" and .status=="in_progress")' "$TASKS_FILE" 2>/dev/null | jq -s 'length' || echo 0)
  READY=$(jq 'select(.type=="task" and .status=="ready")' "$TASKS_FILE" 2>/dev/null | jq -s 'length' || echo 0)
  FIXING=$(jq 'select(.type=="task" and .status=="fixing")' "$TASKS_FILE" 2>/dev/null | jq -s 'length' || echo 0)
  STUCK=$(jq 'select(.type=="task" and .status=="stuck")' "$TASKS_FILE" 2>/dev/null | jq -s 'length' || echo 0)
  TOTAL=$(jq 'select(.type=="task")' "$TASKS_FILE" 2>/dev/null | jq -s 'length' || echo 0)

  # Count active tmux sessions
  ACTIVE_SESSIONS=$(tmux list-sessions 2>/dev/null | grep -c "^p-$PLAN_ID-" || echo 0)

  log "Cycle #$cycle - Progress: $COMPLETE/$TOTAL complete, $READY ready, $IN_PROGRESS in_progress, $FIXING fixing, $STUCK stuck, $ACTIVE_SESSIONS workers"

  # Update heartbeat
  update_heartbeat "$cycle" "health-check" "$READY" "$ACTIVE_SESSIONS"

  # Check if we're done
  if [ "$COMPLETE" -eq "$TOTAL" ] && [ "$FIXING" -eq 0 ]; then
    success "All tasks complete! ($COMPLETE/$TOTAL)"
    success "Watcher job done. Exiting."
    exit 0
  fi

  # Monitor active tasks for stuck conditions
  for task_id in $(jq -r 'select(.type=="task" and (.status=="in_progress" or .status=="ready")) | .id' "$TASKS_FILE" 2>/dev/null); do

    status=$(get_task_status "$task_id")

    # Skip if already fixing or stuck
    if [ "$status" = "fixing" ] || [ "$status" = "stuck" ]; then
      continue
    fi

    # Check if stuck
    if stuck_detected "$task_id"; then
      warn "Task $task_id appears stuck"

      # Check if transient
      if is_transient_issue "$task_id"; then
        handle_transient_retry "$task_id"
        continue
      fi

      # Real failure - check attempts
      attempts=$(get_task_attempts "$task_id")

      if [ "$attempts" -lt 3 ]; then
        warn "Task $task_id stuck (attempt $attempts/3) - restarting"
        increment_attempts "$task_id"
        kill_and_respawn "$task_id" true
      else
        warn "Task $task_id failed 3 times - spawning fixer"
        update_task_status "$task_id" "fixing"
        spawn_fixer_agent "$task_id"

        # Monitor fixer in background (non-blocking)
        (monitor_fixer_progress "$task_id") &
      fi
    fi
  done

  # Check for ready tasks with no workers (original gap detection)
  if [ "$READY" -gt 0 ] && [ "$ACTIVE_SESSIONS" -eq 0 ]; then
    warn "Found $READY ready tasks but no active workers!"
    warn "Triggering start-next-task.sh to spawn workers..."

    if bash "$SCRIPT_DIR/start-next-task.sh" "$PLAN_ID"; then
      success "Successfully spawned workers for ready tasks"
      update_heartbeat "$cycle" "spawned-workers" "$READY" "$ACTIVE_SESSIONS"
    else
      error "Failed to spawn workers"
      update_heartbeat "$cycle" "spawn-failed" "$READY" "$ACTIVE_SESSIONS"
    fi
  fi

  # Sleep until next check
  sleep "$CHECK_INTERVAL"
done
