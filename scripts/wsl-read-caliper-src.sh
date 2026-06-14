#!/usr/bin/env bash
CC="$HOME/safechain/caliper/node_modules/@hyperledger/caliper-fabric/lib"
echo "===== ConnectorConfiguration: contract details / contractID ====="
grep -n "contractID\|contractId\|_createContractDetailsById\|already been defined" "$CC/connector-configuration/ConnectorConfiguration.js" | head -40
echo
echo "===== PeerGateway: how request contractId/channel resolved ====="
sed -n '120,200p' "$CC/connector-versions/peer-gateway/PeerGateway.js"
echo "----- getContract lookup -----"
sed -n '340,380p' "$CC/connector-versions/peer-gateway/PeerGateway.js"
