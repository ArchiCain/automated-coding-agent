#!/usr/bin/env bash
set -e

# =============================================================================
# OpenClaw entrypoint
#
# All four agents (orchestrator, devops, worker, tester) reason via Ollama on
# graphics-machine (qwen-coder-next-256k) and embed via Ollama on host-machine
# (bge-m3-8k). Both endpoints are configured in openclaw.json. The gateway
# only needs OLLAMA_API_KEY set so the bundled provider plugin activates;
# any non-empty value works for self-hosted Ollama.
#
# Config and skills are sourced from the synced repo at /workspace/repo if
# available (updated continuously by the git-sync sidecar), falling back to
# the image-baked baseline at /app. This lets orchestrator edits to
# openclaw.json and skills/ on the `dev` branch take effect on the next pod
# restart without an image rebuild.
# =============================================================================

if [ -z "$OLLAMA_API_KEY" ]; then
  echo "ERROR: OLLAMA_API_KEY is not set. The Ollama provider plugin needs a non-empty value (use 'ollama-local' for self-hosted)." >&2
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

# ---------- Seed openclaw.json from the synced repo, falling back to /app ----------

SEED_SRC="$REPO_APP_DIR/openclaw.json"
if [ -f "$SEED_SRC" ]; then
  echo "Using openclaw.json from synced repo: $SEED_SRC"
else
  echo "Using openclaw.json from image baseline: /app/openclaw.json"
  SEED_SRC="/app/openclaw.json"
fi
# Drop any auto-restore artifacts the gateway uses to revert "unsanctioned"
# external edits. Without this, our synced openclaw.json gets replaced from
# .last-good / .bak on the next gateway boot ("missing-meta-vs-last-good"),
# silently undoing repo-tracked config changes.
cp "$SEED_SRC" "$OPENCLAW_STATE_DIR/openclaw.json"
cp "$SEED_SRC" "$OPENCLAW_STATE_DIR/openclaw.json.last-good"
rm -f "$OPENCLAW_STATE_DIR"/openclaw.json.bak \
      "$OPENCLAW_STATE_DIR"/openclaw.json.bak.* \
      "$OPENCLAW_STATE_DIR"/openclaw.json.clobbered.*

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
