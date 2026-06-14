# SafeChain — Performance Evaluation Results (Hyperledger Caliper)

Supports Section 5.5.2 of the paper. Results from the refined benchmark
(`caliper/benchmarks/safechain-clean.yaml`) on the deployed 4-organisation,
2-channel Hyperledger Fabric 2.5 network (single Raft orderer, per-peer CouchDB,
CCAAS chaincode), driven by Hyperledger Caliper 0.6.0 with the Fabric Gateway
SUT. All workloads ran for 120 s after a 45 s warm-up, with 4 Caliper workers.

**Test host:** single developer machine (Windows 11 + WSL2 + Docker Desktop);
all five Fabric nodes, four state databases and four chaincode services co-located
on one host. Absolute numbers are therefore a *lower bound* — a distributed,
production-grade deployment would scale further. This single-host caveat is the
stated scope limitation (cf. Melo et al., 2025).

## Per-round results

| Transaction (channel) | Offered TPS | Succ | Fail | Success % | Avg latency (s) | Goodput (succ TPS) |
|-----------------------|------------:|-----:|-----:|----------:|----------------:|-------------------:|
| RegisterCertificate (competency, write) | 50  | 6 000  | 0      | 100.0 | 0.20  | 49.1 |
| RegisterCertificate (competency, write) | 100 | 12 004 | 0      | 100.0 | 0.85  | 98.2 |
| RegisterCertificate (competency, write) | 200 | 11 536 | 12 468 | 48.1  | 26.86 | 66.0 |
| RegisterCertificate (competency, write) | 400 | 1 660  | 46 344 | 3.5   | 47.47 | 9.5  |
| GetWorker (competency, read)            | 100 | 12 004 | 0      | 100.0 | 0.004 | 99.9 |
| GetWorker (competency, read)            | 500 | 60 004 | 0      | 100.0 | 0.004 | 499.6 |
| GetWorker (competency, read)            | 1000| 120 004| 0      | 100.0 | 0.02  | 999.1 |
| ReportAccident (premium, write)         | 50  | 6 004  | 0      | 100.0 | 0.19  | 49.2 |
| ReportAccident (premium, write)         | 100 | 12 004 | 0      | 100.0 | 1.40  | 98.1 |
| ReportAccident (premium, write)         | 200 | 10 701 | 13 299 | 44.6  | 27.41 | 61.2 |

## Target thresholds vs. measured (at the design operating point ≤100 TPS)

| Metric | Proposal target | Measured @ ≤100 TPS | Verdict |
|--------|-----------------|---------------------|---------|
| Sustained throughput | ≥ 50 TPS | writes 98 TPS goodput; reads 999 TPS | ✅ met |
| Transaction latency | ≤ 3000 ms | register 0.85 s, accident 1.40 s, query 0.02 s | ✅ met |
| Success rate | ≥ 95 % | 100 % for all three transaction types | ✅ met |
| Chaincode/query response | ≤ 500 ms | read query 4–20 ms | ✅ met |
| Block finality (write incl. ordering+commit) | ≤ 2000 ms | 0.2–1.4 s at ≤100 TPS | ✅ met |

## Interpretation

1. **Read path scales linearly** to 1000 TPS with ~100 % success and millisecond
   latency — CouchDB-backed queries are not the bottleneck (Figure 10a/b).
2. **Write paths (both channels) meet every target up to ~100 TPS** with 100 %
   success and sub-1.5 s latency. The 2-org premium-channel write (ReportAccident,
   1.40 s) is slightly slower than the 4-org competency write (0.85 s), reflecting
   the smaller endorsement set but cross-channel routing overhead.
3. **Saturation point ≈ 100–150 TPS for writes** on a single host: at 200 TPS
   offered load, goodput falls and latency climbs past 25 s as the ordering/commit
   pipeline backs up; at 400 TPS the write path collapses (3.5 % success). This
   knee is the expected single-host limit and is consistent with the throughput
   degradation reported by Melo et al. (2025).
4. **Practical adequacy:** in the construction-OHS domain, accident and
   certificate events are sparse (orders of magnitude below 100 TPS even for a
   national-scale deployment), so the artefact operates comfortably within its
   verified envelope. Horizontal scaling (multi-host orderer cluster, more peers)
   is the path beyond the single-host knee and is future work.

### Secondary finding — premium hot-key contention

When all accidents target a single premium aggregate key, the write path suffers
MVCC read–write conflicts (status 11) under concurrency. Scoping the premium
aggregate per project (distinct keys) removes the contention and is both more
realistic and the configuration used above. This confirms that aggregate design
(key granularity) is a first-order scalability lever for DI1.
