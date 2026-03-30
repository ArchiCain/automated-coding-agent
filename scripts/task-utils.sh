#!/bin/bash
# scripts/task-utils.sh
# Shared utility functions for task execution

#####################################################################
# Repository Path Resolution
#####################################################################

# Gets the main repository root, even when called from within a worktree
# This ensures all scripts reference the same .backlog directory
get_main_repo_root() {
    # Get the common git directory (shared across worktrees)
    local git_common_dir=$(git rev-parse --git-common-dir 2>/dev/null)

    if [ -n "$git_common_dir" ] && [ "$git_common_dir" != ".git" ]; then
        # We're in a worktree - get the main repo root
        # git-common-dir points to .git in main repo
        local main_repo=$(dirname "$git_common_dir")
        echo "$main_repo"
    else
        # We're in the main repo
        echo "$(git rev-parse --show-toplevel)"
    fi
}

#####################################################################
# Docker Requirement Detection
#####################################################################

# Determines if a task requires Docker services
# Uses heuristics based on task name and explicit metadata
task_needs_docker() {
    local plan_id=$1
    local task_id=$2
    local tasks_file="${3:-.backlog/$plan_id/tasks.jsonl}"

    # Check explicit metadata first
    local requires=$(jq -r "select(.id == \"$task_id\") | .requiresDocker // \"auto\"" "$tasks_file" 2>/dev/null)

    if [ "$requires" = "true" ]; then
        return 0  # Explicitly requires Docker
    elif [ "$requires" = "false" ]; then
        return 1  # Explicitly does not require Docker
    fi

    # Auto-detect based on task name
    local task_name=$(jq -r "select(.id == \"$task_id\") | .name" "$tasks_file" 2>/dev/null)

    # Integration tests need Docker
    if echo "$task_name" | grep -qiE "(integration test|integration spec)"; then
        return 0
    fi

    # E2E tests need Docker
    if echo "$task_name" | grep -qiE "(e2e|end-to-end|e2e test|e2e spec)"; then
        return 0
    fi

    # API/endpoint tests need Docker
    if echo "$task_name" | grep -qiE "(api test|endpoint test|rest test|graphql test)"; then
        return 0
    fi

    # WebSocket tests need Docker
    if echo "$task_name" | grep -qiE "(websocket test|ws test|socket test)"; then
        return 0
    fi

    # Database-related tests need Docker
    if echo "$task_name" | grep -qiE "(database test|db test|migration test|schema test)"; then
        return 0
    fi

    # Contract tests need Docker
    if echo "$task_name" | grep -qiE "(contract test|pact test)"; then
        return 0
    fi

    # System tests need Docker
    if echo "$task_name" | grep -qiE "(system test|full stack test)"; then
        return 0
    fi

    # Default: most tasks don't need Docker
    return 1
}

#####################################################################
# Task Status Updates with Atomic Locking
#####################################################################

# Atomically updates task status in tasks.jsonl
# Uses flock to prevent concurrent write corruption
atomic_update_task_status() {
    local plan_id=$1
    local task_id=$2
    local new_status=$3
    local extra_jq="${4:-}"
    local tasks_file="${5:-.backlog/$plan_id/tasks.jsonl}"
    local lock_file="${6:-.backlog/$plan_id/tasks.jsonl.lock}"

    # Build jq expression
    local jq_expr="if .id == \"$task_id\" then .status = \"$new_status\" | .updated = \"$(date -Iseconds)\""

    if [ -n "$extra_jq" ]; then
        jq_expr="$jq_expr | $extra_jq"
    fi

    jq_expr="$jq_expr else . end"

    # Atomic update with flock
    (
        flock -x 200 || exit 1

        # Read, transform, write atomically
        jq "$jq_expr" "$tasks_file" > "${tasks_file}.tmp" || exit 1
        mv "${tasks_file}.tmp" "$tasks_file" || exit 1

    ) 200>"$lock_file"

    return $?
}

#####################################################################
# Worktree Management
#####################################################################

# Creates a task-specific worktree from the plan branch
create_task_worktree() {
    local plan_id=$1
    local task_id=$2
    local project_root=$3

    local worktree_base=".worktrees"
    local task_worktree="$project_root/$worktree_base/$plan_id-t-$task_id"
    local task_branch="$plan_id-t-$task_id"
    local plan_branch="$plan_id"

    # Check if worktree already exists
    if [ -d "$task_worktree" ]; then
        echo "Task worktree already exists: $task_worktree"
        return 0
    fi

    # Check if plan branch exists
    if ! git rev-parse --verify "$plan_branch" >/dev/null 2>&1; then
        echo "Error: Plan branch $plan_branch does not exist"
        return 1
    fi

    # Create task branch and worktree
    if ! git worktree add "$task_worktree" -b "$task_branch" "$plan_branch" 2>&1; then
        echo "Error: Failed to create task worktree"
        return 1
    fi

    echo "Created task worktree: $task_worktree"
    echo "  Branch: $task_branch"
    echo "  Base: $plan_branch"

    return 0
}

# Cleans up a task worktree after completion
cleanup_task_worktree() {
    local plan_id=$1
    local task_id=$2
    local project_root=$3

    local worktree_base=".worktrees"
    local task_worktree="$project_root/$worktree_base/$plan_id-t-$task_id"

    if [ ! -d "$task_worktree" ]; then
        return 0  # Already cleaned up
    fi

    # Remove worktree
    git worktree remove "$task_worktree" --force 2>&1 || {
        echo "Warning: Failed to remove worktree, cleaning manually"
        rm -rf "$task_worktree"
        git worktree prune
    }

    echo "Cleaned up task worktree: $task_worktree"
    return 0
}

#####################################################################
# Export Functions
#####################################################################

# Make functions available to scripts that source this file
export -f get_main_repo_root
export -f task_needs_docker
export -f atomic_update_task_status
export -f create_task_worktree
export -f cleanup_task_worktree
