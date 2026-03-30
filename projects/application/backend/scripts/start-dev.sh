#!/bin/sh
set -e

echo "Starting backend (development)..."

# Install dependencies
npm install

# Run pending migrations
echo "Running database migrations..."
npm run migration:run || echo "Migration run skipped or failed (may not be set up yet)"

# Start with hot reload
exec npm run start:dev
