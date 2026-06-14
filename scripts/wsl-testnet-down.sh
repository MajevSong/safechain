#!/usr/bin/env bash
set -e
export PATH="$HOME/.local/bin:$HOME/safechain/fabric-samples/bin:$PATH"
cd "$HOME/safechain/fabric-samples/test-network"
docker rm -f peer0org1_safechain_ccaas peer0org2_safechain_ccaas 2>/dev/null || true
./network.sh down 2>&1 | tail -4
echo "=== remaining containers ==="
docker ps --format '{{.Names}}' || true
