#!/usr/bin/env bash

#####################################################################
# Destroy Git Worktree
#
# This script safely tears down a git worktree by:
# - Checking for uncommitted changes (with user confirmation)
# - Stopping all services gracefully
# - Removing containers and volumes
# - Removing the worktree
# - Optionally deleting the branch
#
# Usage: ./scripts/destroy-worktree.sh <worktree-name>
# Example: ./scripts/destroy-worktree.sh feature/my-feature
#
# Or via Task: task worktree:destroy -- feature/my-feature
#####################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#####################################################################
# Helper Functions
#####################################################################

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

#####################################################################
# Input Validation
#####################################################################

WORKTREE_NAME="${1:-}"

if [ -z "$WORKTREE_NAME" ]; then
    print_error "Worktree name is required"
    echo ""
    echo "Usage: $0 <worktree-name>"
    echo "Example: $0 feature/my-feature"
    echo ""
    echo "Available worktrees:"
    git worktree list
    exit 1
fi

#####################################################################
# Find Worktree
#####################################################################

# Find worktree path
WORKTREE_PATH=$(git worktree list | grep "$WORKTREE_NAME" | awk '{print $1}' || echo "")

if [ -z "$WORKTREE_PATH" ]; then
    print_error "Worktree '$WORKTREE_NAME' not found"
    echo ""
    echo "Available worktrees:"
    git worktree list
    exit 1
fi

print_header "🗑️  Destroying Worktree: $WORKTREE_NAME"

echo "📍 Path: $WORKTREE_PATH"
echo ""

#####################################################################
# Check for Uncommitted Changes
#####################################################################

cd "$WORKTREE_PATH"

if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    print_warning "Uncommitted changes detected!"
    echo ""
    git status --short
    echo ""
    read -p "Continue with destruction? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Aborted by user"
        exit 0
    fi
fi

#####################################################################
# Stop Services
#####################################################################

echo ""
echo "🛑 Stopping services..."

# Get compose project name from .env if it exists
if [ -f ".env" ]; then
    COMPOSE_PROJECT_NAME=$(grep "^COMPOSE_PROJECT_NAME=" .env | cut -d '=' -f2)
fi

if task stop-local > /dev/null 2>&1; then
    print_success "Services stopped"
else
    print_warning "No services running or already stopped"
fi

#####################################################################
# Purge Containers and Volumes
#####################################################################

echo ""
echo "🧹 Removing containers and volumes..."

if task purge-local > /dev/null 2>&1; then
    print_success "Containers and volumes removed"
else
    print_warning "Nothing to purge or already cleaned"
fi

# Double-check for any remaining containers
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    echo "🔍 Checking for any remaining containers..."
    REMAINING=$(docker ps -a --filter "label=com.docker.compose.project=$COMPOSE_PROJECT_NAME" -q)
    if [ -n "$REMAINING" ]; then
        print_warning "Found remaining containers, removing..."
        docker rm -f $REMAINING
        print_success "Remaining containers removed"
    fi
fi

#####################################################################
# Return to Main Worktree
#####################################################################

# Get the main worktree path
MAIN_WORKTREE=$(git worktree list | head -1 | awk '{print $1}')
cd "$MAIN_WORKTREE"

print_success "Returned to main worktree: $MAIN_WORKTREE"

#####################################################################
# Remove Worktree
#####################################################################

echo ""
echo "🗑️  Removing worktree..."

if git worktree remove "$WORKTREE_PATH" --force; then
    print_success "Worktree removed"
else
    print_error "Failed to remove worktree"
    echo ""
    echo "You may need to remove it manually:"
    echo "  git worktree remove $WORKTREE_PATH --force"
    echo ""
    echo "Or remove the directory and prune worktrees:"
    echo "  rm -rf $WORKTREE_PATH"
    echo "  git worktree prune"
    exit 1
fi

#####################################################################
# Optionally Delete Branch
#####################################################################

echo ""
read -p "Delete branch '$WORKTREE_NAME'? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if git branch -D "$WORKTREE_NAME" 2>/dev/null; then
        print_success "Branch deleted"
    else
        print_warning "Branch may have already been deleted or doesn't exist"
    fi
else
    print_info "Branch '$WORKTREE_NAME' preserved"
fi

#####################################################################
# Success Report
#####################################################################

print_header "✅ WORKTREE DESTROYED SUCCESSFULLY"

echo "Remaining worktrees:"
git worktree list
echo ""

if git branch | grep -q "$WORKTREE_NAME"; then
    echo "Branch status: Preserved (not deleted)"
else
    echo "Branch status: Deleted"
fi

echo ""
print_success "Worktree cleanup complete!"
print_header ""
