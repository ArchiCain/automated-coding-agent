#!/usr/bin/env bash

# Workspace setup script
# Validates .env file exists and checks basic configuration

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "Setting up development workspace..."

# Check if .env file exists
if [ ! -f "$ROOT_DIR/.env" ]; then
  echo "Error: .env file not found."
  echo ""
  echo "Create your .env file by copying the template:"
  echo "  cp .env.template .env"
  echo ""
  echo "Then edit the .env file to add your configuration."
  exit 1
fi

# Load environment variables
source "$ROOT_DIR/.env"

# Validate required variables
MISSING=""
[ -z "$PROJECT_NAME" ] && MISSING="$MISSING PROJECT_NAME"
[ -z "$DATABASE_USERNAME" ] && MISSING="$MISSING DATABASE_USERNAME"
[ -z "$DATABASE_PASSWORD" ] && MISSING="$MISSING DATABASE_PASSWORD"

if [ -n "$MISSING" ]; then
  echo "Error: Missing required variables in .env file:"
  echo "  $MISSING"
  exit 1
fi

# Check Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "Warning: Docker is not running. Start Docker to use local services."
fi

echo "Workspace setup complete for project: $PROJECT_NAME"
echo ""
echo "Quick start:"
echo "  task start-local    # Start all services"
echo "  task status          # Check service status"
echo "  task logs-local      # View service logs"
