#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------
# Ensure a Docker daemon is running (Colima replaces Docker Desktop)
# ---------------------------------------------------------------
if ! docker info &>/dev/null; then
  echo "No Docker daemon detected. Starting Colima..."
  colima start --cpu 4 --memory 10 --disk 60
  echo ""
fi

# ---------------------------------------------------------------
# Start Minikube
# ---------------------------------------------------------------
if minikube status &>/dev/null; then
  echo "Minikube is already running."
else
  echo "Starting Minikube cluster..."
  minikube start \
    --driver=docker \
    --cpus=4 \
    --memory=8192 \
    --disk-size=50g \
    --addons=ingress \
    --addons=registry \
    --addons=storage-provisioner \
    --addons=metrics-server
fi

echo ""
echo "Minikube is running."
echo "Use 'eval \$(minikube docker-env)' to build images."
echo "Registry available at localhost:30500"
