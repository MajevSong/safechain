# Response to Reviewer — SafeChain (major revision)

We thank the reviewer for the detailed and constructive assessment. Below we
respond point-by-point; new material is in the revised manuscript at the noted
locations. ☐ = pending benchmark numbers (filled on completion).

## Technical limitations

**R1. DI1 premium formula is heuristic / not actuarially calibrated; gaming/underreporting under-discussed.**
We reframed DI1 as a **parametric experience-rating plan** and calibrated its coefficients against official statistics: severity classes map 1:1 to the SGK (2024) construction lost-workday distribution; severity magnitudes derive from the ANSI Z16.1 charged-day scale; frequency-over-severity weighting and the cap follow the NCCI experience-rating principle (excess-loss limitation); the cap reflects SGK's hazard-class experience-degree system. New **Figure 11** and §5.3.4 present the calibration; full re-fitting to insurer claims data is framed as a coefficient update (future work). Underreporting is now countered architecturally by a **mandatory inspector (Auditor) attestation** before any premium update (§5.3.5), making silent underreporting detectable.

**R2. Hashing national IDs is re-identifiable.**
Replaced plain SHA-256 with **keyed HMAC-SHA256** pseudonymisation (HSM-held, rotatable key) — not reversible by dictionary attack; rotation re-tokenises without exposing the raw value (§5.3.3). Implemented in chaincode and covered by a unit test asserting the token differs from the plain hash.

**R3. Single Raft orderer is a SPOF.**
Upgraded the ordering service to a **three-node Raft cluster** (tolerates one orderer failure). The network was rebuilt, redeployed, re-verified, and re-benchmarked: at 100 TPS the write latency was 0.56 s/0.78 s (register/accident) vs 0.85 s/1.40 s single-orderer, both 100 % success — **negligible HA overhead** (§7.2.1, Figure 12).

**R4. Architectural inconsistency: subcontractors can reportAccident but premium channel excludes them.**
Resolved by separating **accident intake** (competency channel, subcontractor-submittable) from **premium update** (premium channel), gated by inspector attestation and bridged by a dual-channel relay (§5.3.5). Verified end-to-end live (§7.1). The ABAC matrix (Figure 5) was corrected so read (`viewLedger`) and write authority are aligned for every writing role.

## Experimental gaps

**R5. No endorsement-policy / block-parameter / PDC-overhead / centralized-baseline analysis.**
Added: an **endorsement-policy ablation** (1/2/3-of-4: 0.34–0.37 s, ≈97.7 TPS, 100 % success — negligible effect, §7.2.2); a **Private Data Collection overhead** measurement (0.46 s→5.16 s latency, −9 % goodput, §7.2.4); and a **centralized REST baseline** (≈0.4 ms vs ≈0.6–0.8 s — the ~10³× decentralisation cost, §7.2.5, Figure 14). Block-parameter sensitivity is discussed as a further optimisation axis (§10).

**R6. MVCC contention — expand into an ablation.**
Added a **single-key vs per-project ablation** of the premium aggregate: a single hot key yields 7 % write success under 100 TPS concurrency (MVCC conflicts); per-project keys yield 100 % — a ≈14× improvement (§7.2.3, Figure 13b).

**R7. Functional tests limited; no coverage; no adversarial cases.**
Test suite expanded with **adversarial cases** (malformed/non-existent access, role-mismatch, timestamp skew, replayed attestation) and **code-coverage reporting**: 27 tests, 97.9 % statement / 100 % function / 90 % branch coverage (§7.1).

**R8. Improvement claim is qualitative; no E2E process model.**
Added a baseline subsection quantifying the as-is paper workflow (statutory 3-day SGK window plus inspection/insurer back-office, i.e., days–weeks) against SafeChain's sub-second on-chain segment (§5.2, §7.2).

## Clarity / presentation

**R9. Typos (DI4 vs D14); sparse data schemas / CouchDB indices.**
Typos corrected; we added the on-chain record schemas (worker, accident-intake, premium) and note the CouchDB composite-key/index strategy used in the benchmarks (§6).

**R10. ABAC viewLedger for subcontractors.**
Corrected (R4): subcontractors now hold `viewLedger`; the read model is stated explicitly (§5.3.3).

## Missing related work

**R11. Decentralized identity (W3C VC/DID, eIDAS 2.0); actuarial experience-rating; public-sector governance.**
New §4.4 engages all three: W3C VC/DID and eIDAS 2.0 (Regulation (EU) 2024/1183) as a future substrate for DI2; NCCI experience rating as DI1's kernel theory; and *controlled-polycentricity* public-sector governance (Tan et al., 2022) instantiated by our consortium with a public-auditor role (new §5.3.6 governance model).

## Questions for authors — brief answers
- **Coefficients:** calibrated against SGK distribution + ANSI/NCCI principles; insurer micro-data calibration is future work (§5.3.4, Fig. 11).
- **Cross-channel submission path:** subcontractor → SubmitAccident (competency) → Auditor AttestAccident → relay → ReportAccident (premium); integrity via attested, hash-anchored linkage (§5.3.5).
- **Endorsement policies in benchmarks:** the main runs use the default MAJORITY (3-of-4) on competency and 2-of-2 on premium; the ablation reports 1/2/3-of-4 (§7.2.2).
- **Re-identification:** keyed HMAC with rotation (§5.3.3).
- **PDC dissemination overhead:** measured at +≈4.7 s latency / −9 % goodput at 100 TPS (§7.2.4).
- **Off-chain governance:** IPFS pinning / enterprise storage with lawful-erasure of off-chain PII leaving a dangling hash (§7.3).
- **HA plan:** 3-node Raft implemented; multi-host clustering is future work (§7.2, §10).
- **Verifiable credentials:** adoption path discussed (§4.4).
- **Timestamp trust:** proposal timestamp is endorsement-invariant; optional endorsement-time bound (§6).
- **Mandatory inspector attestation:** implemented as a precondition for premium updates (§5.3.5).

---

## Round-2 clarifications (point technical consistency)

These were addressed as targeted in-text clarifications; the evaluation strategy
remains the deliberately-scoped FEDS/MEDS *Technical Risk & Efficacy* stage, with
the human-centred TAM study as the planned Stage 2.

- **HMAC key rotation vs. historical verification (critical).** Resolved with **key versioning**, not key replacement: tokens carry their key version, the HSM retains superseded keys read-only so historical ledger records stay verifiable, only the current key mints new tokens. This is kept distinct from **cryptographic erasure** — *per-subject* keys let a KVKK right-to-be-forgotten request be honoured by destroying one subject's key, leaving all other records and chain integrity intact (§5.3.3).
- **Governance: commercial majority could outvote the public Auditor.** Resolved by making the Auditor's signature mandatory for governance changes: Admins / `LifecycleEndorsement` = `AND('AuditorMSP.admin', MAJORITY of remaining orgs)` — an effective regulator veto; no commercial coalition can change rules or the premium plan without sign-off (§5.3.6).
- **PDC vs. endorsement feasibility.** Clarified: a private-data write is endorsable only by collection-member peers; we constrain `workerPiiCollection` to Contractor/Subcontractor/Insurer so the MAJORITY 3-of-4 policy is satisfied by exactly these members, while the Auditor is excluded from both the PII and its endorsement yet keeps the on-chain hash for audit (§7.2.4).
- **Per-project key — pool size honesty.** Stated explicitly: the per-project round uses a distinct key per tx (best case); the single-large-project worst case is handled by the sharded aggregate (§7.2.7, 7→52→78 % as shards grow) and, in production, Fabric's High-Throughput library (§10).
- **Cross-channel relay reliability.** Made idempotent: after applying the premium update the relay calls `MarkRelayed(accidentId)` (`ATTESTED→RELAYED`); redelivered events are a no-op (`ALREADY_RELAYED`), so at-least-once delivery cannot double-count and lost events are safely retried (§5.3.5; unit-tested).
- **Caliper accounting.** Clarified throughput (all finalized tx/time) vs success % vs goodput (successful-only rate), reconciling the 200 TPS row; percentiles available in raw logs (§7.2).
- **Legal admissibility.** Added as an explicit limitation: production use pairs on-chain anchoring with qualified e-signatures/seals (Law No. 5070) for evidentiary weight (§10).
- **DI1 actuarial validity / backtesting (both reviewers' #1 concern).** Added a **backtest on a portfolio whose sizes, frequency and severity are sampled from the official SGK 2024 yearbook** (Tables 3.1.1/3.1.3/3.1.26), with an *independent* monetary loss model to avoid circularity. Non-circular validity **Spearman ρ=0.84, 2.7× decile lift**; the analysis also surfaces an honest fairness finding (for large projects — ~47 % of real accidents — the absolute factor correlates with true risk at ρ≈−0.02, and exposure normalisation restores ρ≈0.90). Real per-claim cost calibration remains the final future-work step (§5.3.4, Figure 17).

---

## Round-3 clarifications (verdict: accept after minor–moderate revisions)

- **Deeper threat model.** Added explicit adversarial scenarios: contractor–inspector collusion (raised cost + Oracle Gateway threshold m-of-n), auditor-as-single-point-of-policy (mitigated by a multi-node regulator quorum + key rotation + external audit), DoS (rate-limiting + Raft quorum), insider PDC exfiltration (encryption-at-rest + anchored access logs + minimal membership) (§7.3).
- **Off-chain/IPFS security.** Specified: private gateway, MSP-scoped ACLs, AES-256 at-rest under the same HSM/KMS, short-lived tokens, on-chain-anchored access logs; public IPFS is not used for special-category data (§7.3).
- **Cryptographic erasure vs evidence.** Added a **regulator-governed key-escrow with time-bound retention** tied to the claim limitation period as the middle ground (§5.3.3).
- **Premium gaming + fairness.** Countermeasures for fragmentation/severity-reclassification/delayed-attestation, and an honest **exposure-normalisation fairness caveat** (DI1 uses absolute counts; rate-normalisation by worker-hours is the refinement) (§5.3.4).
- **Dispute resolution.** Added an on-chain `Dispute` + time-locked appeal + superseding-annotation process; off-chain legal rulings prevail and are recorded forward without mutating the trail (§5.3.6).
- **Related work.** Added direct comparison to Truong et al. (2019) GDPR-Fabric and Zieglmeier & Loyola Daiqui (2021) P3 pseudonym provisioning; concretised the DI2 VC/DID schema (issuers, revocation registry, selective disclosure); noted parametric-insurance oracle parallels (§4.4).
- **Query/index clarification.** Reads are composite-key point lookups (no CouchDB rich-query indexes needed; size-independent) (§6).

---

## Round-4 clarifications (verdict: borderline accept leaning revision)

- **Backtest circularity (methodological, self-reported).** The reviewer is correct that an ANSI-based ground truth was partly circular with DI1's ANSI-derived weights. We re-ran the backtest against an **independent monetary claim-cost model** (different severity relativities + per-claim lognormal noise). Honest result: Spearman **ρ = 0.94** (down from the inflated 0.97), 2.6× decile lift — genuine, non-circular predictive validity (§5.3.4, Figure 17a).
- **Exposure normalisation / fairness.** Quantified on the synthetic data: absolute DI1 is size-confounded (ρ=0.73 with raw project size) and tracks per-worker loss-rate at ρ=0.82, while an **exposure-normalised variant raises loss-rate tracking to ρ=0.89** (Figure 17b). Exposure normalisation is the fairness refinement; attestation of worker-hours via SGK premium-days is described (§5.3.4).
- **Equivalent-integrity baseline.** Added a **centralized signed append-only hash-chain log** (Ed25519 + prev-hash): 0.47 ms vs 0.41 ms plain — tamper-evidence is essentially free centrally. The precise inference: SafeChain's ~0.6 s is the cost of removing the single trusted writer (decentralised trust), not of tamper-evidence (§7.2.5, Figure 14).
- **Threat depth / metadata leakage / auditor throughput.** Added residual metadata-leakage discussion (event-frequency/timing side channels; padding/ZK hardening) and clarified the Auditor is a *governance* not transaction-rate bottleneck, with Oracle-Gateway partial automation (§7.3).
- **Timestamp drift policy.** Specified an endorsement-time drift bound (reject |t−peerclock|>Δ; Δ=5 s ⟫ NTP skew; no effect on day-granularity logic) (§6).
- **Interoperability + crypto-agility.** Added SSI (Indy/Aries) VC status-list anchoring, cross-ledger connectors, and a post-quantum migration note (§10).
- **Reproducibility.** Added a Data-and-Code-Availability statement; seeded synthetic generator reproduces Figures 11/17; no personal/proprietary data used.

---

## Real SGK 2024 micro-data anchoring (post-review, author-initiated)

We obtained the official SGK 2024 Statistical Yearbook accident micro-tables and
re-anchored the DI1 validation to real figures: real construction accident counts
(86,736; NACE split), real lost-workdays (≈7.9 days/accident), the official
exposure basis (2,250 h/worker-yr), and — most importantly — the **real
accident-by-workplace-size distribution** (Table 3.1.26). This both strengthens
the calibration and sharpens the fairness finding: because ≥250-employee
workplaces account for ~47 % of real accidents, the absolute-count size bias is
material — for large projects the absolute DI1 factor correlates with true
per-worker risk at ρ≈−0.02 (pure size, cap-saturated), and exposure
normalisation restores ρ≈0.90 (§5.3.4, Figure 17). The non-circular backtest
validity on the real-size portfolio is ρ=0.84.
