#!/usr/bin/env bash
# Commit the competency chaincode definition WITH a private-data collections
# config (workerPiiCollection, accidentReportCollection) so PDC writes work.
# Reverts to the default (MAJORITY) endorsement policy. Sequence passed as $1.
set -e
SEQ="${1:-8}"
NET="$HOME/safechain/safechain-net"
BIN="$HOME/safechain/fabric-samples/bin"
export PATH="$HOME/.local/bin:$BIN:$PATH"
CC_NAME=safechain; ORD=localhost:7050; ORD_HOST=orderer.safechain.com
ORDERER_CA="$NET/organizations/ordererOrganizations/safechain.com/orderers/orderer.safechain.com/tls/ca.crt"
ORG="$NET/organizations/peerOrganizations"
caFile(){ echo "$ORG/$1/peers/peer0.$1/tls/ca.crt"; }
setPeer(){ export FABRIC_CFG_PATH="$NET/peercfg" CORE_PEER_TLS_ENABLED=true CORE_PEER_LOCALMSPID="$2" \
  CORE_PEER_TLS_ROOTCERT_FILE="$(caFile $1)" CORE_PEER_MSPCONFIGPATH="$ORG/$1/users/Admin@$1/msp" CORE_PEER_ADDRESS="localhost:$3"; }

cp -f /mnt/d/Dev/simulation_blockchain/network/collections_config.json "$NET/collections_config.json"
cd "$NET"
setPeer contractor.safechain.com ContractorMSP 7051
PKGID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
echo "seq=$SEQ pkg=$PKGID, adding collections to competency"

for o in "contractor.safechain.com ContractorMSP 7051" "subcontractor.safechain.com SubcontractorMSP 8051" \
         "insurer.safechain.com InsurerMSP 9051" "auditor.safechain.com AuditorMSP 10051"; do
  set -- $o; setPeer "$1" "$2" "$3"
  peer lifecycle chaincode approveformyorg -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
    --channelID competency --name $CC_NAME --version 1.0 --package-id "$PKGID" --sequence "$SEQ" \
    --collections-config "$NET/collections_config.json" >/dev/null 2>&1 || true
done
setPeer contractor.safechain.com ContractorMSP 7051
peer lifecycle chaincode commit -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
  --channelID competency --name $CC_NAME --version 1.0 --sequence "$SEQ" \
  --collections-config "$NET/collections_config.json" \
  --peerAddresses localhost:7051  --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:8051  --tlsRootCertFiles "$(caFile subcontractor.safechain.com)" \
  --peerAddresses localhost:9051  --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "$(caFile auditor.safechain.com)" \
  && echo "committed competency seq $SEQ with collections"
echo "COLLECTIONS_DEPLOY_DONE"
