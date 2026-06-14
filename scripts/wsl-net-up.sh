#!/usr/bin/env bash
# Bring up the SafeChain dev network (fabric-samples test-network) inside WSL.
# Run from WSL:  bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-net-up.sh
set -e

TN="$HOME/safechain/fabric-samples/test-network"
cd "$TN"
export PATH="$HOME/.local/bin:$TN/../bin:$PATH"

echo "=== network down (clean) ==="
./network.sh down >/dev/null 2>&1 || true

echo "=== network up + competency channel (CouchDB) ==="
./network.sh up createChannel -c competency -s couchdb

echo "=== running containers ==="
docker ps --format '{{.Names}}\t{{.Status}}'
