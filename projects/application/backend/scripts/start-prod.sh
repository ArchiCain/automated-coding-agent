#!/bin/sh
set -e

echo "Starting backend (production)..."

# Run pending migrations
echo "Running database migrations..."
npm run migration:run || echo "Migration run skipped or failed"

# Start production server
exec npm run start:prod
