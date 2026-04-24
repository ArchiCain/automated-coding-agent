# Stage 1: Get postgresql client and envsubst from Alpine
FROM alpine:3.19 AS postgres-tools
RUN apk add --no-cache postgresql16-client gettext

# Stage 2: Build Keycloak with psql for schema initialization
FROM quay.io/keycloak/keycloak:23.0.3

USER root

# Copy the actual psql binary (it's a symlink in alpine to /usr/libexec/postgresql/psql)
# and all required shared libraries
COPY --from=postgres-tools /usr/libexec/postgresql/psql /usr/bin/psql
COPY --from=postgres-tools /usr/lib/libpq.so.5 /usr/lib/
COPY --from=postgres-tools /usr/lib/libpq.so.5.16 /usr/lib/
COPY --from=postgres-tools /usr/lib/libreadline.so.8 /usr/lib/
COPY --from=postgres-tools /usr/lib/libncursesw.so.6 /usr/lib/
COPY --from=postgres-tools /usr/lib/libssl.so.3 /usr/lib/
COPY --from=postgres-tools /usr/lib/libcrypto.so.3 /usr/lib/
# Copy musl loader (architecture-specific, will exist in /lib)
COPY --from=postgres-tools /lib/ld-musl-*.so.1 /lib/

# Copy envsubst and its required library for realm config template processing
COPY --from=postgres-tools /usr/bin/envsubst /usr/bin/envsubst
COPY --from=postgres-tools /usr/lib/libintl.so.8 /usr/lib/

# Copy startup script that creates schema before starting Keycloak.
# Use a separate RUN chmod instead of `COPY --chmod=755` so the build works
# without BuildKit (the docker daemon mounted into the openclaw gateway pod
# may not have BuildKit enabled).
COPY ./app/scripts/startup.sh /opt/keycloak/bin/startup.sh
RUN chmod 755 /opt/keycloak/bin/startup.sh

# Import realm on startup - copy template first
WORKDIR /opt/keycloak
COPY ./app/realm-config /opt/keycloak/data/import

# Change ownership of import directory so user 1000 can write processed config
RUN chown -R 1000:1000 /opt/keycloak/data/import

USER 1000

# Set to API-only mode (no UI)
ENV KC_HTTP_ENABLED=true
ENV KC_HOSTNAME_STRICT=false
ENV KC_HOSTNAME_STRICT_HTTPS=false
ENV KC_PROXY=edge

# Database configuration will come from environment variables
ENV KC_DB=postgres

# Set development mode for faster startup
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

# Use startup script as entrypoint
ENTRYPOINT ["/opt/keycloak/bin/startup.sh", "start-dev", "--import-realm"]