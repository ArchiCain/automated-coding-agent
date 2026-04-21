#!/usr/bin/env bash
set -euo pipefail

# Generates a mkcert-signed wildcard cert for *.${DEV_HOSTNAME} + ${DEV_HOSTNAME}
# and writes it to .certs/ at the repo root. The mkcert root CA is installed
# into the local system trust store so browsers trust this cert without warning.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
CERT_DIR="$REPO_ROOT/.certs"

if [ -z "${DEV_HOSTNAME:-}" ]; then
  echo "ERROR: DEV_HOSTNAME is not set."
  echo "  Source .env first, or run via task (which does that automatically)."
  exit 1
fi

if ! command -v mkcert >/dev/null 2>&1; then
  echo "ERROR: mkcert is not installed."
  echo "  macOS:  brew install mkcert nss"
  echo "         (nss is needed for Firefox trust-store integration)"
  exit 1
fi

echo "Installing mkcert root CA into the system trust store (idempotent)..."
mkcert -install

mkdir -p "$CERT_DIR"

CERT="$CERT_DIR/dev-wildcard.crt"
KEY="$CERT_DIR/dev-wildcard.key"

echo "Issuing cert for *.${DEV_HOSTNAME} and ${DEV_HOSTNAME}..."
mkcert \
  -cert-file "$CERT" \
  -key-file  "$KEY" \
  "*.${DEV_HOSTNAME}" "${DEV_HOSTNAME}"

echo ""
echo "Cert:  $CERT"
echo "Key:   $KEY"
