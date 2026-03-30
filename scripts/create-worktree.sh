#!/usr/bin/env bash

#####################################################################
# Create Git Worktree with Full Environment Setup
#
# This script creates an isolated git worktree with:
# - Unique port assignments (no conflicts with main workspace)
# - Isolated Docker stack (separate containers and volumes)
# - Full dependency installation
# - Automated health checks
# - Test validation with retry and recovery logic
#
# Usage: ./scripts/create-worktree.sh <branch-name>
# Example: ./scripts/create-worktree.sh feature/my-feature
#
# Or via Task: task worktree:create -- feature/my-feature
#####################################################################

set -euo pipefail

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

#####################################################################
# Configuration
#####################################################################

BRANCH_NAME="${1:-}"
TEST_RETRY_COUNT=3
PURGE_RESTART_ATTEMPTED=false
HEALTH_CHECK_MAX_ATTEMPTS=60  # 60 attempts * 2s = 2 minutes max per service

# Test result counters (global)
BACKEND_UNIT_COUNT=0
BACKEND_E2E_COUNT=0
FRONTEND_COUNT=0

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
# Phase 1: Input Validation
#####################################################################

validate_input() {
    if [ -z "$BRANCH_NAME" ]; then
        print_error "Branch name is required"
        echo ""
        echo "Usage: $0 <branch-name>"
        echo "Example: $0 feature/my-feature"
        exit 1
    fi

    # Validate branch name format
    if [[ "$BRANCH_NAME" =~ [[:space:]] ]]; then
        print_error "Branch name cannot contain spaces"
        exit 1
    fi

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "Not in a git repository"
        exit 1
    fi

    # Check if branch already exists
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
        print_error "Branch '$BRANCH_NAME' already exists"
        echo ""
        echo "Existing branches:"
        git branch -a | grep "$BRANCH_NAME"
        exit 1
    fi

    # Check if required tools exist
    for tool in git direnv task docker; do
        if ! command -v $tool &> /dev/null; then
            print_error "$tool is not installed"
            exit 1
        fi
    done

    print_success "Input validation passed"
}

#####################################################################
# Phase 2: Directory Selection & .gitignore Verification
#####################################################################

setup_worktree_directory() {
    echo ""
    echo "📁 Setting up worktree directory..."

    # Priority order: .worktrees/ > worktrees/ > create .worktrees/
    if [ -d ".worktrees" ]; then
        WORKTREE_DIR=".worktrees"
        print_info "Using existing directory: $WORKTREE_DIR/"
    elif [ -d "worktrees" ]; then
        WORKTREE_DIR="worktrees"
        print_info "Using existing directory: $WORKTREE_DIR/"
    else
        WORKTREE_DIR=".worktrees"
        print_info "Creating new directory: $WORKTREE_DIR/"
        mkdir -p "$WORKTREE_DIR"
    fi

    # Verify directory is in .gitignore (CRITICAL)
    if ! git check-ignore -q "$WORKTREE_DIR" 2>/dev/null && ! git check-ignore -q ".worktrees" 2>/dev/null && ! git check-ignore -q "worktrees" 2>/dev/null; then
        print_warning "Worktree directory not in .gitignore, adding it now..."

        echo "" >> .gitignore
        echo "# Git worktrees (managed by scripts/create-worktree.sh)" >> .gitignore
        echo ".worktrees/" >> .gitignore
        echo "worktrees/" >> .gitignore

        git add .gitignore
        git commit -m "chore: add worktree directories to .gitignore"

        print_success "Added $WORKTREE_DIR/ to .gitignore and committed"
    else
        print_success "Directory is properly ignored in .gitignore"
    fi
}

#####################################################################
# Phase 3: Port Offset Calculation
#####################################################################

calculate_port_offset() {
    echo ""
    echo "🔢 Calculating port offset..."

    # Count existing worktrees
    WORKTREE_COUNT=$(git worktree list | wc -l | tr -d ' ')
    PORT_OFFSET=$(( (WORKTREE_COUNT - 1) * 100 ))

    # Enforce maximum (18 worktrees = offset 1800)
    if [ $PORT_OFFSET -gt 1800 ]; then
        print_error "Maximum worktree limit (18) reached"
        echo ""
        echo "Current worktrees:"
        git worktree list
        exit 1
    fi

    # Calculate actual ports
    BACKEND_PORT=$((8085 + PORT_OFFSET))
    KEYCLOAK_PORT=$((8081 + PORT_OFFSET))
    FRONTEND_PORT=$((3000 + PORT_OFFSET))
    DATABASE_PORT=$((5437 + PORT_OFFSET))

    print_success "Calculated port offset: $PORT_OFFSET"
    echo "   Backend:  $BACKEND_PORT"
    echo "   Keycloak: $KEYCLOAK_PORT"
    echo "   Frontend: $FRONTEND_PORT"
    echo "   Database: $DATABASE_PORT"
}

#####################################################################
# Phase 4: Git Worktree Creation
#####################################################################

create_git_worktree() {
    echo ""
    echo "🌿 Creating git worktree..."

    WORKTREE_PATH="$WORKTREE_DIR/$BRANCH_NAME"

    # Check if worktree path already exists
    if [ -d "$WORKTREE_PATH" ]; then
        print_error "Worktree directory already exists: $WORKTREE_PATH"
        exit 1
    fi

    # Create worktree with new branch
    git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

    print_success "Worktree created at: $WORKTREE_PATH"
}

#####################################################################
# Phase 5: Environment Configuration
#####################################################################

configure_environment() {
    echo ""
    echo "⚙️  Configuring environment..."

    # Change to worktree directory
    cd "$WORKTREE_PATH"

    # Check if .env exists in parent
    if [ ! -f "../../.env" ]; then
        print_error ".env file not found in repository root"
        exit 1
    fi

    # Copy .env from parent
    cp ../../.env .
    print_success ".env copied from repository root"

    # Sanitize branch name for compose project name (replace / with -)
    COMPOSE_PROJECT_NAME=$(echo "$BRANCH_NAME" | tr '/' '-')

    # Update ports and project name
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS (BSD sed)
        sed -i '' "s/^BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" .env
        sed -i '' "s/^KEYCLOAK_PORT=.*/KEYCLOAK_PORT=$KEYCLOAK_PORT/" .env
        sed -i '' "s/^FRONTEND_PORT=.*/FRONTEND_PORT=$FRONTEND_PORT/" .env
        sed -i '' "s/^DATABASE_PORT=.*/DATABASE_PORT=$DATABASE_PORT/" .env
        sed -i '' "s|^VITE_BACKEND_URL=.*|VITE_BACKEND_URL=http://localhost:$BACKEND_PORT|" .env
        sed -i '' "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:$FRONTEND_PORT|" .env
        sed -i '' "s/^COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME/" .env
    else
        # Linux (GNU sed)
        sed -i "s/^BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" .env
        sed -i "s/^KEYCLOAK_PORT=.*/KEYCLOAK_PORT=$KEYCLOAK_PORT/" .env
        sed -i "s/^FRONTEND_PORT=.*/FRONTEND_PORT=$FRONTEND_PORT/" .env
        sed -i "s/^DATABASE_PORT=.*/DATABASE_PORT=$DATABASE_PORT/" .env
        sed -i "s|^VITE_BACKEND_URL=.*|VITE_BACKEND_URL=http://localhost:$BACKEND_PORT|" .env
        sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=http://localhost:$FRONTEND_PORT|" .env
        sed -i "s/^COMPOSE_PROJECT_NAME=.*/COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME/" .env
    fi

    print_success ".env configured with unique ports and project name"
    echo "   COMPOSE_PROJECT_NAME: $COMPOSE_PROJECT_NAME"
}

#####################################################################
# Phase 6: Dependency Installation
#####################################################################

install_dependencies() {
    echo ""
    echo "📦 Installing dependencies..."

    # Load Nix environment
    echo "⏳ Loading Nix environment (direnv allow)..."
    direnv allow
    sleep 3  # Give direnv time to load

    print_success "Nix environment loaded"

    # Install backend dependencies
    echo "⏳ Installing backend dependencies..."
    if task backend:local:install > /tmp/backend-install.log 2>&1; then
        print_success "Backend dependencies installed"
    else
        print_error "Backend dependency installation failed"
        cat /tmp/backend-install.log
        exit 1
    fi

    # Install frontend dependencies
    echo "⏳ Installing frontend dependencies..."
    if task frontend:local:install > /tmp/frontend-install.log 2>&1; then
        print_success "Frontend dependencies installed"
    else
        print_error "Frontend dependency installation failed"
        cat /tmp/frontend-install.log
        exit 1
    fi
}

#####################################################################
# Phase 7: Service Startup & Health Checks
#####################################################################

start_services() {
    echo ""
    echo "🐳 Starting services..."

    task start-local

    print_success "Services started"
    echo "⏳ Waiting 15 seconds for initial startup..."
    sleep 15
}

check_database_health() {
    local attempt=0

    echo "⏳ Waiting for Database to be ready..."

    while [ $attempt -lt $HEALTH_CHECK_MAX_ATTEMPTS ]; do
        if docker exec ${COMPOSE_PROJECT_NAME}-database-1 pg_isready -U postgres > /dev/null 2>&1; then
            print_success "Database is healthy!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    echo ""
    print_error "Database failed to become healthy after $((HEALTH_CHECK_MAX_ATTEMPTS * 2)) seconds"
    return 1
}

check_service_health() {
    local service_name=$1
    local health_url=$2
    local attempt=0

    echo "⏳ Waiting for $service_name to be healthy..."

    while [ $attempt -lt $HEALTH_CHECK_MAX_ATTEMPTS ]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            print_success "$service_name is healthy!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    echo ""
    print_error "$service_name failed to become healthy after $((HEALTH_CHECK_MAX_ATTEMPTS * 2)) seconds"
    return 1
}

run_health_checks() {
    echo ""
    echo "🏥 Running health checks..."

    # Database (foundational - check first)
    if ! check_database_health; then
        return 1
    fi

    # Backend (depends on database)
    if ! check_service_health "Backend" "http://localhost:$BACKEND_PORT/health"; then
        return 1
    fi

    # Keycloak (depends on database)
    if ! check_service_health "Keycloak" "http://localhost:$KEYCLOAK_PORT/health"; then
        return 1
    fi

    # Frontend (depends on backend)
    if ! check_service_health "Frontend" "http://localhost:$FRONTEND_PORT"; then
        return 1
    fi

    print_success "All health checks passed!"
    return 0
}

#####################################################################
# Phase 8: Test Execution with Retry Logic
#####################################################################

parse_jest_test_count() {
    local output="$1"
    # Try to extract test count from Jest/Vitest output
    # Formats: "Tests: 5 passed, 5 total" or "Test Suites: 3 passed, 3 total"
    local count=$(echo "$output" | grep -oE "Tests:.*([0-9]+) passed" | grep -oE "[0-9]+" | head -1)
    if [ -z "$count" ]; then
        count=$(echo "$output" | grep -oE "([0-9]+) passed" | grep -oE "[0-9]+" | head -1)
    fi
    echo "${count:-0}"
}

run_all_tests() {
    local test_output=""

    echo ""
    echo "🧪 Running all tests..."
    echo ""

    # Backend unit tests
    echo "📦 Running backend unit tests..."
    if test_output=$(task backend:local:test 2>&1); then
        BACKEND_UNIT_COUNT=$(parse_jest_test_count "$test_output")
        print_success "Backend unit tests passed ($BACKEND_UNIT_COUNT tests)"
    else
        print_error "Backend unit tests failed"
        echo "$test_output"
        return 1
    fi

    # Backend e2e tests
    echo ""
    echo "📦 Running backend e2e tests..."
    if test_output=$(task backend:local:test:e2e 2>&1); then
        BACKEND_E2E_COUNT=$(parse_jest_test_count "$test_output")
        print_success "Backend e2e tests passed ($BACKEND_E2E_COUNT tests)"
    else
        print_error "Backend e2e tests failed"
        echo "$test_output"
        return 1
    fi

    # Frontend tests
    echo ""
    echo "📦 Running frontend tests..."
    if test_output=$(task frontend:local:test 2>&1); then
        FRONTEND_COUNT=$(parse_jest_test_count "$test_output")
        print_success "Frontend tests passed ($FRONTEND_COUNT tests)"
    else
        print_error "Frontend tests failed"
        echo "$test_output"
        return 1
    fi

    return 0
}

attempt_tests_with_retry() {
    local attempt=1

    while [ $attempt -le $TEST_RETRY_COUNT ]; do
        echo ""
        print_info "Test Attempt $attempt of $TEST_RETRY_COUNT..."

        if run_all_tests; then
            print_success "All tests passed!"
            return 0
        fi

        print_warning "Tests failed on attempt $attempt"

        if [ $attempt -lt $TEST_RETRY_COUNT ]; then
            echo "⏳ Waiting 10 seconds before retry..."
            sleep 10
        fi

        attempt=$((attempt + 1))
    done

    print_error "Tests failed after $TEST_RETRY_COUNT attempts"
    return 1
}

purge_and_restart() {
    print_header "🔄 ATTEMPTING RECOVERY: Purge and Restart"

    echo "This will:"
    echo "  1. Stop all services"
    echo "  2. Remove all containers and volumes (clean slate)"
    echo "  3. Restart services"
    echo "  4. Re-run health checks"
    echo "  5. Re-run tests"
    echo ""

    # Purge
    echo "🧹 Purging containers and volumes..."
    task purge-local

    echo "⏳ Waiting 5 seconds..."
    sleep 5

    # Restart
    echo "🚀 Starting services (clean slate)..."
    task start-local

    echo "⏳ Waiting 15 seconds for services to initialize..."
    sleep 15

    # Re-run health checks
    echo ""
    echo "🏥 Re-running health checks after purge..."
    if ! run_health_checks; then
        print_error "Health checks failed after purge-and-restart"
        return 1
    fi

    return 0
}

run_tests_with_recovery() {
    # First attempt with retries
    if attempt_tests_with_retry; then
        return 0  # Success!
    fi

    # If we've already tried purge-restart, give up
    if [ "$PURGE_RESTART_ATTEMPTED" = true ]; then
        print_error "Tests still failing after purge-and-restart"
        return 1
    fi

    # Last resort: purge and restart
    if ! purge_and_restart; then
        return 1
    fi

    # Mark that we've attempted purge-restart
    PURGE_RESTART_ATTEMPTED=true

    # Final test attempt
    echo ""
    print_info "Final test attempt after purge-and-restart..."
    if run_all_tests; then
        echo ""
        print_success "Tests passed after purge-and-restart!"
        return 0
    fi

    echo ""
    print_error "Tests still failing after purge-and-restart"
    return 1
}

#####################################################################
# Phase 9: Reporting
#####################################################################

report_success() {
    print_header "✅ WORKTREE SETUP COMPLETE"

    echo "📍 Worktree Location:"
    echo "   $(pwd)"
    echo ""
    echo "🐳 Docker Compose Project:"
    echo "   $COMPOSE_PROJECT_NAME"
    echo ""
    echo "🌐 Services Running:"
    echo "   ✅ Frontend     → http://localhost:$FRONTEND_PORT"
    echo "   ✅ Backend      → http://localhost:$BACKEND_PORT"
    echo "   ✅ Backend API  → http://localhost:$BACKEND_PORT/api (Swagger)"
    echo "   ✅ Keycloak     → http://localhost:$KEYCLOAK_PORT"
    echo "   ✅ Database     → localhost:$DATABASE_PORT"
    echo ""
    echo "🧪 Test Results:"
    echo "   ✅ Backend Unit Tests    → $BACKEND_UNIT_COUNT passed"
    echo "   ✅ Backend E2E Tests     → $BACKEND_E2E_COUNT passed"
    echo "   ✅ Frontend Unit Tests   → $FRONTEND_COUNT passed"
    echo ""
    echo "📊 Total Tests: $((BACKEND_UNIT_COUNT + BACKEND_E2E_COUNT + FRONTEND_COUNT)) passed"
    echo ""
    echo "📝 Quick Commands:"
    echo "   cd $(pwd)                  # Navigate to worktree"
    echo "   task status                           # Check service status"
    echo "   task logs-local                       # View all logs"
    echo "   task backend:local:logs               # Backend logs"
    echo "   task frontend:local:logs              # Frontend logs"
    echo ""
    echo "🎉 Ready to develop on branch: $BRANCH_NAME"
    print_header ""
}

report_failure() {
    print_header "❌ WORKTREE SETUP FAILED"

    echo "The environment was created but tests are failing."
    echo ""
    echo "📍 Worktree Location:"
    echo "   $(pwd)"
    echo ""
    echo "🌐 Services Status:"

    # Check which services are healthy
    echo -n "   "
    if docker exec ${COMPOSE_PROJECT_NAME}-database-1 pg_isready -U postgres > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Database${NC}     → localhost:$DATABASE_PORT"
    else
        echo -e "${RED}❌ Database${NC}     → localhost:$DATABASE_PORT"
    fi

    echo -n "   "
    if curl -sf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend${NC}      → http://localhost:$BACKEND_PORT"
    else
        echo -e "${RED}❌ Backend${NC}      → http://localhost:$BACKEND_PORT"
    fi

    echo -n "   "
    if curl -sf "http://localhost:$KEYCLOAK_PORT/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Keycloak${NC}     → http://localhost:$KEYCLOAK_PORT"
    else
        echo -e "${RED}❌ Keycloak${NC}     → http://localhost:$KEYCLOAK_PORT"
    fi

    echo -n "   "
    if curl -sf "http://localhost:$FRONTEND_PORT" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend${NC}     → http://localhost:$FRONTEND_PORT"
    else
        echo -e "${RED}❌ Frontend${NC}     → http://localhost:$FRONTEND_PORT"
    fi

    echo ""
    echo "❌ Test Failures:"
    echo "   Tests failed after multiple retry attempts, including a full"
    echo "   purge-and-restart. This indicates a real issue that needs"
    echo "   investigation."
    echo ""
    echo "🔍 Diagnostic Information:"
    echo ""
    echo "Recent logs (last 30 lines):"
    task logs-local 2>&1 | tail -30 || echo "Could not retrieve logs"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Check logs:           cd $(pwd) && task logs-local"
    echo "   2. Run tests manually:   task backend:local:test"
    echo "   3. Check service health: curl http://localhost:$BACKEND_PORT/health"
    echo "   4. Review test output above for specific failures"
    echo ""
    echo "🧹 To clean up this worktree:"
    echo "   cd ../../  # Return to main worktree"
    echo "   task worktree:destroy -- $BRANCH_NAME"
    echo ""
    print_header ""

    exit 1
}

#####################################################################
# Main Execution
#####################################################################

main() {
    print_header "🚀 Creating Worktree: $BRANCH_NAME"

    # Store original directory
    ORIGINAL_DIR=$(pwd)

    # Execute phases
    validate_input
    setup_worktree_directory
    calculate_port_offset
    create_git_worktree
    configure_environment
    install_dependencies
    start_services

    if ! run_health_checks; then
        print_error "Health checks failed"
        report_failure
    fi

    if ! run_tests_with_recovery; then
        report_failure
    fi

    report_success
}

# Run main function
main
