#!/usr/bin/env bash
F="$HOME/safechain/fabric-samples"
echo "=== deployCCAAS support in network.sh ==="
grep -c deployCCAAS "$F/test-network/network.sh" || echo 0
echo
echo "=== external chaincode sample dir ==="
ls "$F/asset-transfer-basic/chaincode-external" 2>&1 || echo "MISSING"
echo
echo "=== sample Dockerfile ==="
cat "$F/asset-transfer-basic/chaincode-external/Dockerfile" 2>&1 || echo "no Dockerfile"
echo
echo "=== deployCCAAS usage help ==="
grep -nE 'deployCCAAS|ccaasdocker|CCAAS' "$F/test-network/network.sh" | head -20
echo
echo "=== monitordocker / ccaas scripts ==="
ls "$F/test-network/scripts/" | grep -iE 'ccaas|deploy' || true
