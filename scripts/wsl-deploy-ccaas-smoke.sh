#!/usr/bin/env bash
# Deploy the SafeChain chaincode as a Chaincode-as-a-Service (CCAAS) to the
# competency channel, then run a live on-chain smoke test.
# Run from WSL: bash /mnt/d/Dev/simulation_blockchain/scripts/wsl-deploy-ccaas-smoke.sh
set -e

TN="$HOME/safechain/fabric-samples/test-network"
SRC="/mnt/d/Dev/simulation_blockchain/chaincode"
CC="$HOME/safechain/chaincode"        # WSL-native build context

echo "=== sync chaincode to WSL (keep Dockerfile, drop node_modules/test) ==="
mkdir -p "$CC"
rsync -a --delete --exclude node_modules --exclude test "$SRC"/ "$CC"/

cd "$TN"
export PATH="$HOME/.local/bin:$TN/../bin:$PATH"

echo "=== deployCCAAS 'safechain' on competency channel ==="
./network.sh deployCCAAS -c competency -ccn safechain -ccp "$CC"

# ---- CLI env (Org1 = contractor) -------------------------------------------
export FABRIC_CFG_PATH="$TN/../config/"
export CORE_PEER_TLS_ENABLED=true
ORDERER_CA="$TN/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem"
ORG1_CA="$TN/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
ORG2_CA="$TN/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_CA"
export CORE_PEER_MSPCONFIGPATH="$TN/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
export CORE_PEER_ADDRESS=localhost:7051

invoke() {
  peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
    --tls --cafile "$ORDERER_CA" -C competency -n safechain \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_CA" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG2_CA" \
    -c "$1"
  sleep 2
}
query() { peer chaincode query -C competency -n safechain -c "$1"; }

echo; echo "########## SMOKE TEST ##########"
echo "--- 1) RegisterCertificate (W-1001) ---"
invoke '{"function":"CompetencyContract:RegisterCertificate","Args":["W-1001","Beta Kalip","Yuksekte Calisma","2026-12-30","cert+training"]}'
echo "--- 2) GetWorker (W-1001) ---"
query '{"function":"CompetencyContract:GetWorker","Args":["W-1001"]}'; echo
echo "--- 3) VerifyCertificate (W-1001) -> APPROVE ---"
invoke '{"function":"CompetencyContract:VerifyCertificate","Args":["W-1001"]}'
echo "--- 4) AuthorizeTask matching -> APPROVE_ASSIGNMENT ---"
invoke '{"function":"ResponsibilityContract:AuthorizeTask","Args":["W-1001","Yuksekte Calisma","Alfa Insaat > Beta Kalip > Gamma Iskele"]}'
echo "--- 5) AuthorizeTask mismatch -> REJECT_ASSIGNMENT ---"
invoke '{"function":"ResponsibilityContract:AuthorizeTask","Args":["W-1001","Elektrik Guvenligi","Alfa Insaat > Beta Kalip"]}'
echo "--- 6) ReportAccident (medium) -> premium update ---"
invoke '{"function":"AccidentPremiumContract:ReportAccident","Args":["W-1001","Beta Kalip","medium","formwork fall risk"]}'
echo "--- 7) GetPremium -> expect factor 1.19 ---"
query '{"function":"AccidentPremiumContract:GetPremium","Args":["default"]}'; echo
echo; echo "########## SMOKE TEST DONE ##########"
