#!/usr/bin/env bash
# Endorsement-policy ablation: re-commit the competency chaincode under 1-of-4,
# 2-of-4 and 3-of-4 signature policies and benchmark RegisterCertificate for each.
set -e
NET="$HOME/safechain/safechain-net"
BIN="$HOME/safechain/fabric-samples/bin"
export PATH="$HOME/.local/bin:$BIN:$PATH"
CC_NAME=safechain; ORD=localhost:7050; ORD_HOST=orderer.safechain.com
ORDERER_CA="$NET/organizations/ordererOrganizations/safechain.com/orderers/orderer.safechain.com/tls/ca.crt"
ORG="$NET/organizations/peerOrganizations"
caFile(){ echo "$ORG/$1/peers/peer0.$1/tls/ca.crt"; }
setPeer(){ export FABRIC_CFG_PATH="$NET/peercfg" CORE_PEER_TLS_ENABLED=true CORE_PEER_LOCALMSPID="$2" \
  CORE_PEER_TLS_ROOTCERT_FILE="$(caFile $1)" CORE_PEER_MSPCONFIGPATH="$ORG/$1/users/Admin@$1/msp" CORE_PEER_ADDRESS="localhost:$3"; }

cd "$NET"
setPeer contractor.safechain.com ContractorMSP 7051
PKGID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
P4="'ContractorMSP.peer','SubcontractorMSP.peer','InsurerMSP.peer','AuditorMSP.peer'"

redeploy(){ # n  seq   (commit competency def with OutOf(n,4) policy)
  local n="$1" seq="$2" pol="OutOf($1,$P4)"
  echo "  approving seq=$seq policy=$pol"
  for o in "contractor.safechain.com ContractorMSP 7051" "subcontractor.safechain.com SubcontractorMSP 8051" \
           "insurer.safechain.com InsurerMSP 9051" "auditor.safechain.com AuditorMSP 10051"; do
    set -- $o; setPeer "$1" "$2" "$3"
    peer lifecycle chaincode approveformyorg -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
      --channelID competency --name $CC_NAME --version 1.0 --package-id "$PKGID" --sequence "$seq" \
      --signature-policy "$pol" >/dev/null 2>&1 || true
  done
  setPeer contractor.safechain.com ContractorMSP 7051
  peer lifecycle chaincode commit -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
    --channelID competency --name $CC_NAME --version 1.0 --sequence "$seq" --signature-policy "$pol" \
    --peerAddresses localhost:7051  --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
    --peerAddresses localhost:8051  --tlsRootCertFiles "$(caFile subcontractor.safechain.com)" \
    --peerAddresses localhost:9051  --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
    --peerAddresses localhost:10051 --tlsRootCertFiles "$(caFile auditor.safechain.com)" >/dev/null 2>&1 \
    && echo "  committed $pol (seq $seq)"
}

run(){ # n seq label
  redeploy "$1" "$2"; sleep 4
  export RUN_PREFIX="e$1of4"
  echo "=== benchmark endorsement $1-of-4 ==="
  bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-caliper-run.sh endorse >/dev/null 2>&1 || true
  cp -f "$HOME/safechain/caliper/report-endorse.html" "/mnt/d/Dev/simulation_blockchain/caliper/results/report-endorse-$1of4.html" 2>/dev/null || true
  echo "--- $1-of-4 result ---"
  bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-show-report.sh "$HOME/safechain/caliper/report-endorse.html" 2>/dev/null | head -1
}

run 1 5
run 2 6
run 3 7
echo "ENDORSE_ABLATION_DONE"
