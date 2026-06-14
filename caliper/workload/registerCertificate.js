'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

// Write workload: each transaction registers a brand-new worker certificate on
// the competency channel with a unique key (no read-set contention).
class RegisterCertificateWorkload extends WorkloadModuleBase {
  constructor() {
    super();
    this.counter = 0;
  }

  async submitTransaction() {
    this.counter++;
    // RUN_PREFIX namespaces IDs across separate Caliper invocations (e.g. the
    // endorsement-policy ablation re-runs) so worker keys never collide.
    const prefix = process.env.RUN_PREFIX || 'r';
    const workerId = `W-${prefix}-${this.roundIndex}-${this.workerIndex}-${this.counter}`;
    const request = {
      contractId: 'safechainCompetency',
      contractFunction: 'CompetencyContract:RegisterCertificate',
      contractArguments: [workerId, 'Beta Kalip', 'Yuksekte Calisma', '2026-12-30', 'cert+training'],
      invokerIdentity: 'User1',
      readOnly: false,
    };
    await this.sutAdapter.sendRequests(request);
  }
}

function createWorkloadModule() {
  return new RegisterCertificateWorkload();
}

module.exports.createWorkloadModule = createWorkloadModule;
