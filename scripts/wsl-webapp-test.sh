#!/usr/bin/env bash
B=http://localhost:4000/api
j(){ curl -s -X "$1" "$B$2" -H 'Content-Type: application/json' ${3:+-d "$3"}; echo; }
WID="W-$(date +%s | tail -c 6)"
echo "### 1) register as CONTRACTOR (expect REGISTERED) ###"
j POST /register "{\"role\":\"contractor\",\"workerId\":\"$WID\",\"subcontractor\":\"Beta Kalip\",\"certificateType\":\"Yuksekte Calisma\",\"validUntil\":\"2026-12-30\",\"document\":\"cert\"}"
echo "### 2) register as WORKER (expect ABAC denied) ###"
j POST /register "{\"role\":\"contractor\",\"workerId\":\"$WID-x\",\"subcontractor\":\"S\",\"certificateType\":\"Yuksekte Calisma\",\"validUntil\":\"2026-12-30\"}" >/dev/null
curl -s -X POST $B/register -H 'Content-Type: application/json' -d "{\"role\":\"auditor\",\"workerId\":\"$WID-y\",\"subcontractor\":\"S\",\"certificateType\":\"Yuksekte Calisma\",\"validUntil\":\"2026-12-30\"}"; echo
echo "### 3) GetWorker (real on-chain, no PII) ###"
j GET "/worker/$WID?role=contractor"
echo "### 4) VerifyCertificate (expect APPROVE) ###"
j POST /verify "{\"role\":\"contractor\",\"workerId\":\"$WID\"}"
echo "### 5) ReportAccident on PREMIUM as contractor ###"
j POST /report-accident "{\"role\":\"contractor\",\"workerId\":\"$WID\",\"subcontractor\":\"Beta Kalip\",\"severity\":\"medium\",\"report\":\"fall\",\"projectId\":\"webdemo\"}"
echo "### 6) GetPremium webdemo ###"
sleep 2; j GET "/premium/webdemo?role=contractor"
echo "### 7) CROSS-CHANNEL: submit(subcontractor)->attest(auditor)->report(contractor) ###"
ACC="ACC-$(date +%s | tail -c 6)"
j POST /submit-accident "{\"role\":\"subcontractor\",\"accidentId\":\"$ACC\",\"workerId\":\"$WID\",\"subcontractor\":\"Beta Kalip\",\"severity\":\"high\",\"report\":\"collapse\",\"projectId\":\"projX\"}"
j POST /attest "{\"role\":\"auditor\",\"accidentId\":\"$ACC\"}"
echo "### 7b) attest as CONTRACTOR (expect ABAC denied - only auditor attests) ###"
j POST /attest "{\"role\":\"contractor\",\"accidentId\":\"$ACC\"}"
echo "DONE"
