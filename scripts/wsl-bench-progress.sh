#!/usr/bin/env bash
echo "=== caliper process alive? ==="
pgrep -af "caliper" | head -5 || echo "no caliper process"
echo
echo "=== current time ==="; date "+%H:%M:%S"
echo
echo "=== peer0.contractor: last committed block + recent tx rate ==="
docker logs --since 30s peer0.contractor.safechain.com 2>&1 | grep -c "Committed block" | sed 's/^/blocks committed in last 30s: /'
docker logs peer0.contractor.safechain.com 2>&1 | grep "Committed block" | tail -1
echo
echo "=== chaincode container CPU (is it working?) ==="
docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | grep -E 'ccaas|peer0.contractor' | head -6