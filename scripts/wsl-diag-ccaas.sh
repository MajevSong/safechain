#!/usr/bin/env bash
echo "=== ccaas containers (running) ==="
docker ps -a --format '{{.Names}}\t{{.Status}}' | grep ccaas || echo "none"
echo
echo "=== logs: peer0org1_safechain_ccaas ==="
docker logs peer0org1_safechain_ccaas 2>&1 | tail -30 || echo "no container"
echo
echo "=== logs: peer0org2_safechain_ccaas ==="
docker logs peer0org2_safechain_ccaas 2>&1 | tail -10 || echo "no container"
