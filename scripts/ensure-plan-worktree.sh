#!/usr/bin/env bash

#####################################################################
# Ensure Plan Worktree Exists
#
# Idempotent script that ensures a plan worktree exists and is healthy.
# Creates the worktree if it doesn't exist, repairs if unhealthy.
#
# Usage: ./scripts/ensure-plan-worktree.sh <plan-id>
# Example: ./scripts/ensure-plan-worktree.sh p-a075b3
#
# Features:
# - Idempotent: safe to call multiple times
# - Lock-based: prevents concurrent creation
# - Health-aware: verifies or repairs Docker stack
# - Port isolation: unique ports per plan
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
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    WORKTREE_BASE_DIR=$(jq -r '.worktree.baseDir // ".worktrees"' "$CONFIG_FILE")
    PORT_OFFSET_BASE=$(jq -r '.worktree.portOffsetBase // 100' "$CONFIG_FILE")
    BASE_BRANCH=$(jq -r '.baseBranch // "main"' "$CONFIG_FILE")
    BASE_BACKEND_PORT=$(jq -r '.ports.backend // 8085' "$CONFIG_FILE")
    BASE_KEYCLOAK_PORT=$(jq -r '.ports.keycloak // 8081' "$CONFIG_FILE")
    BASE_FRONTEND_PORT=$(jq -r '.ports.frontend // 3000' "$CONFIG_FILE")
    BASE_DATABASE_PORT=$(jq -r '.ports.database // 5437' "$CONFIG_FILE")
else
    WORKTREE_BASE_DIR=".worktrees"
    PORT_OFFSET_BASE=100
    BASE_BRANCH="main"
    BASE_BACKEND_PORT=8085
    BASE_KEYCLOAK_PORT=8081
    BASE_FRONTEND_PORT=3000
    BASE_DATABASE_PORT=5437
fi

WORKTREE_PATH="$PROJECT_ROOT/$WORKTREE_BASE_DIR/$PLAN_ID"
PLAN_BRANCH="$PLAN_ID"
PLAN_DIR="$PROJECT_ROOT/.backlog/$PLAN_ID"
LOCK_FILE="$PLAN_DIR/worktree.lock"

#####################################################################
# Helper Functions
#####################################################################

log() {
    echo -e "${BLUE}[ensure-worktree]${NC} $1"
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
        echo "Usage: $0 <plan-id>"
        echo "Example: $0 p-a075b3"
        exit 1
    fi

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check if plan directory exists
    if [ ! -d "$PLAN_DIR" ]; then
        log_error "Plan directory not found: $PLAN_DIR"
        exit 1
    fi

    # Check required tools
    for tool in git jq docker curl; do
        if ! command -v $tool &> /dev/null; then
            log_error "$tool is not installed"
            exit 1
        fi
    done
}

#####################################################################
# Lock Management
#####################################################################

acquire_lock() {
    log "Acquiring worktree lock..."

    # Create plan directory if needed
    mkdir -p "$PLAN_DIR"

    # Try to acquire lock (atomic directory creation)
    local attempts=0
    local max_attempts=30  # 60 seconds max wait

    while ! mkdir "$LOCK_FILE" 2>/dev/null; do
        attempts=$((attempts + 1))
        if [ $attempts -ge $max_attempts ]; then
            log_error "Could not acquire lock after 60 seconds"
            exit 1
        fi
        log "Waiting for worktree lock... ($attempts/$max_attempts)"
        sleep 2
    done

    # Set up trap to release lock on exit
    trap "rm -rf '$LOCK_FILE'" EXIT
    log_success "Lock acquired"
}

#####################################################################
# Port Calculation
#####################################################################

calculate_port_offset() {
    # Count existing plan worktrees to determine port offset
    local worktree_count=0

    if [ -d "$PROJECT_ROOT/$WORKTREE_BASE_DIR" ]; then
        # Use find instead of ls to avoid errors when no matches exist
        worktree_count=$(find "$PROJECT_ROOT/$WORKTREE_BASE_DIR" -maxdepth 1 -type d -name "p-*" 2>/dev/null | wc -l | tr -d ' ')
    fi

    # Each new worktree gets the next available offset
    PORT_OFFSET=$((worktree_count * PORT_OFFSET_BASE))

    # Calculate actual ports
    BACKEND_PORT=$((BASE_BACKEND_PORT + PORT_OFFSET))
    KEYCLOAK_PORT=$((BASE_KEYCLOAK_PORT + PORT_OFFSET))
    FRONTEND_PORT=$((BASE_FRONTEND_PORT + PORT_OFFSET))
    DATABASE_PORT=$((BASE_DATABASE_PORT + PORT_OFFSET))

    log "Port offset: $PORT_OFFSET"
    log "  Backend:  $BACKEND_PORT"
    log "  Keycloak: $KEYCLOAK_PORT"
    log "  Frontend: $FRONTEND_PORT"
    log "  Database: $DATABASE_PORT"
}

#####################################################################
# Worktree Health Check
#####################################################################

check_worktree_health() {
    if [ ! -d "$WORKTREE_PATH" ]; then
        return 1
    fi

    # Check if .env exists
    if [ ! -f "$WORKTREE_PATH/.env" ]; then
        log_warning "Missing .env file in worktree"
        return 1
    fi

    # Source the worktree's .env
    source "$WORKTREE_PATH/.env"

    # Check Docker services
    local healthy=true

    # Check database
    if ! docker exec "${COMPOSE_PROJECT_NAME:-$PLAN_ID}-database-1" pg_isready -U postgres > /dev/null 2>&1; then
        log_warning "Database not healthy"
        healthy=false
    fi

    # Check backend
    if ! curl -sf "http://localhost:${BACKEND_PORT:-8085}/health" > /dev/null 2>&1; then
        log_warning "Backend not healthy"
        healthy=false
    fi

    if [ "$healthy" = true ]; then
        return 0
    else
        return 1
    fi
}

#####################################################################
# Worktree Creation
#####################################################################

create_worktree() {
    log "Creating worktree at $WORKTREE_PATH..."

    # Create base directory
    mkdir -p "$PROJECT_ROOT/$WORKTREE_BASE_DIR"

    # Ensure .worktrees is in .gitignore
    if ! grep -q "^$WORKTREE_BASE_DIR/" "$PROJECT_ROOT/.gitignore" 2>/dev/null; then
        log "Adding $WORKTREE_BASE_DIR/ to .gitignore"
        echo "" >> "$PROJECT_ROOT/.gitignore"
        echo "# Plan worktrees (managed by ensure-plan-worktree.sh)" >> "$PROJECT_ROOT/.gitignore"
        echo "$WORKTREE_BASE_DIR/" >> "$PROJECT_ROOT/.gitignore"
    fi

    # Check if branch exists
    if git show-ref --verify --quiet "refs/heads/$PLAN_BRANCH"; then
        log "Branch $PLAN_BRANCH exists, checking out"
        git worktree add "$WORKTREE_PATH" "$PLAN_BRANCH"
    else
        log "Creating new branch $PLAN_BRANCH from $BASE_BRANCH"
        git worktree add "$WORKTREE_PATH" -b "$PLAN_BRANCH" "$BASE_BRANCH"
    fi

    log_success "Worktree created"
}

#####################################################################
# Environment Configuration
#####################################################################

configure_environment() {
    log "Configuring environment..."

    cd "$WORKTREE_PATH"

    # Copy .env from project root
    if [ -f "$PROJECT_ROOT/.env" ]; then
        cp "$PROJECT_ROOT/.env" "$WORKTREE_PATH/.env"
    else
        log_error ".env file not found in project root"
        exit 1
    fi

    # Sanitize plan ID for compose project name
    COMPOSE_PROJECT_NAME=$(echo "$PLAN_ID" | tr '/' '-' | tr '.' '-')

    # Update ports and project name in .env
    # Use .bak extension to ensure compatibility across platforms
    sed -i.bak "s/^BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" .env
    sed -i.bak "s/^KEYCLOAK_PORT=.*/KEYCLOAK_PORT=$KEYCLOAK_PORT/" .env
    sed -i.bak "s/^FRONTEND_PORT=.*/FRONTEND_PORT=$FRONTEND_PORT/" .env
    sed -i.bak "s/^DATABASE_PORT=.*/DATABASE_PORT=$DATABASE_PORT/" .env
    sed -i.bak "s|^VITE_BACKEND_URL=.*|VITE_BACKEND_URL=http://localhost:$BACKEND_PORT|" .env
    sed -i.bak "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:$FRONTEND_PORT|" .env
    sed -i.bak "s/^COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME/" .env
    rm -f .env.bak

    # Add COMPOSE_PROJECT_NAME if it doesn't exist
    if ! grep -q "^COMPOSE_PROJECT_NAME=" .env; then
        echo "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME" >> .env
    fi

    log_success "Environment configured"
    log "  COMPOSE_PROJECT_NAME: $COMPOSE_PROJECT_NAME"
}

#####################################################################
# Dependency Installation
#####################################################################

install_dependencies() {
    log "Installing dependencies..."

    cd "$WORKTREE_PATH"

    # Check if node_modules exists (skip if already installed)
    if [ -d "projects/backend/app/node_modules" ] && [ -d "projects/frontend/app/node_modules" ]; then
        log "Dependencies already installed, skipping"
        return 0
    fi

    # Install backend dependencies
    log "Installing backend dependencies..."
    if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
        task backend:local:install 2>&1 || {
            log_warning "task backend:local:install failed, trying npm directly"
            cd projects/backend/app && npm install && cd "$WORKTREE_PATH"
        }
    else
        cd projects/backend/app && npm install && cd "$WORKTREE_PATH"
    fi

    # Install frontend dependencies
    log "Installing frontend dependencies..."
    if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
        task frontend:local:install 2>&1 || {
            log_warning "task frontend:local:install failed, trying npm directly"
            cd projects/frontend/app && npm install && cd "$WORKTREE_PATH"
        }
    else
        cd projects/frontend/app && npm install && cd "$WORKTREE_PATH"
    fi

    log_success "Dependencies installed"
}

#####################################################################
# Docker Stack Management
#####################################################################

start_services() {
    log "Starting Docker services..."

    cd "$WORKTREE_PATH"

    if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
        task start-local 2>&1 || {
            log_warning "task start-local failed, trying docker compose directly"
            cd projects && docker compose up -d && cd "$WORKTREE_PATH"
        }
    else
        cd projects && docker compose up -d && cd "$WORKTREE_PATH"
    fi

    log_success "Services starting"
    log "Waiting for services to be ready..."
    sleep 15
}

wait_for_health() {
    local max_attempts=60
    local attempt=0

    log "Waiting for services to be healthy..."

    # Source .env for ports
    source "$WORKTREE_PATH/.env"

    while [ $attempt -lt $max_attempts ]; do
        # Check database
        if docker exec "${COMPOSE_PROJECT_NAME}-database-1" pg_isready -U postgres > /dev/null 2>&1; then
            # Check backend
            if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
                log_success "All services healthy!"
                return 0
            fi
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    echo ""
    log_error "Services failed to become healthy after 2 minutes"
    return 1
}

#####################################################################
# Repair Unhealthy Worktree
#####################################################################

repair_worktree() {
    log_warning "Attempting to repair unhealthy worktree..."

    cd "$WORKTREE_PATH"
    source .env

    # Stop services
    if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
        task stop-local 2>&1 || true
    else
        cd projects && docker compose down 2>&1 || true
        cd "$WORKTREE_PATH"
    fi

    sleep 5

    # Start services
    start_services

    if wait_for_health; then
        log_success "Worktree repaired"
        return 0
    else
        log_error "Could not repair worktree"
        return 1
    fi
}

#####################################################################
# Main Execution
#####################################################################

main() {
    log "Ensuring worktree for plan: $PLAN_ID"

    # Change to project root
    cd "$PROJECT_ROOT"

    # Validate input
    validate_input

    # Check if worktree already exists and is healthy
    if [ -d "$WORKTREE_PATH" ]; then
        log "Worktree exists, checking health..."

        if check_worktree_health; then
            log_success "Worktree exists and is healthy"
            echo "$WORKTREE_PATH"
            exit 0
        fi

        log_warning "Worktree exists but is unhealthy"

        # Try to repair
        if repair_worktree; then
            echo "$WORKTREE_PATH"
            exit 0
        fi

        log_error "Could not repair worktree"
        exit 1
    fi

    # Create new worktree
    acquire_lock
    calculate_port_offset
    create_worktree
    configure_environment
    install_dependencies
    start_services

    if wait_for_health; then
        log_success "Worktree ready: $WORKTREE_PATH"
        echo ""
        echo "Services running:"
        echo "  Backend:  http://localhost:$BACKEND_PORT"
        echo "  Keycloak: http://localhost:$KEYCLOAK_PORT"
        echo "  Frontend: http://localhost:$FRONTEND_PORT"
        echo "  Database: localhost:$DATABASE_PORT"
        echo ""
        echo "$WORKTREE_PATH"
        exit 0
    else
        log_error "Failed to start services"
        exit 1
    fi
}

# Run main
main
