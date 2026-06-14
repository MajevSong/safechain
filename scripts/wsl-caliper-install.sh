#!/usr/bin/env bash
# Install Hyperledger Caliper (CLI + Fabric Gateway binding) in WSL.
set -e
export PATH="$HOME/.local/bin:$PATH"
CAL="$HOME/safechain/caliper"
mkdir -p "$CAL"
cd "$CAL"

if [ ! -f package.json ]; then
  npm init -y >/dev/null
fi
echo "=== installing @hyperledger/caliper-cli@0.6.0 ==="
npm install --no-fund --no-audit --save @hyperledger/caliper-cli@0.6.0 2>&1 | tail -5

echo "=== binding SUT: fabric (gateway) ==="
npx caliper bind --caliper-bind-sut fabric:fabric-gateway 2>&1 | tail -8

echo "=== versions ==="
npx caliper --version 2>&1 | tail -2
