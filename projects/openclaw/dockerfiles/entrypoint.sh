#!/usr/bin/env bash
set -e

# =============================================================================
# OpenClaw entrypoint
#
# Four agents (orchestrator, devops, worker, tester) reason via a self-hosted
# Ollama at http://graphics-machine:11434 (model qwen-coder-next-256k). Memory
# search uses bge-m3-8k via the Ollama running on host-machine. Endpoints are
# pinned in app/openclaw.json — the only env-based credential is
# OLLAMA_API_KEY, a non-empty placeholder OpenClaw requires to activate the
# bundled Ollama provider plugin.
#
# Config and skills are sourced from the synced repo at /workspace/repo if
# available (updated continuously by the git-sync sidecar), falling back to
# the image-baked baseline at /app. This lets orchestrator edits to
# openclaw.json and skills/ on the `dev` branch take effect on the next pod
# restart without an image rebuild.
# =============================================================================

if [ -z "${OLLAMA_API_KEY:-}" ]; then
  echo "ERROR: OLLAMA_API_KEY is not set (any non-empty placeholder works for self-hosted Ollama)." >&2
  exit 1
fi

export OPENCLAW_STATE_DIR="/workspace/.openclaw"
mkdir -p "$OPENCLAW_STATE_DIR"

# ---------- Wait for the git-sync sidecar to populate /workspace/repo ----------

REPO_APP_DIR="/workspace/repo/projects/openclaw/app"

if [ "${OPENCLAW_WAIT_FOR_REPO:-1}" != "0" ]; then
  echo "Waiting for /workspace/repo/.git to appear..."
  WAIT=0
  until [ -d /workspace/repo/.git ] || [ "$WAIT" -ge 120 ]; do
    sleep 2
    WAIT=$((WAIT + 2))
  done
  if [ -d /workspace/repo/.git ]; then
    echo "Repo ready at /workspace/repo (git-sync sidecar completed initial clone)."
  else
    echo "WARNING: /workspace/repo/.git did not appear after 120s. Falling back to image-baked config." >&2
  fi
fi

# ---------- Git identity + credentials for agent commits ----------
# Must be set BEFORE the pre-seed pull below (which uses the credential helper).
#
# Identity uses the GitHub App's bot ({APP_ID}+{slug}[bot]) so pushed commits
# show up as attributed to the App in GitHub's UI.
#
# Credentials come from /workspace/.openclaw/github-token, which the git-sync
# sidecar refreshes every ~50 minutes with a freshly-minted App installation
# token. The credential helper at /usr/local/bin/openclaw-git-credential
# reads that file on demand, so any `git push` to github.com "just works".

GIT_APP_ID="${GITHUB_APP_ID:-}"
GIT_APP_SLUG="${OPENCLAW_GIT_APP_SLUG:-scain-openclaw}"

if [ -n "$GIT_APP_ID" ]; then
  git config --global user.name  "${GIT_APP_SLUG}[bot]"
  git config --global user.email "${GIT_APP_ID}+${GIT_APP_SLUG}[bot]@users.noreply.github.com"
  echo "Git identity: ${GIT_APP_SLUG}[bot] <${GIT_APP_ID}+${GIT_APP_SLUG}[bot]@users.noreply.github.com>"
else
  echo "WARNING: GITHUB_APP_ID not set — agents can commit but attribution will be generic." >&2
fi

git config --global credential.https://github.com.helper "/usr/local/bin/openclaw-git-credential"
git config --global --add safe.directory /workspace/repo

# ---------- Best-effort pull before seeding config ----------
# The sidecar polls every OPENCLAW_GIT_INTERVAL seconds. On a pod restart, the
# workspace may be behind origin/dev by up to that interval — if we seed config
# now, we'd use stale openclaw.json / skills. Do a one-shot fetch+ff-merge to
# make restarts deterministic. Soft-fail: a bad pull shouldn't block startup.

GIT_BRANCH="${OPENCLAW_GIT_BRANCH:-dev}"

if [ -d /workspace/repo/.git ]; then
  echo "Fetching origin/${GIT_BRANCH} before seeding config..."
  if git -C /workspace/repo fetch origin "$GIT_BRANCH" 2>&1; then
    if git -C /workspace/repo merge --ff-only "origin/$GIT_BRANCH" 2>&1; then
      echo "Fast-forwarded /workspace/repo to origin/${GIT_BRANCH}."
    else
      echo "Merge skipped — local and origin/${GIT_BRANCH} have diverged. Using current state." >&2
    fi
  else
    echo "Fetch failed (possibly stale token on first restart). Using current state — sidecar will catch up." >&2
  fi
fi

# ---------- Wipe gateway config backups so the synced repo always wins ----------
# The gateway maintains rolling backups (`openclaw.json.bak`, `.last-good`,
# `.clobbered.<ts>`) and on startup will *auto-restore* from `.last-good` if it
# considers our seeded config to be "missing meta". On the first deploy of a
# new shape (per-agent skills allowlist, plugin entries, mcp.servers) it
# silently reverted to a previous boot's clobbered state, dropping our intent.
#
# Strategy: wipe every backup before we copy. The seeded openclaw.json from
# the synced repo is the single source of truth; if the gateway mutates it,
# we'll re-seed the next boot. Backups buy nothing here — git is the backup.
echo "Wiping stale openclaw.json backups under $OPENCLAW_STATE_DIR..."
rm -f "$OPENCLAW_STATE_DIR"/openclaw.json.bak* \
      "$OPENCLAW_STATE_DIR"/openclaw.json.last-good \
      "$OPENCLAW_STATE_DIR"/openclaw.json.clobbered.*

# ---------- Seed openclaw.json from the synced repo, falling back to /app ----------

if [ -f "$REPO_APP_DIR/openclaw.json" ]; then
  echo "Using openclaw.json from synced repo: $REPO_APP_DIR/openclaw.json"
  cp "$REPO_APP_DIR/openclaw.json" "$OPENCLAW_STATE_DIR/openclaw.json"
else
  echo "Using openclaw.json from image baseline: /app/openclaw.json"
  cp /app/openclaw.json "$OPENCLAW_STATE_DIR/openclaw.json"
fi

# ---------- Skills: prefer synced repo, fallback to /app/skills ----------
# `skills.load.extraDirs: ["./skills"]` resolves relative to the gateway's
# working directory ($OPENCLAW_STATE_DIR). Point a symlink at the best source.

rm -f "$OPENCLAW_STATE_DIR/skills"
if [ -d "$REPO_APP_DIR/skills" ]; then
  ln -s "$REPO_APP_DIR/skills" "$OPENCLAW_STATE_DIR/skills"
  echo "Skills symlinked from synced repo."
elif [ -d /app/skills ]; then
  ln -s /app/skills "$OPENCLAW_STATE_DIR/skills"
  echo "Skills symlinked from image baseline."
fi

# ---------- Per-agent persona seeding ----------
# Each agent has its own workspace at /workspace/.openclaw/workspaces/<id>/
# containing personality (SOUL.md, AGENTS.md, IDENTITY.md) plus the agent's
# own memory (memory/, MEMORY.md, DREAMS.md).
#
# Personality files come from git (versioned, reviewable in PRs). Memory
# files are runtime state in the Docker volume. On boot we sync the
# personality from the repo to the runtime workspace, but never touch
# memory files — agent state survives restarts.
#
# Sources, in order of preference:
#   1. /workspace/repo/projects/openclaw/app/workspaces/<id>/  (synced repo)
#   2. /app/workspaces/<id>/                                    (image baseline)

REPO_WORKSPACES_DIR="$REPO_APP_DIR/workspaces"
IMAGE_WORKSPACES_DIR="/app/workspaces"

if [ -d "$REPO_WORKSPACES_DIR" ]; then
  PERSONA_SOURCE_DIR="$REPO_WORKSPACES_DIR"
  echo "Persona source: synced repo ($PERSONA_SOURCE_DIR)"
elif [ -d "$IMAGE_WORKSPACES_DIR" ]; then
  PERSONA_SOURCE_DIR="$IMAGE_WORKSPACES_DIR"
  echo "Persona source: image baseline ($PERSONA_SOURCE_DIR)"
else
  PERSONA_SOURCE_DIR=""
  echo "WARNING: No workspaces/ directory found. Agents will boot with no persona files." >&2
fi

if [ -n "$PERSONA_SOURCE_DIR" ]; then
  for AGENT_ID in orchestrator devops worker tester; do
    SRC_DIR="$PERSONA_SOURCE_DIR/$AGENT_ID"
    DEST_DIR="$OPENCLAW_STATE_DIR/workspaces/$AGENT_ID"

    if [ ! -d "$SRC_DIR" ]; then
      echo "  $AGENT_ID: no source dir at $SRC_DIR — skipping" >&2
      continue
    fi

    mkdir -p "$DEST_DIR"

    # Copy ONLY persona files — never overwrite agent memory or daily notes.
    for FILE in SOUL.md AGENTS.md IDENTITY.md USER.md TOOLS.md HEARTBEAT.md BOOT.md; do
      if [ -f "$SRC_DIR/$FILE" ]; then
        cp "$SRC_DIR/$FILE" "$DEST_DIR/$FILE"
      fi
    done

    # Ensure the memory subdir exists so the agent has somewhere to write.
    mkdir -p "$DEST_DIR/memory"

    echo "  $AGENT_ID: persona seeded → $DEST_DIR"
  done
fi

# ---------- Cleanup: stale bootstrap files at /workspace/repo root -----------
# Earlier boots had agents.list[].workspace stripped to "/workspace/repo".
# The gateway's bootstrap ritual then created vanilla AGENTS.md, SOUL.md,
# etc. at the repo root, polluting `git status -sb` with untracked files
# and (worse) potentially being read as the active persona.
#
# These files don't belong in /workspace/repo — agent state lives under
# /workspace/.openclaw/workspaces/<id>/. Remove them if present and untracked.
if [ -d /workspace/repo ]; then
  for FILE in AGENTS.md SOUL.md IDENTITY.md USER.md TOOLS.md HEARTBEAT.md BOOT.md MEMORY.md; do
    F="/workspace/repo/$FILE"
    if [ -f "$F" ] && ! git -C /workspace/repo ls-files --error-unmatch "$FILE" >/dev/null 2>&1; then
      echo "  cleanup: removing stale bootstrap file /workspace/repo/$FILE"
      rm -f "$F"
    fi
  done
fi

# ---------- Pinned install: Honcho memory plugin ----------
# `RUN openclaw plugins install ...` in the Dockerfile silently no-ops at
# build time (gateway state dirs not yet initialized). Runtime install works.
# We pin a specific version and force-install on every boot so deploys can't
# silently drift to whatever ClawHub had last time the volume was wiped.
HONCHO_PLUGIN_VERSION="1.3.3"
INSTALLED_VERSION=$(cat /home/node/.openclaw/extensions/openclaw-honcho/package.json 2>/dev/null \
  | grep -E '"version"' | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')

if [ "$INSTALLED_VERSION" = "$HONCHO_PLUGIN_VERSION" ]; then
  echo "Honcho plugin v${HONCHO_PLUGIN_VERSION} already installed — skipping."
else
  if [ -n "$INSTALLED_VERSION" ]; then
    echo "Honcho plugin: installed=${INSTALLED_VERSION}, desired=${HONCHO_PLUGIN_VERSION} — reinstalling."
  else
    echo "Installing @honcho-ai/openclaw-honcho@${HONCHO_PLUGIN_VERSION}..."
  fi
  if openclaw plugins install --force "@honcho-ai/openclaw-honcho@${HONCHO_PLUGIN_VERSION}" 2>&1 | sed 's/^/  /'; then
    echo "Honcho plugin v${HONCHO_PLUGIN_VERSION} installed."
  else
    echo "WARNING: Honcho plugin install failed — gateway will boot without it." >&2
  fi
fi

# ---------- Idempotent register: GitNexus MCP server ----------
# `mcp.servers.gitnexus` in our committed openclaw.json gets stripped by the
# gateway's config validator (the server isn't "registered" via the official
# `openclaw mcp set` path). Register it via CLI here so the gateway accepts
# it as a known tool surface. Idempotent — re-running just overwrites.
echo "Registering GitNexus MCP server..."
openclaw mcp set gitnexus '{"command":"npx","args":["-y","gitnexus@latest","mcp"]}' 2>&1 | sed 's/^/  /' \
  || echo "WARNING: GitNexus MCP register failed — worker/tester won't have gitnexus_* tools." >&2

# ---------- Gateway auth ----------

if [ -n "$OPENCLAW_AUTH_TOKEN" ]; then
  openclaw config set gateway.auth.mode token
  openclaw config set gateway.auth.token "$OPENCLAW_AUTH_TOKEN"
fi

if [ -n "$OPENCLAW_ALLOWED_ORIGINS" ]; then
  ORIGINS_JSON=$(echo "$OPENCLAW_ALLOWED_ORIGINS" | awk -F',' '{for(i=1;i<=NF;i++) printf "\"%s\"%s", $i, (i<NF?",":""); print ""}')
  openclaw config set gateway.controlUi.allowedOrigins "[$ORIGINS_JSON]"
fi

exec "$@"
