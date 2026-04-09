#!/bin/bash
# scripts/spawn-task.sh
# Creates a task-specific worktree and tmux session for isolated task execution
# Enhanced with:
# - Task-specific worktrees (not shared plan worktree)
# - Intelligent Docker startup (only when needed)
# - Atomic file locking

set -e

PLAN_ID=$1
TASK_ID=$2
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source utility functions first
source "$SCRIPT_DIR/task-utils.sh"

# Get main repo root (works from main repo or worktree)
PROJECT_ROOT=$(get_main_repo_root)

PLAN_DIR="$PROJECT_ROOT/.backlog/$PLAN_ID"
TASKS_FILE="$PLAN_DIR/tasks.jsonl"
LOCK_FILE="$PLAN_DIR/locks/$TASK_ID.lock"
CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    WORKTREE_BASE_DIR=$(jq -r '.worktree.baseDir // ".worktrees"' "$CONFIG_FILE")
else
    WORKTREE_BASE_DIR=".worktrees"
fi

# Task-specific worktree path
TASK_WORKTREE_PATH="$PROJECT_ROOT/$WORKTREE_BASE_DIR/$PLAN_ID-t-$TASK_ID"
TASK_BRANCH="$PLAN_ID-t-$TASK_ID"
PLAN_BRANCH="$PLAN_ID"

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

#####################################################################
# Lock Management
#####################################################################

# Create locks directory
mkdir -p "$PLAN_DIR/locks"

# Test if we can acquire the lock
if ! mkdir "$LOCK_FILE" 2>/dev/null; then
  echo "Task $TASK_ID is already running (locked)"
  exit 1
fi

# Trap to ensure lock is released on exit
trap "rm -rf '$LOCK_FILE'" EXIT

#####################################################################
# Validation
#####################################################################

# Get task details
if ! jq -e "select(.id == \"$TASK_ID\")" "$TASKS_FILE" > /dev/null; then
  echo "Error: Task $TASK_ID not found in plan $PLAN_ID"
  exit 1
fi

TASK_NAME=$(jq -r "select(.id == \"$TASK_ID\") | .name" "$TASKS_FILE")
SESSION="$PLAN_ID-$(echo $TASK_ID | sed 's/\./_/g')"

# Check if session already exists
if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "Session $SESSION already exists"
  exit 1
fi

# Check if plan branch exists
if ! git rev-parse --verify "$PLAN_BRANCH" >/dev/null 2>&1; then
    echo "Error: Plan branch $PLAN_BRANCH does not exist"
    echo ""
    echo "This should not happen - /execute-plan should have created it automatically."
    echo "Please run: /execute-plan $PLAN_ID"
    exit 1
fi

#####################################################################
# Worktree Creation
#####################################################################

echo ""
echo "════════════════════════════════════════════════════════════"
echo "Spawning task: $TASK_ID"
echo "  Name: $TASK_NAME"
echo "  Session: $SESSION"
echo "════════════════════════════════════════════════════════════"

log "Creating task-specific worktree..."
echo "  Path: $TASK_WORKTREE_PATH"
echo "  Branch: $TASK_BRANCH (from $PLAN_BRANCH)"

if ! create_task_worktree "$PLAN_ID" "$TASK_ID" "$PROJECT_ROOT"; then
    echo "Error: Failed to create task worktree"
    exit 1
fi

log "✓ Task worktree created"

#####################################################################
# Docker Management
#####################################################################

log "Checking if task requires Docker..."

if task_needs_docker "$PLAN_ID" "$TASK_ID" "$TASKS_FILE"; then
    log "Task requires Docker - ensuring services are running..."

    if "$SCRIPT_DIR/ensure-plan-docker.sh" "$PLAN_ID"; then
        log "✓ Docker services ready"
    else
        log "ERROR: Failed to start Docker services"
        cleanup_task_worktree "$PLAN_ID" "$TASK_ID" "$PROJECT_ROOT"
        exit 1
    fi
else
    log "✓ Task does not require Docker (skipping)"
fi

#####################################################################
# Environment Setup
#####################################################################

# Get Docker configuration if needed
COMPOSE_PROJECT_NAME=$(echo "$PLAN_ID" | sed 's/\./_/g')

if [ -f "$PLAN_DIR/docker-state.json" ]; then
    DATABASE_PORT=$(jq -r '.ports.database' "$PLAN_DIR/docker-state.json")
    BACKEND_PORT=$(jq -r '.ports.backend' "$PLAN_DIR/docker-state.json")
    KEYCLOAK_PORT=$(jq -r '.ports.keycloak' "$PLAN_DIR/docker-state.json")
    FRONTEND_PORT=$(jq -r '.ports.frontend' "$PLAN_DIR/docker-state.json")
else
    # Defaults
    DATABASE_PORT=5437
    BACKEND_PORT=8085
    KEYCLOAK_PORT=8081
    FRONTEND_PORT=3000
fi

#####################################################################
# Tmux Session Creation
#####################################################################

log "Creating tmux session..."
echo "  Lock: $LOCK_FILE"

# Create tmux session running the task script in the task worktree
# The trap ensures lock is released when session exits
# Environment variables tell run-task.sh where to work and how to connect
tmux new-session -d -s "$SESSION" bash -c "
  # Cleanup on exit
  trap 'rm -rf \"$LOCK_FILE\"' EXIT

  # Export environment
  export PLAN_WORKTREE=\"$TASK_WORKTREE_PATH\"
  export PROJECT_ROOT=\"$PROJECT_ROOT\"
  export COMPOSE_PROJECT_NAME=\"$COMPOSE_PROJECT_NAME\"
  export DATABASE_PORT=\"$DATABASE_PORT\"
  export BACKEND_PORT=\"$BACKEND_PORT\"
  export KEYCLOAK_PORT=\"$KEYCLOAK_PORT\"
  export FRONTEND_PORT=\"$FRONTEND_PORT\"
  export DATABASE_URL=\"postgresql://postgres:postgres@localhost:${DATABASE_PORT}/the_dev_team\"

  # Change to task worktree
  cd \"$TASK_WORKTREE_PATH\"

  # Run task
  \"$SCRIPT_DIR/run-task.sh\" \"$PLAN_ID\" \"$TASK_ID\"

  # Cleanup worktree on completion
  cd \"$PROJECT_ROOT\"
  source \"$SCRIPT_DIR/task-utils.sh\"
  cleanup_task_worktree \"$PLAN_ID\" \"$TASK_ID\" \"$PROJECT_ROOT\"

  echo ''
  echo 'Task session complete. Press enter to close...'
  read
"

log "✓ Tmux session created"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Task spawned successfully!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Attach to session:"
echo "  tmux attach -t $SESSION"
echo ""
echo "Detach from session:"
echo "  Press: Ctrl-b then d"
echo ""
