#!/bin/sh
set -e

echo "Starting backend (production)..."

# TypeORM handles migrations on startup via synchronize/autorun.
# The migration CLI requires source .ts files not present in the production build.
exec npm run start:prod
