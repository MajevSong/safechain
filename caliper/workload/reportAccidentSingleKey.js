'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const SEVERITIES = ['low', 'medium', 'high', 'fatal'];

// MVCC-contention variant: every accident targets the SAME premium aggregate key
// ('default'), so concurrent updates collide on the read-write set (status 11).
// Contrast with reportAccident.js (unique projectId per tx) to quantify the
// single-hot-key vs per-project scalability lever for DI1.
class ReportAccidentSingleKeyWorkload extends WorkloadModuleBase {
  constructor() { super(); this.counter = 0; }
  async submitTransaction() {
    this.counter++;
    const severity = SEVERITIES[this.counter % SEVERITIES.length];
    const workerId = `W-sk-${this.roundIndex}-${this.workerIndex}-${this.counter}`;
    await this.sutAdapter.sendRequests({
      contractId: 'safechainPremium',
      contractFunction: 'AccidentPremiumContract:ReportAccident',
      contractArguments: [workerId, 'Beta Kalip', severity, 'benchmark', 'default'], // single hot key
      invokerIdentity: 'User1',
      readOnly: false,
    });
  }
}
module.exports.createWorkloadModule = () => new ReportAccidentSingleKeyWorkload();
