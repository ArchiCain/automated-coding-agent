#!/bin/bash
# scripts/start-next-task.sh
# Checks dependencies, unblocks tasks, and spawns workers for all ready tasks (AMAP)

set -e

PLAN_ID=$1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source utility functions first
source "$SCRIPT_DIR/task-utils.sh"

# Get main repo root (works from main repo or worktree)
PROJECT_ROOT=$(get_main_repo_root)

PLAN_DIR="$PROJECT_ROOT/.backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
TASKS_LOCK="$PLAN_DIR/tasks.jsonl.lock"
STATE_FILE="$PLAN_DIR/state.json"
CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

# Check if a task's dependencies are all complete
check_dependencies() {
  local task_id=$1

  # Get dependencies array (may be empty)
  local deps=$(jq -r "select(.id==\"$task_id\") | .dependencies[]?" "$TASKS_FILE" 2>/dev/null)

  # If no dependencies, return success
  if [ -z "$deps" ]; then
    return 0
  fi

  # Check each dependency
  for dep in $deps; do
    local dep_status=$(jq -r "select(.id==\"$dep\") | .status" "$TASKS_FILE")

    if [ "$dep_status" != "complete" ]; then
      return 1  # Dependency not met
    fi
  done

  return 0  # All dependencies met
}

# Update task status in tasks.jsonl (atomic)
update_task_status() {
  local task_id=$1
  local new_status=$2

  # Use atomic update from task-utils.sh
  atomic_update_task_status "$PLAN_ID" "$task_id" "$new_status" "" "$TASKS_FILE" "$TASKS_LOCK"
}

log "Checking for tasks to unblock and execute in plan $PLAN_ID..."
log ""

# First pass: unblock any blocked tasks whose dependencies are met
log "Phase 1: Unblocking tasks with met dependencies..."

while IFS= read -r line; do
  task_id=$(echo "$line" | jq -r '.id')
  status=$(echo "$line" | jq -r '.status')
  type=$(echo "$line" | jq -r '.type')

  # Only process tasks (not plans/projects/features)
  if [ "$type" != "task" ]; then
    continue
  fi

  # If blocked, check if we can unblock
  if [ "$status" == "blocked" ]; then
    if check_dependencies "$task_id"; then
      task_name=$(echo "$line" | jq -r '.name')
      log "  ✓ Unblocking $task_id: $task_name (all dependencies met)"
      update_task_status "$task_id" "ready"
    fi
  fi
done < <(jq -c '.' "$TASKS_FILE")

# Second pass: spawn workers for ALL ready tasks (AMAP parallelism)
log "Phase 2: Finding and spawning ready tasks..."

ready_tasks=$(jq -r 'select(.type=="task" and .status=="ready") | .id' "$TASKS_FILE")

if [ -z "$ready_tasks" ]; then
  log "No ready tasks available"

  # Calculate status summary
  blocked_count=$(jq 'select(.type=="task" and .status=="blocked")' "$TASKS_FILE" | jq -s 'length')
  in_progress_count=$(jq 'select(.type=="task" and (.status=="in_progress" or .status=="validating"))' "$TASKS_FILE" | jq -s 'length')
  complete_count=$(jq 'select(.type=="task" and .status=="complete")' "$TASKS_FILE" | jq -s 'length')
  total_count=$(jq 'select(.type=="task")' "$TASKS_FILE" | jq -s 'length')

  log "Status: $complete_count complete, $in_progress_count in progress, $blocked_count blocked (of $total_count total)"

  # Check if we're done
  if [ "$blocked_count" -eq 0 ] && [ "$in_progress_count" -eq 0 ] && [ "$total_count" -gt 0 ]; then
    log "🎉 All tasks complete!"

    # Update plan status to complete
    if [ -f "$STATE_FILE" ]; then
      jq '.status = "complete" | .completedAt = "'$(date -Iseconds)'"' "$STATE_FILE" > "$STATE_FILE.tmp"
      mv "$STATE_FILE.tmp" "$STATE_FILE"
      log "Plan $PLAN_ID marked as complete"
    fi

    exit 0
  else
    log "Waiting for in-progress tasks to complete..."
  fi

  exit 0
fi

# Count ready tasks
ready_count=$(echo "$ready_tasks" | wc -l | tr -d ' ')
log "Found $ready_count ready task(s). Spawning workers (AMAP)..."

# Spawn workers for all ready tasks in parallel
for task_id in $ready_tasks; do
  task_name=$(jq -r "select(.id==\"$task_id\") | .name" "$TASKS_FILE")
  log "  → Spawning worker for $task_id: $task_name"

  # Spawn in background to continue loop (parallel execution)
  "$SCRIPT_DIR/spawn-task.sh" "$PLAN_ID" "$task_id" &

  # Small delay to avoid race conditions on lock creation
  sleep 0.5
done

log "✓ Spawned $ready_count worker(s)"
log ""
log "Active sessions:"
tmux list-sessions 2>/dev/null | grep "^$PLAN_ID-" || log "  (none yet - sessions starting up)"
