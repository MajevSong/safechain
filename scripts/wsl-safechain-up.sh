#!/usr/bin/env bash
# Bring up the faithful SafeChain 4-org / 2-channel network in WSL.
# Run: bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-safechain-up.sh
set -e

SRC="/mnt/d/Dev/simulation_blockchain/network"
NET="$HOME/safechain/safechain-net"
BIN="$HOME/safechain/fabric-samples/bin"
PEERCFG_SRC="$HOME/safechain/fabric-samples/test-network/compose/docker/peercfg"
export PATH="$HOME/.local/bin:$BIN:$PATH"

echo "=== tear down any previous safechain network ==="
if [ -f "$NET/compose-safechain.yaml" ]; then
  docker compose -p safechain -f "$NET/compose-safechain.yaml" down --volumes --remove-orphans 2>/dev/null || true
fi
docker rm -f $(docker ps -aq --filter "name=_safechain_ccaas") 2>/dev/null || true

echo "=== sync config into WSL-native dir ==="
rm -rf "$NET"
mkdir -p "$NET/channel-artifacts"
cp "$SRC/crypto-config.yaml" "$SRC/configtx.yaml" "$SRC/compose-safechain.yaml" "$NET/"
cp -r "$PEERCFG_SRC" "$NET/peercfg"

cd "$NET"
export FABRIC_CFG_PATH="$NET"

echo "=== cryptogen: generate crypto material ==="
cryptogen generate --config=./crypto-config.yaml --output=organizations

echo "=== configtxgen: channel genesis blocks (competency, premium) ==="
configtxgen -profile SafeChainCompetency -outputBlock ./channel-artifacts/competency.block -channelID competency
configtxgen -profile SafeChainPremium    -outputBlock ./channel-artifacts/premium.block    -channelID premium

echo "=== docker compose up ==="
docker compose -p safechain -f compose-safechain.yaml up -d

ORGDIR="organizations/ordererOrganizations/safechain.com/orderers"
ORDERERS="orderer.safechain.com:7053 orderer2.safechain.com:8053 orderer3.safechain.com:9053"
ORD_TLSDIR="$ORGDIR/orderer.safechain.com/tls"   # used for the final channel list

echo "=== wait for all 3 orderer admin endpoints ==="
for pair in $ORDERERS; do
  host=${pair%:*}; port=${pair#*:}; td="$ORGDIR/$host/tls"
  for i in $(seq 1 30); do
    if osnadmin channel list -o localhost:$port --ca-file "$td/ca.crt" \
         --client-cert "$td/server.crt" --client-key "$td/server.key" >/dev/null 2>&1; then
      echo "  $host admin ready"; break
    fi
    sleep 2
  done
done

osnJoinAll() {  # channel: join all 3 orderers to form the Raft cluster
  for pair in $ORDERERS; do
    host=${pair%:*}; port=${pair#*:}; td="$ORGDIR/$host/tls"
    osnadmin channel join --channelID "$1" --config-block "./channel-artifacts/$1.block" \
      -o localhost:$port --ca-file "$td/ca.crt" \
      --client-cert "$td/server.crt" --client-key "$td/server.key" >/dev/null 2>&1 \
      && echo "  $host joined $1" || echo "  $host join $1 FAILED"
  done
}
echo "=== 3-node Raft: orderers join both channels ==="
osnJoinAll competency
osnJoinAll premium
sleep 5   # allow Raft leader election across the cluster

# ---- peer channel join helper ----------------------------------------------
ORG_DIR="organizations/peerOrganizations"
joinPeer() {
  local domain="$1" mspid="$2" port="$3" channel="$4"
  export FABRIC_CFG_PATH="$NET/peercfg"   # peer CLI needs core.yaml, not configtx.yaml
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="$mspid"
  export CORE_PEER_TLS_ROOTCERT_FILE="$NET/$ORG_DIR/$domain/peers/peer0.$domain/tls/ca.crt"
  export CORE_PEER_MSPCONFIGPATH="$NET/$ORG_DIR/$domain/users/Admin@$domain/msp"
  export CORE_PEER_ADDRESS="localhost:$port"
  echo "  - $mspid (localhost:$port) -> $channel"
  for i in $(seq 1 5); do
    if peer channel join -b "./channel-artifacts/$channel.block" >/dev/null 2>&1; then
      echo "    joined"; return 0
    fi
    sleep 3
  done
  echo "    FAILED to join $channel"; return 1
}

echo "=== peers join competency channel (all four orgs) ==="
joinPeer contractor.safechain.com    ContractorMSP    7051  competency
joinPeer subcontractor.safechain.com SubcontractorMSP 8051  competency
joinPeer insurer.safechain.com       InsurerMSP       9051  competency
joinPeer auditor.safechain.com       AuditorMSP       10051 competency

echo "=== peers join premium channel (contractor + insurer) ==="
joinPeer contractor.safechain.com ContractorMSP 7051 premium
joinPeer insurer.safechain.com    InsurerMSP    9051 premium

echo "=== running containers ==="
docker ps --format '{{.Names}}\t{{.Status}}' | sort
echo "=== orderer channel list ==="
osnadmin channel list -o localhost:7053 --ca-file "$ORD_TLSDIR/ca.crt" \
  --client-cert "$ORD_TLSDIR/server.crt" --client-key "$ORD_TLSDIR/server.key"
