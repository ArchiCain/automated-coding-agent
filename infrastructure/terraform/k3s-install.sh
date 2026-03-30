#!/bin/bash
set -e

exec > >(tee /var/log/k3s-install.log) 2>&1
echo "Starting K3s installation at $(date)"

cloud-init status --wait

apt-get update -y
apt-get upgrade -y

# Format and mount the data volume if not already mounted
DATA_DEVICE="/dev/xvdf"
DATA_MOUNT="/mnt/data"

if ! blkid "$DATA_DEVICE" > /dev/null 2>&1; then
  echo "Formatting data volume..."
  mkfs.ext4 "$DATA_DEVICE"
fi

mkdir -p "$DATA_MOUNT"
if ! grep -q "$DATA_MOUNT" /etc/fstab; then
  echo "$DATA_DEVICE $DATA_MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
fi
mount -a

# Create K3s data directories on the persistent volume
mkdir -p "$DATA_MOUNT/k3s/storage"
mkdir -p "$DATA_MOUNT/k3s/data"

# Install K3s with Traefik disabled (we'll install it via Helm)
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
  --data-dir=$DATA_MOUNT/k3s/data \
  --default-local-storage-path=$DATA_MOUNT/k3s/storage \
  --disable=traefik \
  --write-kubeconfig-mode=644" sh -

# Wait for K3s to be ready
echo "Waiting for K3s to be ready..."
until kubectl get nodes 2>/dev/null | grep -q " Ready"; do
  sleep 2
done

echo "K3s installation complete at $(date)"
echo "Kubeconfig available at /etc/rancher/k3s/k3s.yaml"
