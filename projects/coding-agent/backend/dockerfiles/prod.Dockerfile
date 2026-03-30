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

# Copy the flake for runtime use (nix develop needs it)
RUN cp /build/flake.nix /build/flake.lock /app/

# Install app dependencies (includes @anthropic-ai/claude-code)
COPY app/package.json app/package-lock.json ./app/
RUN nix develop --command bash -c "cd app && npm ci"

# Symlink claude CLI to a stable PATH location
RUN mkdir -p /usr/local/bin && ln -sf /app/app/node_modules/.bin/claude /usr/local/bin/claude

# Copy source and build
COPY app/ ./app/
RUN nix develop --command bash -c "cd app && npm run build"

# Copy entrypoint script
COPY dockerfiles/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Create non-root user (Claude Code refuses --dangerously-skip-permissions as root)
RUN echo "agent:x:1000:1000:agent:/home/agent:/bin/bash" >> /etc/passwd \
    && echo "agent:x:1000:" >> /etc/group \
    && mkdir -p /home/agent/.claude /home/agent/.config /workspace \
    && cp /root/.gitconfig /home/agent/.gitconfig \
    && chown -R 1000:1000 /app /home/agent /workspace

USER agent

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "app/dist/main"]
