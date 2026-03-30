# Health

Simple health check endpoint for the backend service. Returns the current status, timestamp, and service name at `GET /health`. Decorated with `@Public()` to bypass Keycloak authentication. Used by Docker health checks and monitoring to verify the service is running.
