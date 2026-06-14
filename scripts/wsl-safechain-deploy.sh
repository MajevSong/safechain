#!/usr/bin/env bash
# Deploy the SafeChain chaincode (CCAAS) onto the 4-org network:
#   competency channel -> all 4 orgs ;  premium channel -> contractor + insurer.
# Run: bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-safechain-deploy.sh
set -e

NET="$HOME/safechain/safechain-net"
BIN="$HOME/safechain/fabric-samples/bin"
SRC="/mnt/d/Dev/simulation_blockchain/chaincode"
CC="$HOME/safechain/chaincode"
export PATH="$HOME/.local/bin:$BIN:$PATH"

CC_NAME=safechain
CC_VERSION=1.0
CC_SEQUENCE=1
ORD=localhost:7050
ORD_HOST=orderer.safechain.com
ORDERER_CA="$NET/organizations/ordererOrganizations/safechain.com/orderers/orderer.safechain.com/tls/ca.crt"
ORG="$NET/organizations/peerOrganizations"

caFile()  { echo "$ORG/$1/peers/peer0.$1/tls/ca.crt"; }
setPeer() {  # domain mspid port
  export FABRIC_CFG_PATH="$NET/peercfg"
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="$2"
  export CORE_PEER_TLS_ROOTCERT_FILE="$(caFile $1)"
  export CORE_PEER_MSPCONFIGPATH="$ORG/$1/users/Admin@$1/msp"
  export CORE_PEER_ADDRESS="localhost:$3"
}

echo "=== sync + build CCAAS image (host docker / BuildKit) ==="
mkdir -p "$CC"; rsync -a --delete --exclude node_modules --exclude test "$SRC"/ "$CC"/
docker build -f "$CC/Dockerfile" -t ${CC_NAME}_ccaas_image:latest --build-arg CC_SERVER_PORT=9999 "$CC" >/tmp/ccbuild.log 2>&1 \
  && echo "image built" || { tail -20 /tmp/ccbuild.log; exit 1; }

echo "=== package ccaas ==="
cd "$NET"
TMP=$(mktemp -d); mkdir -p "$TMP/src" "$TMP/pkg"
cat > "$TMP/src/connection.json" <<EOF
{ "address": "{{.peername}}_${CC_NAME}_ccaas:9999", "dial_timeout": "10s", "tls_required": false }
EOF
cat > "$TMP/pkg/metadata.json" <<EOF
{ "type": "ccaas", "label": "${CC_NAME}_${CC_VERSION}" }
EOF
tar -C "$TMP/src" -czf "$TMP/pkg/code.tar.gz" .
tar -C "$TMP/pkg" -czf "$NET/${CC_NAME}.tar.gz" metadata.json code.tar.gz
rm -rf "$TMP"

setPeer contractor.safechain.com ContractorMSP 7051
PKGID=$(peer lifecycle chaincode calculatepackageid ${CC_NAME}.tar.gz)
echo "package id: $PKGID"

echo "=== install on all 4 peers ==="
install() { setPeer "$1" "$2" "$3"; peer lifecycle chaincode install ${CC_NAME}.tar.gz >/dev/null 2>&1 && echo "  installed on $2"; }
install contractor.safechain.com    ContractorMSP    7051
install subcontractor.safechain.com SubcontractorMSP 8051
install insurer.safechain.com       InsurerMSP       9051
install auditor.safechain.com       AuditorMSP       10051

echo "=== (re)start one CCAAS container per peer on safechain_net ==="
runCC() {  # peername
  docker rm -f "${1}_${CC_NAME}_ccaas" >/dev/null 2>&1 || true
  docker run --rm -d --name "${1}_${CC_NAME}_ccaas" --network safechain_net \
    -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
    -e CHAINCODE_ID="$PKGID" -e CORE_CHAINCODE_ID_NAME="$PKGID" \
    ${CC_NAME}_ccaas_image:latest >/dev/null && echo "  started ${1}_${CC_NAME}_ccaas"
}
runCC peer0contractor
runCC peer0subcontractor
runCC peer0insurer
runCC peer0auditor
sleep 6   # let chaincode servers boot before endorsement

approve() {  # domain mspid port channel
  setPeer "$1" "$2" "$3"
  peer lifecycle chaincode approveformyorg -o $ORD --ordererTLSHostnameOverride $ORD_HOST \
    --tls --cafile "$ORDERER_CA" --channelID "$4" --name $CC_NAME \
    --version $CC_VERSION --package-id "$PKGID" --sequence $CC_SEQUENCE >/dev/null 2>&1 \
    && echo "  approved $2 on $4"
}

echo "=== competency channel: approve (4 orgs) + commit ==="
approve contractor.safechain.com    ContractorMSP    7051  competency
approve subcontractor.safechain.com SubcontractorMSP 8051  competency
approve insurer.safechain.com       InsurerMSP       9051  competency
approve auditor.safechain.com       AuditorMSP       10051 competency
setPeer contractor.safechain.com ContractorMSP 7051
peer lifecycle chaincode commit -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
  --channelID competency --name $CC_NAME --version $CC_VERSION --sequence $CC_SEQUENCE \
  --peerAddresses localhost:7051  --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:8051  --tlsRootCertFiles "$(caFile subcontractor.safechain.com)" \
  --peerAddresses localhost:9051  --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
  --peerAddresses localhost:10051 --tlsRootCertFiles "$(caFile auditor.safechain.com)" \
  && echo "  committed on competency"

echo "=== premium channel: approve (contractor + insurer) + commit ==="
approve contractor.safechain.com ContractorMSP 7051 premium
approve insurer.safechain.com    InsurerMSP    9051 premium
setPeer contractor.safechain.com ContractorMSP 7051
peer lifecycle chaincode commit -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
  --channelID premium --name $CC_NAME --version $CC_VERSION --sequence $CC_SEQUENCE \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
  && echo "  committed on premium"

echo; echo "########## 4-ORG SMOKE ##########"
sleep 3
setPeer contractor.safechain.com ContractorMSP 7051
echo "--- competency: RegisterCertificate (W-3001) as Contractor ---"
peer chaincode invoke -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
  -C competency -n $CC_NAME \
  --peerAddresses localhost:7051  --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:8051  --tlsRootCertFiles "$(caFile subcontractor.safechain.com)" \
  --peerAddresses localhost:9051  --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
  -c '{"function":"CompetencyContract:RegisterCertificate","Args":["W-3001","Beta Kalip","Yuksekte Calisma","2026-12-30","cert"]}' 2>&1 | grep -oE 'status:200.*|Error.*' | head -1
sleep 2
echo "--- premium: ReportAccident (medium) as Contractor ---"
peer chaincode invoke -o $ORD --ordererTLSHostnameOverride $ORD_HOST --tls --cafile "$ORDERER_CA" \
  -C premium -n $CC_NAME \
  --peerAddresses localhost:7051 --tlsRootCertFiles "$(caFile contractor.safechain.com)" \
  --peerAddresses localhost:9051 --tlsRootCertFiles "$(caFile insurer.safechain.com)" \
  -c '{"function":"AccidentPremiumContract:ReportAccident","Args":["W-3001","Beta Kalip","medium","fall","default"]}' 2>&1 | grep -oE 'status:200.*|Error.*' | head -1
sleep 2
echo "--- premium: GetPremium ---"
peer chaincode query -C premium -n $CC_NAME -c '{"function":"AccidentPremiumContract:GetPremium","Args":["default"]}'
echo; echo "########## DONE ##########"
