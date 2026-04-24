FROM ghcr.io/openclaw/openclaw:latest

USER root

# Base system tools:
#   git, curl, jq, ca-certificates — git ops, HTTP, JSON parsing
#   build-essential, python3       — QMD's node-llama-cpp native build
#   gnupg                          — apt repo signature verification (docker)
#   chromium                       — OpenClaw browser plugin's headless browser
#   fonts-liberation, fonts-noto-* — render Western, CJK, and emoji glyphs
#                                     correctly in screenshots + tests
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl jq ca-certificates build-essential python3 gnupg \
      chromium fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# --- devops tooling ---
# docker CLI, task (go-task). The gateway container runs devops
# operations directly (sandbox create/destroy via `docker compose` +
# `task`) — mirrors the-dev-team-backend's tool surface.

# Resolve arch once for all the direct-binary installs.
ARG TARGETARCH

RUN set -eux; \
    ARCH=$(uname -m); \
    case "$ARCH" in \
      x86_64)  DOCKER_ARCH=x86_64;  TASK_ARCH=amd64 ;; \
      aarch64) DOCKER_ARCH=aarch64; TASK_ARCH=arm64 ;; \
      *) echo "Unsupported arch: $ARCH" >&2; exit 1 ;; \
    esac; \
    # docker CLI (talks to the host daemon via mounted socket at runtime).
    # 27.x is the first stable series whose client speaks API >= 1.44, which
    # modern daemons (Colima's bundled Docker, current Docker Desktop) require
    # as a minimum. 24.0.7 was fine against Minikube's older daemon but is
    # rejected now. Pin to a concrete point release for reproducibility.
    curl -fsSL "https://download.docker.com/linux/static/stable/${DOCKER_ARCH}/docker-27.3.1.tgz" -o /tmp/docker.tgz && \
    tar -xzf /tmp/docker.tgz -C /tmp && \
    mv /tmp/docker/docker /usr/local/bin/docker && \
    chmod +x /usr/local/bin/docker && \
    rm -rf /tmp/docker /tmp/docker.tgz; \
    # task (go-task)
    curl -fsSL "https://github.com/go-task/task/releases/download/v3.38.0/task_linux_${TASK_ARCH}.tar.gz" -o /tmp/task.tgz && \
    tar -xzf /tmp/task.tgz -C /tmp task && \
    mv /tmp/task /usr/local/bin/task && \
    chmod +x /usr/local/bin/task && \
    rm /tmp/task.tgz

# QMD memory search backend
RUN npm install -g @tobilu/qmd

WORKDIR /app

COPY app/ ./

COPY dockerfiles/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY dockerfiles/git-credential-helper.sh /usr/local/bin/openclaw-git-credential
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/openclaw-git-credential

RUN mkdir -p /workspace && chown -R 1000:1000 /app /workspace

USER node

EXPOSE 18789

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["openclaw", "gateway"]
