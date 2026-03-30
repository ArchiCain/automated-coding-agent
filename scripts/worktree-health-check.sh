#!/usr/bin/env bash

#####################################################################
# Worktree Health Check
#
# Verifies that a plan worktree's Docker stack is healthy.
# Optionally repairs unhealthy services.
#
# Usage: ./scripts/worktree-health-check.sh <plan-id> [--repair]
# Example: ./scripts/worktree-health-check.sh p-a075b3
#          ./scripts/worktree-health-check.sh p-a075b3 --repair
#
# Exit codes:
#   0 - Healthy (or repaired successfully)
#   1 - Unhealthy (and repair not requested or failed)
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
REPAIR="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PROJECT_ROOT/.claude/execution-config.json"

# Load configuration
if [ -f "$CONFIG_FILE" ]; then
    WORKTREE_BASE_DIR=$(jq -r '.worktree.baseDir // ".worktrees"' "$CONFIG_FILE")
else
    WORKTREE_BASE_DIR=".worktrees"
fi

WORKTREE_PATH="$PROJECT_ROOT/$WORKTREE_BASE_DIR/$PLAN_ID"

#####################################################################
# Helper Functions
#####################################################################

log() {
    echo -e "${BLUE}[health-check]${NC} $1"
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
        echo "Usage: $0 <plan-id> [--repair]"
        echo "Example: $0 p-a075b3"
        echo "         $0 p-a075b3 --repair"
        exit 1
    fi

    if [ ! -d "$WORKTREE_PATH" ]; then
        log_error "Worktree not found: $WORKTREE_PATH"
        exit 1
    fi

    if [ ! -f "$WORKTREE_PATH/.env" ]; then
        log_error ".env file not found in worktree"
        exit 1
    fi
}

#####################################################################
# Health Checks
#####################################################################

check_database() {
    local compose_project="$1"

    if docker exec "${compose_project}-database-1" pg_isready -U postgres > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_backend() {
    local port="$1"

    if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_keycloak() {
    local port="$1"

    if curl -sf "http://localhost:$port/health" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

check_frontend() {
    local port="$1"

    if curl -sf "http://localhost:$port" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

run_health_checks() {
    local healthy=true
    local status=""

    # Source .env for configuration
    source "$WORKTREE_PATH/.env"

    local compose_project="${COMPOSE_PROJECT_NAME:-$PLAN_ID}"

    log "Checking services for $compose_project..."

    # Database
    if check_database "$compose_project"; then
        status="$status\n  ${GREEN}✓${NC} Database (localhost:$DATABASE_PORT)"
    else
        status="$status\n  ${RED}✗${NC} Database (localhost:$DATABASE_PORT)"
        healthy=false
    fi

    # Backend
    if check_backend "$BACKEND_PORT"; then
        status="$status\n  ${GREEN}✓${NC} Backend (http://localhost:$BACKEND_PORT)"
    else
        status="$status\n  ${RED}✗${NC} Backend (http://localhost:$BACKEND_PORT)"
        healthy=false
    fi

    # Keycloak (optional - may not be running)
    if check_keycloak "$KEYCLOAK_PORT"; then
        status="$status\n  ${GREEN}✓${NC} Keycloak (http://localhost:$KEYCLOAK_PORT)"
    else
        status="$status\n  ${YELLOW}?${NC} Keycloak (http://localhost:$KEYCLOAK_PORT) - may be optional"
    fi

    # Frontend (optional - may not be running)
    if check_frontend "$FRONTEND_PORT"; then
        status="$status\n  ${GREEN}✓${NC} Frontend (http://localhost:$FRONTEND_PORT)"
    else
        status="$status\n  ${YELLOW}?${NC} Frontend (http://localhost:$FRONTEND_PORT) - may be optional"
    fi

    echo -e "$status"

    if [ "$healthy" = true ]; then
        return 0
    else
        return 1
    fi
}

#####################################################################
# Repair
#####################################################################

repair_services() {
    log "Attempting to repair services..."

    cd "$WORKTREE_PATH"
    source .env

    # Stop services
    log "Stopping services..."
    if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
        task stop-local 2>&1 || true
    else
        cd projects && docker compose down 2>&1 || true
        cd "$WORKTREE_PATH"
    fi

    sleep 5

    # Start services
    log "Starting services..."
    if [ -f "Taskfile.yml" ] && command -v task &> /dev/null; then
        task start-local 2>&1 || {
            log_warning "task start-local failed, trying docker compose"
            cd projects && docker compose up -d
            cd "$WORKTREE_PATH"
        }
    else
        cd projects && docker compose up -d
        cd "$WORKTREE_PATH"
    fi

    log "Waiting for services to start..."
    sleep 20

    # Check again
    if run_health_checks; then
        log_success "Services repaired successfully"
        return 0
    else
        log_error "Repair failed - services still unhealthy"
        return 1
    fi
}

#####################################################################
# Main
#####################################################################

main() {
    validate_input

    log "Health check for: $PLAN_ID"
    log "Worktree: $WORKTREE_PATH"
    echo ""

    if run_health_checks; then
        echo ""
        log_success "All required services healthy"
        exit 0
    fi

    echo ""

    if [ "$REPAIR" = "--repair" ]; then
        if repair_services; then
            exit 0
        else
            exit 1
        fi
    else
        log_warning "Services unhealthy. Run with --repair to attempt fix."
        exit 1
    fi
}

main
