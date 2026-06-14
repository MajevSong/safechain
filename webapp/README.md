# SafeChain Web Demo — connected to the REAL Fabric network

This is **not** a browser simulation. The UI calls a Node/Express backend that
uses the **Hyperledger Fabric Gateway SDK** to submit/evaluate transactions on
the live 4-organisation, 2-channel SafeChain network. The role selector signs as
a different organisation, so **ABAC, channel membership and the cross-channel
inspector flow are enforced on-chain** (e.g., only the Auditor can attest; a
Worker cannot register).

## Architecture
```
Browser (index.html/app.js)  ->  REST  ->  server.js (Fabric Gateway SDK)  ->  peer0.<org> gRPC/mTLS  ->  Fabric (competency + premium channels)
```
Block height, latency, and success rate shown in the UI are **real** (queried
from the ledger / measured per call).

## Prerequisites
The Fabric network must be up and the `safechain` chaincode deployed:
```bash
# in WSL (Ubuntu), Docker Desktop running:
bash scripts/wsl-safechain-up.sh        # 4 orgs, 3-node Raft, 2 channels
bash scripts/wsl-safechain-deploy.sh    # CCAAS chaincode on both channels
```

## Run the web app
```bash
bash scripts/wsl-webapp-setup.sh        # rsync + npm install (once)
cd ~/safechain/webapp && PORT=4000 node server.js
```
Then open **http://localhost:4000** in a browser.

## REST endpoints (all hit the live chain)
| Method | Path | Chaincode |
|--------|------|-----------|
| POST | /api/register | CompetencyContract:RegisterCertificate |
| GET  | /api/worker/:id | CompetencyContract:GetWorker |
| POST | /api/verify | CompetencyContract:VerifyCertificate |
| POST | /api/authorize | ResponsibilityContract:AuthorizeTask |
| POST | /api/submit-accident | AccidentIntakeContract:SubmitAccident |
| POST | /api/attest | AccidentIntakeContract:AttestAccident (Auditor only) |
| POST | /api/report-accident | AccidentPremiumContract:ReportAccident (premium channel) |
| GET  | /api/premium/:project | AccidentPremiumContract:GetPremium |
| GET  | /api/status | qscc GetChainInfo (block height) |

Each request opens a fresh gateway connection for clarity; write latency (~2 s)
is dominated by connection setup + Raft commit, reads are ~10 ms. A production
deployment would pool gateway connections per identity.
