#!/usr/bin/env bash
# Install host-side tooling SafeChain needs inside WSL: jq (network scripts) and
# Node.js 20 + npm (Node chaincode tests, Caliper benchmarking).
set -e

. /etc/os-release
echo "distro: $NAME $VERSION_ID"

echo "=== apt update + jq ==="
sudo apt-get update -y -qq
sudo apt-get install -y -qq jq curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  echo "=== installing Node.js 20 (NodeSource) ==="
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y -qq nodejs
fi

echo "=== versions ==="
echo "jq:   $(jq --version 2>&1)"
echo "node: $(node --version 2>&1)"
echo "npm:  $(npm --version 2>&1)"
