#!/usr/bin/env bash
# Fault-tolerance demo: a 3-node Raft cluster tolerates the loss of one orderer.
# Submit a tx with all 3 up, then KILL one orderer (quorum 2/3 remains) and show
# the network still commits, then recover the orderer.
set -e
NET="$HOME/safechain/safechain-net"
BIN="$HOME/safechain/fabric-samples/bin"
export PATH="$HOME/.local/bin:$BIN:$PATH"
ORDERER_CA="$NET/organizations/ordererOrganizations/safechain.com/orderers/orderer.safechain.com/tls/ca.crt"
ORG="$NET/organizations/peerOrganizations"
caFile(){ echo "$ORG/$1/peers/peer0.$1/tls/ca.crt"; }
export FABRIC_CFG_PATH="$NET/peercfg" CORE_PEER_TLS_ENABLED=true CORE_PEER_LOCALMSPID=ContractorMSP \
  CORE_PEER_TLS_ROOTCERT_FILE="$(caFile contractor.safechain.com)" \
  CORE_PEER_MSPCONFIGPATH="$ORG/contractor.safechain.com/users/Admin@contractor.safechain.com/msp" \
  CORE_PEER_ADDRESS=localhost:7051

reg(){ # label
  local id="FT-$(date +%s%N | tail -c 7)"
  printf '  [%s] ' "$1"
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.safechain.com \
    --tls --cafile "$ORDERER_CA" -C competency -n safechain \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
    --peerAddresses localhost:8051 --tlsRootCertFiles "$(caFile subcontractor.safechain.com)" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
    -c "{\"function\":\"CompetencyContract:RegisterCertificate\",\"Args\":[\"$id\",\"Sub\",\"Yuksekte Calisma\",\"2026-12-30\",\"d\"]}" 2>&1 \
    | grep -oE 'Chaincode invoke successful.*|Error[^"]*' | head -1
  sleep 2
}

echo "=== orderers before ==="; docker ps --format '{{.Names}} {{.Status}}' | grep orderer | sort
echo "### 1) all 3 orderers up — submit tx ###"; reg "3/3 up"

echo "### 2) KILL orderer3 (simulate node/host failure) ###"
docker stop orderer3.safechain.com >/dev/null && echo "  orderer3 stopped"
sleep 3
echo "### 3) only 2/3 orderers — Raft quorum holds — submit tx ###"; reg "2/3 (orderer3 down)"
reg "2/3 again"

echo "### 4) recover orderer3 ###"
docker start orderer3.safechain.com >/dev/null && echo "  orderer3 restarted"
sleep 6
echo "### 5) cluster healed — submit tx ###"; reg "3/3 recovered"
echo "=== orderers after ==="; docker ps --format '{{.Names}} {{.Status}}' | grep orderer | sort
echo "FAULT_TOLERANCE_DONE"
