#!/usr/bin/env bash

#####################################################################
# Ensure Plan Docker Services
#
# Idempotent script that ensures Docker services are running for a plan.
# Multiple task worktrees can call this - it starts services once and keeps them running.
#
# Usage: ./scripts/ensure-plan-docker.sh <plan-id>
# Example: ./scripts/ensure-plan-docker.sh p-a075b3
#
# Features:
# - Idempotent: safe to call multiple times
# - Lock-based: prevents concurrent startup
# - Health checks: verifies services are actually ready
# - Shared: one set of services per plan, used by all tasks
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

# Get main repo root (works from main repo or worktree)
if command -v git &> /dev/null && git rev-parse --git-dir > /dev/null 2>&1; then
    GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
    if [ -n "$GIT_COMMON_DIR" ] && [ "$GIT_COMMON_DIR" != ".git" ]; then
        PROJECT_ROOT=$(dirname "$GIT_COMMON_DIR")
    else
        PROJECT_ROOT=$(git rev-parse --show-toplevel)
    fi
else
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
fi

CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    BASE_BACKEND_PORT=$(jq -r '.ports.backend // 8085' "$CONFIG_FILE")
    BASE_KEYCLOAK_PORT=$(jq -r '.ports.keycloak // 8081' "$CONFIG_FILE")
    BASE_FRONTEND_PORT=$(jq -r '.ports.frontend // 3000' "$CONFIG_FILE")
    BASE_DATABASE_PORT=$(jq -r '.ports.database // 5437' "$CONFIG_FILE")
else
    BASE_BACKEND_PORT=8085
    BASE_KEYCLOAK_PORT=8081
    BASE_FRONTEND_PORT=3000
    BASE_DATABASE_PORT=5437
fi

PLAN_DIR="$PROJECT_ROOT/.backlog/$PLAN_ID"
DOCKER_LOCK="$PLAN_DIR/docker.lock"
DOCKER_STATE="$PLAN_DIR/docker-state.json"

# Sanitize plan ID for compose project name (replace dots with underscores)
COMPOSE_PROJECT_NAME=$(echo "$PLAN_ID" | sed 's/\./_/g')

#####################################################################
# Helper Functions
#####################################################################

log() {
    echo -e "${BLUE}[plan-docker]${NC} $1"
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

    if [ ! -d "$PLAN_DIR" ]; then
        log_error "Plan directory not found: $PLAN_DIR"
        exit 1
    fi

    # Check required tools
    for tool in docker jq curl; do
        if ! command -v $tool &> /dev/null; then
            log_error "$tool is required but not installed"
            exit 1
        fi
    done
}

#####################################################################
# Docker Health Checks
#####################################################################

check_services_running() {
    # Quick check: are containers running?
    if ! docker ps --format '{{.Names}}' | grep -q "^${COMPOSE_PROJECT_NAME}-database-1$"; then
        return 1
    fi

    if ! docker ps --format '{{.Names}}' | grep -q "^${COMPOSE_PROJECT_NAME}-backend$"; then
        return 1
    fi

    return 0
}

check_services_healthy() {
    log "Checking service health..."

    # Database health
    if ! docker exec "${COMPOSE_PROJECT_NAME}-database-1" pg_isready -U postgres > /dev/null 2>&1; then
        log_warning "Database not ready"
        return 1
    fi

    # Backend health
    if ! curl -f -s "http://localhost:${BASE_BACKEND_PORT}/health" > /dev/null 2>&1; then
        log_warning "Backend not ready"
        return 1
    fi

    # Keycloak health
    if ! curl -f -s "http://localhost:${BASE_KEYCLOAK_PORT}/health" > /dev/null 2>&1; then
        log_warning "Keycloak not ready"
        return 1
    fi

    # Frontend health
    if ! curl -f -s "http://localhost:${BASE_FRONTEND_PORT}" > /dev/null 2>&1; then
        log_warning "Frontend not ready"
        return 1
    fi

    return 0
}

wait_for_services() {
    local max_wait=120
    local waited=0

    log "Waiting for services to be healthy..."

    while [ $waited -lt $max_wait ]; do
        if check_services_healthy; then
            log_success "All services healthy!"
            return 0
        fi

        echo -n "."
        sleep 2
        waited=$((waited + 2))
    done

    log_error "Services did not become healthy after ${max_wait}s"
    return 1
}

#####################################################################
# Docker Management
#####################################################################

start_docker_services() {
    log "Starting Docker services for plan: $PLAN_ID"
    log "Compose project name: $COMPOSE_PROJECT_NAME"

    # Export env vars for docker compose
    export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT_NAME"
    export DATABASE_PORT="$BASE_DATABASE_PORT"
    export BACKEND_PORT="$BASE_BACKEND_PORT"
    export KEYCLOAK_PORT="$BASE_KEYCLOAK_PORT"
    export FRONTEND_PORT="$BASE_FRONTEND_PORT"

    # Start services
    cd "$PROJECT_ROOT/projects"

    if command -v task &> /dev/null && task -l | grep -q "start-local"; then
        log "Using task start-local..."
        if ! task start-local 2>&1; then
            log_warning "task start-local failed, trying docker compose directly"
            docker compose up -d
        fi
    else
        log "Using docker compose directly..."
        docker compose up -d
    fi

    cd "$PROJECT_ROOT"

    # Wait for health
    if ! wait_for_services; then
        log_error "Failed to start healthy services"
        return 1
    fi

    # Save state
    cat > "$DOCKER_STATE" << EOF
{
  "planId": "$PLAN_ID",
  "composeProjectName": "$COMPOSE_PROJECT_NAME",
  "startedAt": "$(date -Iseconds)",
  "ports": {
    "database": $BASE_DATABASE_PORT,
    "backend": $BASE_BACKEND_PORT,
    "keycloak": $BASE_KEYCLOAK_PORT,
    "frontend": $BASE_FRONTEND_PORT
  },
  "status": "running"
}
EOF

    log_success "Docker services started and healthy"
    log "  Database:  localhost:${BASE_DATABASE_PORT}"
    log "  Backend:   http://localhost:${BASE_BACKEND_PORT}"
    log "  Keycloak:  http://localhost:${BASE_KEYCLOAK_PORT}"
    log "  Frontend:  http://localhost:${BASE_FRONTEND_PORT}"

    return 0
}

#####################################################################
# Main Execution
#####################################################################

validate_input

log "Ensuring Docker services for plan: $PLAN_ID"

# Quick check: are services already running and healthy?
if check_services_running; then
    log "Services already running, checking health..."

    if check_services_healthy; then
        log_success "Docker services already running and healthy"
        exit 0
    else
        log_warning "Services running but not healthy, restarting..."
    fi
fi

# Acquire lock to start services
log "Acquiring Docker startup lock..."

# Create lock directory (atomic operation)
if ! mkdir "$DOCKER_LOCK" 2>/dev/null; then
    # Another process has the lock, wait for it
    log "Another process is starting Docker, waiting..."

    max_wait=60
    waited=0
    while [ -d "$DOCKER_LOCK" ] && [ $waited -lt $max_wait ]; do
        sleep 2
        waited=$((waited + 2))
    done

    if [ -d "$DOCKER_LOCK" ]; then
        log_error "Lock held too long, removing stale lock"
        rm -rf "$DOCKER_LOCK"
    fi

    # Check if services are now running
    if check_services_running && check_services_healthy; then
        log_success "Services started by other process"
        exit 0
    fi

    # Re-acquire lock
    if ! mkdir "$DOCKER_LOCK" 2>/dev/null; then
        log_error "Failed to acquire lock after waiting"
        exit 1
    fi
fi

log_success "Lock acquired"

# Ensure lock is released on exit
trap "rm -rf '$DOCKER_LOCK'" EXIT

# Double-check inside lock (prevent race condition)
if check_services_running && check_services_healthy; then
    log_success "Services already running (race condition avoided)"
    exit 0
fi

# Start services
if ! start_docker_services; then
    log_error "Failed to start Docker services"
    exit 1
fi

log_success "Docker services ready for plan: $PLAN_ID"
exit 0
