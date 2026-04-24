#!/bin/bash
# EC2 user-data for the scain-coding-agent compose host.
#
# Runs as root under cloud-init on a fresh Ubuntu 24.04 EC2 instance.
# Installs docker, tailscale, caddy; clones the repo to /srv/aca; wires
# the persistent data volume at /mnt/data and points the docker data-root
# at it so container state survives instance replacement.
#
# Terraform's templatefile() substitutes these placeholders before upload:
#   TAILSCALE_AUTH_KEY  — reusable Tailscale auth key (sensitive)
#   DOMAIN              — base domain (e.g. scain-coding-agent.dev)
#   REPO_URL            — repo to clone into /srv/aca
#   REPO_BRANCH         — branch to check out
#
# Bash variables that terraform must NOT substitute use a doubled-dollar
# escape in the source (the terraform templatefile() docs explain how $$
# escapes one dollar sign).
set -euo pipefail
exec > >(tee /var/log/user-data.log) 2>&1
echo "Starting user-data at $(date)"
cloud-init status --wait

# -----------------------------------------------------------------------------
# 1. Base system
# -----------------------------------------------------------------------------
apt-get update -y
apt-get install -y ca-certificates curl gnupg git jq rsync

# -----------------------------------------------------------------------------
# 2. Mount the data volume at /mnt/data
# -----------------------------------------------------------------------------
# Heuristic: pick the first block device that's 50G and not partitioned.
# If the device naming scheme changes (xvdf vs nvme1n1) this still finds it.
DATA_DEVICE=$(lsblk -dpno NAME,SIZE | awk '$2=="50G"{print $1; exit}')
DATA_MOUNT=/mnt/data
if [ -n "$${DATA_DEVICE}" ] && ! blkid "$${DATA_DEVICE}" >/dev/null 2>&1; then
  echo "Formatting $${DATA_DEVICE} as ext4"
  mkfs.ext4 "$${DATA_DEVICE}"
fi
mkdir -p "$${DATA_MOUNT}"
if [ -n "$${DATA_DEVICE}" ] && ! grep -q "$${DATA_MOUNT}" /etc/fstab; then
  echo "UUID=$(blkid -s UUID -o value "$${DATA_DEVICE}") $${DATA_MOUNT} ext4 defaults,nofail 0 2" >> /etc/fstab
fi
mount -a || true
mkdir -p "$${DATA_MOUNT}/docker"

# -----------------------------------------------------------------------------
# 3. Docker (official apt repo); data-root on /mnt/data so it survives
#    instance replacement.
# -----------------------------------------------------------------------------
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$${VERSION_CODENAME}") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Point docker at the data volume before first container ever runs.
systemctl stop docker.socket docker || true
mkdir -p /mnt/data/docker
cat >/etc/docker/daemon.json <<'JSON'
{ "data-root": "/mnt/data/docker" }
JSON
systemctl enable --now docker
usermod -aG docker ubuntu

# Capture the docker socket gid for deploy.sh / .env templating downstream.
stat -c %g /var/run/docker.sock > /etc/docker-socket.gid

# -----------------------------------------------------------------------------
# 4. Tailscale — node joins the tailnet and enables Tailscale SSH so deploys
#    come in over the tailnet with no public :22 exposure.
# -----------------------------------------------------------------------------
curl -fsSL https://tailscale.com/install.sh | sh
systemctl enable --now tailscaled
if [ -n "${TAILSCALE_AUTH_KEY}" ]; then
  tailscale up \
    --authkey "${TAILSCALE_AUTH_KEY}" \
    --hostname scain-coding-agent \
    --ssh \
    --accept-routes \
    || true
fi

# -----------------------------------------------------------------------------
# 5. Caddy (Cloudsmith apt repo).
# -----------------------------------------------------------------------------
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  -o /etc/apt/sources.list.d/caddy-stable.list
apt-get update -y
apt-get install -y caddy

# -----------------------------------------------------------------------------
# 6. Repo clone + Caddyfile + caddy.env
# -----------------------------------------------------------------------------
mkdir -p /srv
if [ ! -d /srv/aca/.git ]; then
  git clone --depth 1 \
    --branch "${REPO_BRANCH}" \
    "${REPO_URL}" \
    /srv/aca
fi

cp /srv/aca/infrastructure/caddy/Caddyfile /etc/caddy/Caddyfile
mkdir -p /etc/caddy/sandbox.d
chown -R caddy:caddy /etc/caddy
echo "DOMAIN=${DOMAIN}" > /etc/caddy/caddy.env

# Make caddy pick up /etc/caddy/caddy.env on start.
mkdir -p /etc/systemd/system/caddy.service.d
cat >/etc/systemd/system/caddy.service.d/override.conf <<'UNIT'
[Service]
EnvironmentFile=/etc/caddy/caddy.env
UNIT
systemctl daemon-reload
systemctl enable --now caddy

echo "user-data complete at $(date)"
