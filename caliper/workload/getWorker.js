'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

// Read workload: register a small pool of workers per Caliper thread (with
// retries so transient backlog never leaves the pool empty), then issue
// read-only GetWorker queries against that pool. This isolates state-database
// read throughput from any registration/contention artefact.
class GetWorkerWorkload extends WorkloadModuleBase {
  async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
    await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);
    this.poolSize = 10;
    this.pool = [];
    this.counter = 0;
    for (let i = 0; i < this.poolSize; i++) {
      const id = `POOL-${this.workerIndex}-${i}`;
      let ok = false;
      for (let attempt = 0; attempt < 5 && !ok; attempt++) {
        try {
          await this.sutAdapter.sendRequests({
            contractId: 'safechainCompetency',
            contractFunction: 'CompetencyContract:RegisterCertificate',
            contractArguments: [id, 'Beta Kalip', 'Yuksekte Calisma', '2026-12-30', 'seed'],
            invokerIdentity: 'User1',
            readOnly: false,
          });
          ok = true;
        } catch (err) {
          if (String(err).includes('already registered')) { ok = true; } // idempotent across rounds
        }
      }
      if (ok) { this.pool.push(id); }
    }
    if (this.pool.length === 0) { this.pool.push(`POOL-${this.workerIndex}-0`); }
  }

  async submitTransaction() {
    const id = this.pool[this.counter++ % this.pool.length];
    await this.sutAdapter.sendRequests({
      contractId: 'safechainCompetency',
      contractFunction: 'CompetencyContract:GetWorker',
      contractArguments: [id],
      invokerIdentity: 'User1',
      readOnly: true,
    });
  }
}

module.exports.createWorkloadModule = () => new GetWorkerWorkload();
