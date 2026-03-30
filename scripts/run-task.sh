#!/bin/bash
# scripts/run-task.sh
# Runs worker + validator loop for a single task until success or max retries
# Enhanced with:
# - Worktree support for isolated environments
# - Comment-based review system (validator adds comments, worker addresses them)
# - Automatic merge to plan branch on success

set -e

PLAN_ID=$1
TASK_ID=$2
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source utility functions first
source "$SCRIPT_DIR/task-utils.sh"
source "$SCRIPT_DIR/api-limit-handler.sh"

# Get main repo root (works from main repo or worktree)
# This ensures we always reference the plan branch's .backlog
PROJECT_ROOT=$(get_main_repo_root)

PLAN_DIR="$PROJECT_ROOT/.backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
TASKS_LOCK="$PLAN_DIR/tasks.jsonl.lock"
CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

# Use worktree if set, otherwise fall back to project root
WORKTREE_PATH="${PLAN_WORKTREE:-$PROJECT_ROOT}"

# Temporary output files for API limit detection
WORKER_OUTPUT_FILE="/tmp/worker-${PLAN_ID}-${TASK_ID}-$$.log"
VALIDATOR_OUTPUT_FILE="/tmp/validator-${PLAN_ID}-${TASK_ID}-$$.log"

# Cleanup temp files on exit
trap "rm -f '$WORKER_OUTPUT_FILE' '$VALIDATOR_OUTPUT_FILE'" EXIT

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    MAX_RESTARTS=$(jq -r '.validation.maxRetries // 3' "$CONFIG_FILE")
    REVIEW_COMMENT_PREFIX=$(jq -r '.validation.reviewCommentPrefix // "@REVIEW [VALIDATOR]"' "$CONFIG_FILE")
    BASE_BRANCH=$(jq -r '.baseBranch // "main"' "$CONFIG_FILE")
else
    MAX_RESTARTS=${MAX_RESTARTS:-3}
    REVIEW_COMMENT_PREFIX="@REVIEW [VALIDATOR]"
    BASE_BRANCH="main"
fi

WORKER_MAX_TURNS=${WORKER_MAX_TURNS:-50}
VALIDATOR_MAX_TURNS=${VALIDATOR_MAX_TURNS:-10}

#####################################################################
# Helper Functions
#####################################################################

log() {
  echo "[$(date '+%H:%M:%S')] $1"
}

update_task_status() {
  local new_status=$1
  local extra_fields="${2:-}"

  # Use atomic update from task-utils.sh
  atomic_update_task_status "$PLAN_ID" "$TASK_ID" "$new_status" "$extra_fields" "$TASKS_FILE" "$TASKS_LOCK"
}

count_review_comments() {
  # Count validator review comments in the worktree
  local count=0

  cd "$WORKTREE_PATH"

  # Search for review comments in source files
  count=$(grep -r "$REVIEW_COMMENT_PREFIX" . \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --include="*.json" \
    --include="*.md" \
    2>/dev/null | wc -l | tr -d ' ')

  echo "$count"
}

run_health_check() {
  log "Running health check..."
  if [ -x "$SCRIPT_DIR/worktree-health-check.sh" ]; then
    if ! "$SCRIPT_DIR/worktree-health-check.sh" "$PLAN_ID" --repair; then
      log "WARNING: Health check failed, continuing anyway..."
    fi
  fi
}

merge_task_branch() {
  local task_branch=$1
  local plan_branch=$2

  log "Merging task branch to plan branch..."

  cd "$WORKTREE_PATH"

  # Get current branch
  local current_branch=$(git rev-parse --abbrev-ref HEAD)

  # Checkout plan branch
  git checkout "$plan_branch" || {
    log "ERROR: Could not checkout plan branch $plan_branch"
    return 1
  }

  # Merge task branch
  git merge --no-ff "$task_branch" -m "Merge $TASK_ID: $TASK_NAME

Acceptance criteria validated by autonomous validator.
All review comments addressed." || {
    log "ERROR: Merge failed - conflicts detected"
    git merge --abort 2>/dev/null || true
    git checkout "$current_branch"
    return 1
  }

  # Delete task branch after successful merge
  git branch -d "$task_branch" 2>/dev/null || {
    log "WARNING: Could not delete task branch $task_branch"
  }

  log "✅ Task branch merged successfully"
  return 0
}

#####################################################################
# Main Execution
#####################################################################

log "Starting task: $TASK_ID in plan $PLAN_ID"
log "Worktree: $WORKTREE_PATH"
log "Max attempts: $MAX_RESTARTS"
log "Review comment prefix: $REVIEW_COMMENT_PREFIX"

# Verify task exists
if ! jq -e "select(.id == \"$TASK_ID\")" "$TASKS_FILE" > /dev/null; then
  log "ERROR: Task $TASK_ID not found in plan $PLAN_ID"
  exit 1
fi

# Get task details for logging and merging
TASK_NAME=$(jq -r "select(.id == \"$TASK_ID\") | .name" "$TASKS_FILE")
TASK_BRANCH=$(jq -r "select(.id == \"$TASK_ID\") | .branch // \"$PLAN_ID-t-$TASK_ID\"" "$TASKS_FILE")
PLAN_BRANCH="$PLAN_ID"

log "Task: $TASK_NAME"
log "Task branch: $TASK_BRANCH"
log "Plan branch: $PLAN_BRANCH"

# Change to worktree
cd "$WORKTREE_PATH"

# Worker/validator retry loop
for attempt in $(seq 1 $MAX_RESTARTS); do
  log ""
  log "=========================================="
  log "=== Attempt $attempt/$MAX_RESTARTS ==="
  log "=========================================="

  # Run health check before each attempt
  run_health_check

  # Update status to in_progress
  update_task_status "in_progress"

  # Run worker (blocks until Claude exits)
  log ""
  log "--- Running Worker ---"
  cd "$WORKTREE_PATH"

  # Capture output for API limit detection
  claude -p "/execute-task $PLAN_ID $TASK_ID" --max-turns $WORKER_MAX_TURNS 2>&1 | tee "$WORKER_OUTPUT_FILE"

  # Check if API limit was hit and handle it
  if handle_api_limit "$WORKER_OUTPUT_FILE" "Worker"; then
    # Limit was hit and we waited - resume worker
    log "Resuming worker after API limit reset..."
    rm -f "$WORKER_OUTPUT_FILE"
    claude -p "/execute-task $PLAN_ID $TASK_ID" --max-turns $WORKER_MAX_TURNS 2>&1 | tee "$WORKER_OUTPUT_FILE"
  fi

  log "Worker completed"

  # Update status for validation
  update_task_status "validating"

  # Run validator (blocks until Claude exits)
  # Validator will ADD review comments but NOT update status
  log ""
  log "--- Running Validator ---"
  cd "$WORKTREE_PATH"

  # Capture output for API limit detection
  claude -p "/validate-task $PLAN_ID $TASK_ID" --max-turns $VALIDATOR_MAX_TURNS 2>&1 | tee "$VALIDATOR_OUTPUT_FILE"

  # Check if API limit was hit and handle it
  if handle_api_limit "$VALIDATOR_OUTPUT_FILE" "Validator"; then
    # Limit was hit and we waited - resume validator
    log "Resuming validator after API limit reset..."
    rm -f "$VALIDATOR_OUTPUT_FILE"
    claude -p "/validate-task $PLAN_ID $TASK_ID" --max-turns $VALIDATOR_MAX_TURNS 2>&1 | tee "$VALIDATOR_OUTPUT_FILE"
  fi

  log "Validator completed"

  # Check for review comments (the new validation mechanism)
  REVIEW_COMMENTS=$(count_review_comments)
  log ""
  log "Review comments found: $REVIEW_COMMENTS"

  if [ "$REVIEW_COMMENTS" -eq 0 ]; then
    # No review comments = validation passed!
    log ""
    log "✅ No review comments - validation PASSED!"

    # Mark task as complete
    update_task_status "complete" ".completedAt = \"$(date -Iseconds)\""

    # Merge task branch to plan branch
    if merge_task_branch "$TASK_BRANCH" "$PLAN_BRANCH"; then
      log "✅ Task completed and merged successfully!"
    else
      log "WARNING: Merge failed, but task is marked complete"
      log "Manual merge may be required for branch: $TASK_BRANCH"
    fi

    # Spawn next task check (in background)
    if [ -x "$SCRIPT_DIR/start-next-task.sh" ]; then
      log ""
      log "Checking for next ready tasks..."
      "$SCRIPT_DIR/start-next-task.sh" "$PLAN_ID" &
    fi

    exit 0
  fi

  # Review comments exist - validation failed, will retry
  log ""
  log "⚠️ Validator left $REVIEW_COMMENTS review comments"
  log "Worker will address these on next attempt..."

  # Show the review comments for visibility
  log ""
  log "Review comments to address:"
  grep -r "$REVIEW_COMMENT_PREFIX" "$WORKTREE_PATH" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    2>/dev/null | head -20 || true

  if [ $attempt -lt $MAX_RESTARTS ]; then
    log ""
    log "Retrying in 2 seconds..."
    sleep 2
  fi
done

log ""
log "❌ Max attempts ($MAX_RESTARTS) reached with $REVIEW_COMMENTS unresolved review comments"
log "Marking task as failed"
update_task_status "failed" ".validationNotes = \"Max attempts reached with unresolved review comments\""
exit 1
