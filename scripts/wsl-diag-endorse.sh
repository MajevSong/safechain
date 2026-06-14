#!/usr/bin/env bash
echo "=== ccaas containers ==="
docker ps --format '{{.Names}}\t{{.Status}}' | grep ccaas
echo
echo "=== peer0.contractor recent endorse/gossip logs ==="
docker logs peer0.contractor.safechain.com 2>&1 | grep -iE 'endors|gossip|premium|insurer|error|chaincode' | tail -20
echo
echo "=== peer0.insurer recent logs ==="
docker logs peer0.insurer.safechain.com 2>&1 | grep -iE 'endors|premium|error|chaincode|gossip' | tail -15
echo
echo "=== insurer ccaas container logs ==="
docker logs peer0insurer_safechain_ccaas 2>&1 | tail -15
