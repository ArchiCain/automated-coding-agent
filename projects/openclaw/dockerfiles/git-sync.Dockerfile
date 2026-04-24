# Minimal git-sync sidecar image.
#
# Extends alpine/git with curl + openssl so the sidecar can mint GitHub App
# installation tokens and pull over HTTPS without needing `apk add` at runtime.
# Running the sidecar as uid 1000 (to match the gateway user) means it can't
# install packages at startup — they must be present in the image.

FROM alpine/git:2.43.0

RUN apk add --no-cache curl openssl ca-certificates \
    && rm -rf /var/cache/apk/*

# No CMD — the chart supplies the inline script via `command`.
