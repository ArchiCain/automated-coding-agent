#!/bin/bash
# Test script for get_main_repo_root function

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/task-utils.sh"

echo "Testing Repository Root Resolution"
echo "═══════════════════════════════════════════════════════"
echo ""

# Test 1: From main repo
echo "Test 1: From main repository"
MAIN_ROOT=$(get_main_repo_root)
echo "  Current directory: $(pwd)"
echo "  Main repo root: $MAIN_ROOT"
echo ""

# Test 2: Check if in worktree
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
if [ "$GIT_COMMON_DIR" != ".git" ]; then
    echo "  Status: Currently in a worktree"
else
    echo "  Status: Currently in main repository"
fi
echo ""

# Test 3: Verify .backlog accessibility
BACKLOG_PATH="$MAIN_ROOT/.backlog"
if [ -d "$BACKLOG_PATH" ]; then
    echo "✓ .backlog directory accessible at: $BACKLOG_PATH"
    ls -la "$BACKLOG_PATH" | head -5
else
    echo "✗ .backlog directory not found at: $BACKLOG_PATH"
fi
echo ""

echo "═══════════════════════════════════════════════════════"
echo "Test complete!"
echo ""
echo "To test from a worktree:"
echo "  1. Create a test worktree: git worktree add .worktrees/test -b test-branch"
echo "  2. cd .worktrees/test"
echo "  3. ../../scripts/test-repo-root-resolution.sh"
