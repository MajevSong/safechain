'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

// Same as registerCertificate, but supplies transient PII so the chaincode also
// writes to a Private Data Collection (putPrivateData). Benchmarking this against
// the public-only register isolates the PDC write overhead.
class RegisterWithPIIWorkload extends WorkloadModuleBase {
  constructor() { super(); this.counter = 0; }

  async submitTransaction() {
    this.counter++;
    const workerId = `W-pii-${this.roundIndex}-${this.workerIndex}-${this.counter}`;
    await this.sutAdapter.sendRequests({
      contractId: 'safechainCompetency',
      contractFunction: 'CompetencyContract:RegisterCertificate',
      contractArguments: [workerId, 'Beta Kalip', 'Yuksekte Calisma', '2026-12-30', 'cert+training'],
      transientMap: { pii: JSON.stringify({ name: 'Ayse Demir', nationalId: `${10000000000 + this.counter}` }) },
      invokerIdentity: 'User1',
      readOnly: false,
    });
  }
}

module.exports.createWorkloadModule = () => new RegisterWithPIIWorkload();
