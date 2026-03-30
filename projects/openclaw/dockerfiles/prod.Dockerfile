FROM nixos/nix:latest

# Enable flakes and disable sandbox (required for cross-platform builds under emulation)
RUN mkdir -p /etc/nix && printf "experimental-features = nix-command flakes\nsandbox = false\n" >> /etc/nix/nix.conf

WORKDIR /build

# Copy the slim Docker-specific flake (not the full repo flake)
COPY dockerfiles/flake.nix ./flake.nix

# Generate flake.lock and build the dev shell (caches all tools in /nix/store)
RUN nix flake update && nix develop --command true

# Capture the Nix dev shell PATH and write it as an env file for runtime
RUN nix develop --command bash -c 'echo "NIX_PATHS=$PATH"' > /etc/nix-env

# Configure git to use HTTPS with credential store
RUN nix develop --command bash -c "\
    git config --global credential.helper 'store' \
    && git config --global url.\"https://github.com/\".insteadOf 'git@github.com:' \
    "

WORKDIR /app

# Install OpenClaw globally
RUN nix develop --command bash -c "npm install -g openclaw@latest"

# Install Claude Code CLI
RUN nix develop --command bash -c "npm install -g @anthropic-ai/claude-code@latest"

# Install acpx plugin
RUN nix develop --command bash -c "openclaw plugins install @openclaw/acpx"

# Install Playwright + headless Chromium for E2E testing
# --with-deps installs system libraries (libglib, libnss, libatk, etc.)
RUN nix develop --command bash -c "npx playwright install --with-deps chromium"

# Copy OpenClaw config, skills, and soul
COPY app/ ./

# Symlink CLIs to stable PATH
RUN mkdir -p /usr/local/bin \
    && ln -sf $(nix develop --command bash -c "which openclaw") /usr/local/bin/openclaw \
    && ln -sf $(nix develop --command bash -c "which claude") /usr/local/bin/claude

# Copy entrypoint
COPY dockerfiles/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create non-root user (Claude Code refuses --dangerously-skip-permissions as root)
RUN echo "agent:x:1000:1000:agent:/home/agent:/bin/bash" >> /etc/passwd \
    && echo "agent:x:1000:" >> /etc/group \
    && mkdir -p /home/agent/.claude /home/agent/.config /home/agent/.openclaw /workspace \
    && cp /root/.gitconfig /home/agent/.gitconfig \
    && chown -R 1000:1000 /app /home/agent /workspace

USER agent

# Link OpenClaw workspace to /app (where config and skills live)
RUN ln -sf /app /home/agent/.openclaw/workspace

EXPOSE 18789

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["openclaw", "gateway"]
