#!/usr/bin/env bash
# Install the SafeChain web backend in WSL (Fabric Gateway needs node_modules
# co-located; certs are read from ~/safechain/safechain-net at runtime).
set -e
export PATH="$HOME/.local/bin:$PATH"
SRC="/mnt/d/Dev/simulation_blockchain/webapp"
APP="$HOME/safechain/webapp"
mkdir -p "$APP"
rsync -a --delete --exclude node_modules "$SRC"/ "$APP"/
cd "$APP"
echo "=== npm install (express, fabric-gateway, grpc-js) ==="
npm install --no-fund --no-audit 2>&1 | tail -4
echo "=== versions ==="
node -e "console.log('fabric-gateway', require('@hyperledger/fabric-gateway/package.json').version)"
echo "WEBAPP_READY"
