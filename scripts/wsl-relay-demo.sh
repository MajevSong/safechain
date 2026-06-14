#!/usr/bin/env bash
# Demonstrate the integrity-preserving cross-channel accident workflow live:
#   subcontractor SubmitAccident (competency)  ->  PENDING_ATTESTATION
#   auditor       AttestAccident (competency)  ->  ATTESTED + ACCIDENT_ATTESTED
#   relay (contractor, dual-channel) ReportAccident (premium) -> premium update
# Run after the network is up and chaincode deployed.
set -e
NET="$HOME/safechain/safechain-net"
BIN="$HOME/safechain/fabric-samples/bin"
export PATH="$HOME/.local/bin:$BIN:$PATH"
ORD=localhost:7050; ORD_HOST=orderer.safechain.com
ORDERER_CA="$NET/organizations/ordererOrganizations/safechain.com/orderers/orderer.safechain.com/tls/ca.crt"
ORG="$NET/organizations/peerOrganizations"
caFile(){ echo "$ORG/$1/peers/peer0.$1/tls/ca.crt"; }
setPeer(){ export FABRIC_CFG_PATH="$NET/peercfg" CORE_PEER_TLS_ENABLED=true CORE_PEER_LOCALMSPID="$2" \
  CORE_PEER_TLS_ROOTCERT_FILE="$(caFile $1)" CORE_PEER_MSPCONFIGPATH="$ORG/$1/users/Admin@$1/msp" CORE_PEER_ADDRESS="localhost:$3"; }

inv(){ # channel  json  peers...
  local ch="$1"; shift; local json="$1"; shift
  peer chaincode invoke -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
    -C "$ch" -n safechain "$@" -c "$json" 2>&1 | grep -oE 'status:200.*|Error.*' | head -1
  sleep 2
}
ACC="ACC-$(date +%s)"

echo "### 1) Subcontractor submits accident on COMPETENCY channel ###"
setPeer subcontractor.safechain.com SubcontractorMSP 8051
inv competency "{\"function\":\"AccidentIntakeContract:SubmitAccident\",\"Args\":[\"$ACC\",\"W-3001\",\"Beta Kalip\",\"high\",\"scaffold collapse\",\"projX\"]}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:8051 --tlsRootCertFiles "$(caFile subcontractor.safechain.com)" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$(caFile insurer.safechain.com)"

echo "### 2) Status after submission (expect PENDING_ATTESTATION) ###"
peer chaincode query -C competency -n safechain -c "{\"function\":\"AccidentIntakeContract:GetAccident\",\"Args\":[\"$ACC\"]}"; echo

echo "### 3) Auditor/inspector attests on COMPETENCY channel ###"
setPeer auditor.safechain.com AuditorMSP 10051
inv competency "{\"function\":\"AccidentIntakeContract:AttestAccident\",\"Args\":[\"$ACC\"]}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "$(caFile auditor.safechain.com)"

echo "### 4) Status after attestation (expect ATTESTED) ###"
peer chaincode query -C competency -n safechain -c "{\"function\":\"AccidentIntakeContract:GetAccident\",\"Args\":[\"$ACC\"]}"; echo

echo "### 5) RELAY (contractor, dual-channel member) propagates to PREMIUM channel ###"
setPeer contractor.safechain.com ContractorMSP 7051
inv premium "{\"function\":\"AccidentPremiumContract:ReportAccident\",\"Args\":[\"W-3001\",\"Beta Kalip\",\"high\",\"relayed:$ACC\",\"projX\"]}" \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$(caFile insurer.safechain.com)"

echo "### 6) Premium on PREMIUM channel (expect factor reflecting high-severity accident) ###"
peer chaincode query -C premium -n safechain -c '{"function":"AccidentPremiumContract:GetPremium","Args":["projX"]}'; echo
echo "### cross-channel flow complete (integrity: premium update is linked to an inspector-attested, hash-anchored accident) ###"
