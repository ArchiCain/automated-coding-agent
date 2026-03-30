#!/usr/bin/env bash

#####################################################################
# Cleanup Plan Worktree
#
# Cleans up a plan worktree after plan completion:
# - Stops Docker services
# - Merges plan branch to base branch
# - Removes worktree
# - Optionally deletes plan branch
#
# Usage: ./scripts/cleanup-plan-worktree.sh <plan-id> [--no-merge] [--keep-branch]
# Example: ./scripts/cleanup-plan-worktree.sh p-a075b3
#          ./scripts/cleanup-plan-worktree.sh p-a075b3 --no-merge
#          ./scripts/cleanup-plan-worktree.sh p-a075b3 --keep-branch
#####################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#####################################################################
# Configuration
#####################################################################

PLAN_ID="${1:-}"
NO_MERGE=false
KEEP_BRANCH=false

# Parse optional flags
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-merge)
            NO_MERGE=true
            shift
            ;;
        --keep-branch)
            KEEP_BRANCH=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    WORKTREE_BASE_DIR=$(jq -r '.worktree.baseDir // ".worktrees"' "$CONFIG_FILE")
    BASE_BRANCH=$(jq -r '.baseBranch // "main"' "$CONFIG_FILE")
    MERGE_STRATEGY=$(jq -r '.mergeStrategy // "no-ff"' "$CONFIG_FILE")
else
    WORKTREE_BASE_DIR=".worktrees"
    BASE_BRANCH="main"
    MERGE_STRATEGY="no-ff"
fi

WORKTREE_PATH="$PROJECT_ROOT/$WORKTREE_BASE_DIR/$PLAN_ID"
PLAN_BRANCH="$PLAN_ID"
PLAN_DIR="$PROJECT_ROOT/.backlog/$PLAN_ID"

#####################################################################
# Helper Functions
#####################################################################

log() {
    echo -e "${BLUE}[cleanup]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

#####################################################################
# Validation
#####################################################################

validate_input() {
    if [ -z "$PLAN_ID" ]; then
        log_error "Plan ID is required"
        echo ""
        echo "Usage: $0 <plan-id> [--no-merge] [--keep-branch]"
        echo "Example: $0 p-a075b3"
        echo ""
        echo "Options:"
        echo "  --no-merge    Skip merging plan branch to base branch"
        echo "  --keep-branch Don't delete the plan branch after cleanup"
        exit 1
    fi

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
}

#####################################################################
# Stop Services
#####################################################################

stop_services() {
    if [ ! -d "$WORKTREE_PATH" ]; then
        log "Worktree not found, skipping service stop"
        return 0
    fi

    log "Stopping Docker services..."

    cd "$WORKTREE_PATH"

    # Source .env to get compose project name
    if [ -f ".env" ]; then
        source .env
        local compose_project="${COMPOSE_PROJECT_NAME:-$PLAN_ID}"

        # Stop services
        if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
            task stop-local 2>&1 || true
            task purge-local 2>&1 || true
        else
            cd projects && docker compose down -v 2>&1 || true
            cd "$WORKTREE_PATH"
        fi

        # Double-check containers are stopped
        local remaining=$(docker ps -q --filter "label=com.docker.compose.project=$compose_project" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$remaining" -gt 0 ]; then
            log_warning "Forcing removal of $remaining remaining containers"
            docker ps -q --filter "label=com.docker.compose.project=$compose_project" | xargs -r docker rm -f 2>/dev/null || true
        fi

        log_success "Services stopped"
    else
        log_warning ".env not found, services may not be stopped"
    fi

    cd "$PROJECT_ROOT"
}

#####################################################################
# Merge Plan Branch
#####################################################################

merge_plan_branch() {
    if [ "$NO_MERGE" = true ]; then
        log "Skipping merge (--no-merge specified)"
        return 0
    fi

    # Check if plan branch exists
    if ! git show-ref --verify --quiet "refs/heads/$PLAN_BRANCH"; then
        log_warning "Plan branch $PLAN_BRANCH not found, skipping merge"
        return 0
    fi

    log "Merging $PLAN_BRANCH to $BASE_BRANCH..."

    # Make sure we're not in the worktree
    cd "$PROJECT_ROOT"

    # Checkout base branch
    git checkout "$BASE_BRANCH" || {
        log_error "Could not checkout $BASE_BRANCH"
        return 1
    }

    # Pull latest (if remote exists)
    git pull origin "$BASE_BRANCH" 2>/dev/null || true

    # Merge plan branch
    case "$MERGE_STRATEGY" in
        "no-ff")
            git merge --no-ff "$PLAN_BRANCH" -m "Complete plan: $PLAN_ID" || {
                log_error "Merge failed. Resolve conflicts manually."
                return 1
            }
            ;;
        "squash")
            git merge --squash "$PLAN_BRANCH" || {
                log_error "Squash merge failed. Resolve conflicts manually."
                return 1
            }
            git commit -m "Complete plan: $PLAN_ID (squashed)" || {
                log_error "Commit failed after squash."
                return 1
            }
            ;;
        *)
            git merge "$PLAN_BRANCH" -m "Complete plan: $PLAN_ID" || {
                log_error "Merge failed. Resolve conflicts manually."
                return 1
            }
            ;;
    esac

    log_success "Plan branch merged to $BASE_BRANCH"
}

#####################################################################
# Remove Worktree
#####################################################################

remove_worktree() {
    if [ ! -d "$WORKTREE_PATH" ]; then
        log "Worktree not found, nothing to remove"
        return 0
    fi

    log "Removing worktree..."

    cd "$PROJECT_ROOT"

    # Check for uncommitted changes
    if [ -d "$WORKTREE_PATH" ]; then
        cd "$WORKTREE_PATH"
        if ! git diff-index --quiet HEAD 2>/dev/null; then
            log_warning "Worktree has uncommitted changes"
            read -p "Force removal? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Keeping worktree"
                cd "$PROJECT_ROOT"
                return 0
            fi
        fi
        cd "$PROJECT_ROOT"
    fi

    # Remove worktree
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || {
        log_warning "git worktree remove failed, removing manually"
        rm -rf "$WORKTREE_PATH"
        git worktree prune
    }

    log_success "Worktree removed"
}

#####################################################################
# Delete Plan Branch
#####################################################################

delete_plan_branch() {
    if [ "$KEEP_BRANCH" = true ]; then
        log "Keeping plan branch (--keep-branch specified)"
        return 0
    fi

    # Check if branch exists
    if ! git show-ref --verify --quiet "refs/heads/$PLAN_BRANCH"; then
        log "Plan branch $PLAN_BRANCH already deleted"
        return 0
    fi

    log "Deleting plan branch $PLAN_BRANCH..."

    # Can't delete current branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" = "$PLAN_BRANCH" ]; then
        git checkout "$BASE_BRANCH"
    fi

    git branch -d "$PLAN_BRANCH" 2>/dev/null || {
        log_warning "Branch not fully merged, force deleting"
        git branch -D "$PLAN_BRANCH"
    }

    log_success "Plan branch deleted"
}

#####################################################################
# Cleanup Lock Files
#####################################################################

cleanup_locks() {
    if [ -d "$PLAN_DIR/locks" ]; then
        log "Cleaning up lock files..."
        rm -rf "$PLAN_DIR/locks"
        log_success "Lock files cleaned"
    fi

    if [ -d "$PLAN_DIR/worktree.lock" ]; then
        rm -rf "$PLAN_DIR/worktree.lock"
    fi
}

#####################################################################
# Main
#####################################################################

main() {
    log "Cleaning up plan: $PLAN_ID"
    echo ""

    validate_input

    # Make sure we're in project root
    cd "$PROJECT_ROOT"

    # Stop services first
    stop_services

    # Merge plan branch to base
    merge_plan_branch

    # Remove worktree
    remove_worktree

    # Delete plan branch
    delete_plan_branch

    # Cleanup locks
    cleanup_locks

    echo ""
    log_success "Cleanup complete for $PLAN_ID"
    echo ""
    echo "Summary:"
    echo "  - Docker services stopped and removed"
    if [ "$NO_MERGE" = false ]; then
        echo "  - Plan branch merged to $BASE_BRANCH"
    fi
    echo "  - Worktree removed"
    if [ "$KEEP_BRANCH" = false ]; then
        echo "  - Plan branch deleted"
    fi
}

main
