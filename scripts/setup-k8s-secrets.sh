#!/usr/bin/env bash
set -euo pipefail

# Load .env
set -a
source .env
set +a

NAMESPACE="${CODING_AGENT_NAMESPACE:-coding-agent}"

echo "Creating namespace ${NAMESPACE}..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

echo "Creating GitHub App private key secret..."
if [ -f "${GITHUB_APP_PRIVATE_KEY_PATH:-.github-app-private-key.pem}" ]; then
  kubectl create secret generic github-app-key \
    --namespace "${NAMESPACE}" \
    --from-file=private-key.pem="${GITHUB_APP_PRIVATE_KEY_PATH:-.github-app-private-key.pem}" \
    --dry-run=client -o yaml | kubectl apply -f -
  echo "  Created github-app-key secret"
else
  echo "  WARNING: No private key file found at ${GITHUB_APP_PRIVATE_KEY_PATH}"
fi

echo "Done. Secrets will be applied via Helmfile secretEnv values."
