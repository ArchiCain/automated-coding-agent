#!/bin/bash
# Note: We don't use 'set -e' because we need graceful handling of
# service account role configuration failures

echo "Initializing Keycloak database schema..."

# Build connection string from environment variables
DB_HOST="${KC_DB_URL_HOST:-database}"
DB_PORT="${KC_DB_URL_PORT:-5432}"
DB_NAME="${KC_DB_URL_DATABASE:-postgres}"
DB_USER="${KC_DB_USERNAME:-postgres}"
DB_PASSWORD="${KC_DB_PASSWORD:-postgres}"
SCHEMA_NAME="${KC_DB_SCHEMA:-keycloak}"

# Check if SSL is required from DATABASE_SSL environment variable or KC_DB_URL
# For local development, DATABASE_SSL=false means no SSL
# For production (AWS RDS), SSL is required
if [ "${DATABASE_SSL}" = "false" ]; then
  export PGSSLMODE="disable"
elif echo "${KC_DB_URL}" | grep -q "sslmode=disable"; then
  export PGSSLMODE="disable"
else
  export PGSSLMODE="require"
fi

echo "Waiting for database at ${DB_HOST}:${DB_PORT}... (SSL: ${PGSSLMODE})"
echo "DEBUG: Username: ${DB_USER}"
echo "DEBUG: Database: ${DB_NAME}"
max_attempts=30
attempt=0

# Wait for database to be ready
until PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c '\q' 2>&1; do
  attempt=$((attempt + 1))
  if [ $attempt -ge $max_attempts ]; then
    echo "ERROR: Database not available after ${max_attempts} attempts"
    echo "Last psql error shown above"
    exit 1
  fi
  echo "Database not ready yet, waiting... (${attempt}/${max_attempts})"
  sleep 2
done

echo "Database is ready!"

# Create Keycloak schema if it doesn't exist
echo "Creating schema '${SCHEMA_NAME}' if it doesn't exist..."
if ! PGPASSWORD="${DB_PASSWORD}" psql \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -c "CREATE SCHEMA IF NOT EXISTS ${SCHEMA_NAME};" 2>&1; then
  echo "ERROR: Failed to create schema"
  exit 1
fi

echo "Schema '${SCHEMA_NAME}' is ready!"

# Substitute environment variables in realm config
echo "Processing realm configuration..."
if [ -f /opt/keycloak/data/import/realm-export.json ]; then
  # Use envsubst to replace ${FRONTEND_URL} and other env vars
  # Write to /tmp first, then move to import directory (now owned by user 1000)
  envsubst < /opt/keycloak/data/import/realm-export.json > /tmp/realm-configured.json
  mv /tmp/realm-configured.json /opt/keycloak/data/import/realm-export.json
  echo "Realm configuration processed with FRONTEND_URL=${FRONTEND_URL}"
fi

echo "Starting Keycloak..."

# Start Keycloak in the background
/opt/keycloak/bin/kc.sh "$@" &
KEYCLOAK_PID=$!

# Wait for Keycloak to be ready using TCP check (curl not available in container)
echo "Waiting for Keycloak to start..."
max_wait=120
waited=0
while [ $waited -lt $max_wait ]; do
  # Check if Keycloak port is listening
  if (echo > /dev/tcp/localhost/8080) 2>/dev/null; then
    # Also try a simple kcadm command to verify it's fully ready
    sleep 5  # Give Keycloak a bit more time after port opens
    if /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user "$KEYCLOAK_ADMIN" --password "$KEYCLOAK_ADMIN_PASSWORD" 2>/dev/null; then
      echo "Keycloak is ready!"
      break
    fi
  fi
  sleep 2
  waited=$((waited + 2))
  echo "Waiting for Keycloak... (${waited}s/${max_wait}s)"
done

if [ $waited -ge $max_wait ]; then
  echo "WARNING: Keycloak health check timed out, proceeding anyway..."
fi

# Configure service account roles using kcadm
echo "Configuring service account roles..."
REALM="${KC_REALM:-application}"
CLIENT_ID="${KC_CLIENT_ID:-backend-service}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

# Check if we've already configured roles (to avoid re-running on restart)
ROLE_CONFIG_MARKER="/tmp/.keycloak_roles_configured"
if [ -f "$ROLE_CONFIG_MARKER" ]; then
  echo "Service account roles already configured (marker exists)"
else
  # Authenticate with kcadm (credentials already set in health check)
  echo "Authenticating with Keycloak admin..."
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 \
    --realm master \
    --user "$ADMIN_USER" \
    --password "$ADMIN_PASSWORD" 2>&1

  # Get the service account user ID using jq-like parsing
  echo "Looking for service account user: service-account-${CLIENT_ID}"
  SERVICE_ACCOUNT_JSON=$(/opt/keycloak/bin/kcadm.sh get users -r "$REALM" -q "username=service-account-${CLIENT_ID}" 2>/dev/null)
  SERVICE_ACCOUNT_USER=$(echo "$SERVICE_ACCOUNT_JSON" | grep -o '"id" *: *"[^"]*"' | head -1 | sed 's/"id" *: *"\([^"]*\)"/\1/')

  if [ -n "$SERVICE_ACCOUNT_USER" ]; then
    echo "Found service account user: $SERVICE_ACCOUNT_USER"

    # Get realm-management client ID
    echo "Looking for realm-management client..."
    REALM_MGMT_JSON=$(/opt/keycloak/bin/kcadm.sh get clients -r "$REALM" -q "clientId=realm-management" 2>/dev/null)
    REALM_MGMT_CLIENT_ID=$(echo "$REALM_MGMT_JSON" | grep -o '"id" *: *"[^"]*"' | head -1 | sed 's/"id" *: *"\([^"]*\)"/\1/')

    if [ -n "$REALM_MGMT_CLIENT_ID" ]; then
      echo "Found realm-management client: $REALM_MGMT_CLIENT_ID"

      # Assign roles using add-roles command (simpler than creating role mappings)
      for ROLE_NAME in manage-users view-users query-users; do
        echo "Assigning role ${ROLE_NAME} to service account..."
        /opt/keycloak/bin/kcadm.sh add-roles \
          -r "$REALM" \
          --uusername "service-account-${CLIENT_ID}" \
          --cclientid realm-management \
          --rolename "$ROLE_NAME" 2>&1 && echo "  -> Role ${ROLE_NAME} assigned successfully" || echo "  -> Role ${ROLE_NAME} may already be assigned or failed"
      done

      echo "Service account role configuration complete!"
      touch "$ROLE_CONFIG_MARKER"
    else
      echo "WARNING: Could not find realm-management client"
    fi
  else
    echo "WARNING: Could not find service account user"
    echo "DEBUG: Users query result: $SERVICE_ACCOUNT_JSON"
  fi
fi

# Keep the script running by waiting for Keycloak
echo "Service account configuration complete. Keycloak is running with PID $KEYCLOAK_PID"
wait $KEYCLOAK_PID
