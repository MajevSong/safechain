# SafeChain — Security and Privacy Architecture Analysis

This document supports Section 5.5.4 of the paper. It records the STRIDE threat
model, the KVKK (Turkish GDPR-equivalent) compliance data-flow analysis, and the
vendor lock-in assessment for the SafeChain artefact as implemented on
Hyperledger Fabric 2.5 (4 organisations, 2 channels, CCAAS chaincode).

## 1. STRIDE threat model

Scope: the deployed artefact — orderer (Raft), four peers (Contractor,
Subcontractor, Insurer, Auditor), CouchDB state stores, the three chaincode
contracts, the off-chain document store, and the oracle path that feeds
accident/expiry events on-chain.

| STRIDE category | Threat against SafeChain | Mitigation in the artefact | Residual risk |
|-----------------|--------------------------|----------------------------|---------------|
| **Spoofing** | Forged actor identity submitting certificates/accidents | X.509 MSP identities per org; mutual TLS on every gRPC link; ABAC role resolved from `clientIdentity` MSP/attribute | Compromised org CA key → out of scope, handled by CA HSM in production |
| **Tampering** | Altering accident records or certificate history after the fact | Append-only ledger; SHA-256 document anchoring; per-block `previousHash`; endorsement + Raft ordering | Off-chain document tampering detectable (hash mismatch) but not prevented |
| **Repudiation** | A party denying it reported/authorised an action | Every tx carries the signed creator identity + tx timestamp; `registeredBy`/`reportedBy`/`authorizedBy` persisted; immutable audit trail | None significant on-chain |
| **Information disclosure** | Exposure of worker PII / health data | PII kept off public state (private data collection); only pseudonym + hash on-chain; channel isolation (premium channel excludes Subcontractor/Auditor) | Metadata (tx graph, timing) still visible to channel members |
| **Denial of service** | Flooding the network / a hot-key contention stall | Endorsement rate limiting; per-project premium keys avoid single-hot-key MVCC stalls (see benchmark); Raft tolerates orderer restart | Single-orderer dev topology is a SPOF (production: 3/5 Raft nodes) |
| **Elevation of privilege** | A worker/subcontractor performing an insurer-only action | ABAC `assertPermission` at chaincode entry; per-channel org membership; endorsement policy (MAJORITY) | Collusion of a majority of orgs → governance-level risk |

**Priority findings (per the proposal's emphasis):**

- **Oracle trust (off-chain → on-chain):** accident and certificate-expiry
  events originate off-chain. A malicious or faulty oracle can inject false
  accident reports (inflating premiums) or suppress real ones. The artefact
  mitigates *integrity after submission* (hash anchoring, signatures) but not
  *source authenticity*. Recommended production control: multi-signature oracle
  (e.g., site safety officer + SGK inspector endorsement) before an accident tx
  is accepted — a natural extension of the MAJORITY endorsement model.
- **Chaincode vulnerabilities:** the three contracts validate inputs (severity
  enum, duplicate-worker guard, permission checks). Determinism is preserved by
  using the tx timestamp (never `Date.now()`), which also closes a class of
  endorsement-divergence bugs.

## 2. KVKK compliance — data-flow analysis (DI4)

Under Law No. 6698 (KVKK), worker occupational-health data is *special-category
personal data*. The on/off-chain split below shows that no special-category data
and no direct identifiers are written to the immutable ledger.

| Data element | Category | Storage | On-chain representation |
|--------------|----------|---------|-------------------------|
| Worker national ID | Direct identifier (special handling) | Off-chain (private collection) | SHA-256 hash only |
| Worker full name | Personal data | Off-chain (private collection) | Absent from public state |
| Certificate document | Personal data | Off-chain / IPFS | SHA-256 `documentHash` |
| Accident report (full text, medical) | Special-category | Off-chain (private collection) | SHA-256 `reportHash` |
| Pseudonym (`wrk_<hash6>`) | Pseudonymised key | On-chain | Public |
| Tx metadata (actor role, type, severity class, timestamp) | Non-identifying | On-chain | Public to channel |
| Premium factor / aggregates | Non-identifying | On-chain | Public to channel |

**KVKK principle mapping:**

- *Data minimisation (Art. 4):* only hashes + non-identifying metadata on-chain.
- *Purpose limitation (Art. 4):* premium channel restricted to Contractor +
  Insurer; Subcontractor and public Auditor cannot read premium/accident detail.
- *Storage limitation / erasure (Art. 7):* personal data lives off-chain and is
  erasable; the on-chain hash becomes a dangling, non-reversible reference after
  erasure (no personal data remains on the immutable ledger) — this is the
  standard reconciliation of GDPR/KVKK erasure with immutability.
- *Security (Art. 12):* TLS in transit, MSP-based access control, private data
  collections for at-rest isolation.

**Verified empirically:** the live `GetWorker` query in the smoke test returns
`pseudonym` + `documentHash` and contains **no** `name`/`nationalId` field,
confirming PII never reaches the public world state.

## 3. Vendor lock-in assessment (Hyperledger Fabric)

| Dimension | Assessment |
|-----------|------------|
| Chaincode portability | Business logic is plain Node.js with a thin `fabric-contract-api` shim; the premium/ABAC/responsibility logic is platform-agnostic and unit-tested independently of Fabric |
| Deployment model | CCAAS (Chaincode-as-a-Service) decouples chaincode from the peer build pipeline; the same container image can target other gRPC-based runtimes |
| Identity/MSP | X.509 MSP is Fabric-specific; migration to another permissioned ledger (e.g., Besu/QBFT with DID) would require re-issuing identities |
| Data model | On/off-chain hash-anchoring pattern is portable across DLTs |
| Migration cost | Moderate: contracts and data model port easily; network topology, endorsement policy, and identity infrastructure are the Fabric-coupled parts |

**Conclusion:** lock-in is concentrated in the identity and ordering layers, not
in the application logic. The DI5 (manageable complexity) principle is supported
by keeping the contention-sensitive and security-sensitive logic in portable,
independently testable modules.
