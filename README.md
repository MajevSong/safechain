# SafeChain — reference implementation, benchmarks, and live web demo

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20693436.svg)](https://doi.org/10.5281/zenodo.20693436)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Open artefact accompanying the paper *“SafeChain: A Blockchain-Based System for
Occupational-Accident Premium Adjustment and Worker-Competency Management in the
Construction Sector — A Design Science Approach.”*

SafeChain is a permissioned **Hyperledger Fabric 2.5** system that integrates
(i) dynamic, smart-contract-driven occupational-accident **insurance-premium
adjustment**, (ii) immutable **worker-competency/certificate management**, and
(iii) transparent **subcontractor responsibility** tracing, with a
KVKK-compliant privacy architecture and a regulator-aware governance model.

This repository contains everything needed to **reproduce** the paper’s
functional, performance, security, and calibration results.

## Repository layout
| Path | Contents |
|------|----------|
| `chaincode/` | Node.js chaincode — 4 contracts (Competency, AccidentPremium, Responsibility, AccidentIntake) + `safechainLib` (ABAC, keyed-HMAC pseudonymisation, premium model). Mocha tests in `chaincode/test/`. |
| `network/` | 4-org / 2-channel topology: `crypto-config.yaml`, `configtx.yaml` (3-node Raft), `compose-safechain.yaml`, `collections_config.json`. |
| `caliper/` | Hyperledger Caliper harness: `networkConfig.yaml`, workloads, benchmark configs, and `results/` HTML reports. |
| `baseline/` | Centralized REST + signed hash-chain baselines (decentralisation-cost comparison). |
| `webapp/` | **Live web demo**: Fabric Gateway REST backend + UI driving the real network (see `webapp/README.md`). |
| `figures/` | Python scripts that regenerate every figure (F1–F17), including the DI1 calibration/back-test. |
| `docs/` | Security/KVKK analysis, premium calibration, benchmark results, reviewer responses. |
| `scripts/` | WSL automation (network up/deploy, benchmarks, fault-tolerance, web app). |
| `veriseti/` | `extracted_real_figures.md` — real figures extracted from the official SGK 2024 yearbook (source linked; raw `.xlsx` excluded by size). |
| `paper.md` | Manuscript source (the `.docx` is generated via `pandoc`). |

## Reproduce the core claims

**1. Chaincode tests & coverage (29 tests, ~97 % statements):**
```bash
cd chaincode && npm install && npm test        # 29 passing
npm run coverage                               # text-summary: ~97.9% stmt / 100% fn / 90% branch
```

**2. Figures (no network needed):**
```bash
pip install matplotlib numpy
for f in figures/generate_*.py; do python "$f"; done
```

**3. Live 4-org network + chaincode (WSL2 + Docker Desktop):**
```bash
bash scripts/wsl-safechain-up.sh        # 4 orgs, 3-node Raft, competency + premium channels
bash scripts/wsl-safechain-deploy.sh    # deploy chaincode (CCAAS) + smoke test
```

**4. Caliper benchmarks:**
```bash
bash scripts/wsl-caliper-install.sh
bash scripts/wsl-caliper-run.sh clean   # results in caliper/results/
```

**5. Interactive web demo on the live chain:** see [`webapp/README.md`](webapp/README.md).

## Environment
Developed on Windows 11 + WSL2 (Ubuntu) + Docker Desktop; Hyperledger Fabric
2.5.10, Node.js 20, Hyperledger Caliper 0.6.0. The network runs inside WSL2;
scripts are invoked as `bash scripts/wsl-*.sh`.

## Honesty note on data
All reported system metrics are real measurements. Aggregate accident statistics
are from the official **SGK 2024** yearbook. The DI1 back-test uses a portfolio
whose size/frequency/severity are sampled from those real SGK figures, with an
**independent synthetic** per-claim monetary-loss model (claim-cost micro-data
are confidential) — which also keeps the back-test non-circular.

## License
MIT — see [LICENSE](LICENSE).
