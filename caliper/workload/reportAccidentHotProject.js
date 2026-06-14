'use strict';
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const SEVERITIES = ['low', 'medium', 'high', 'fatal'];

// Worst case for the per-project design: many concurrent reports for the SAME
// project hit the SAME premium key -> MVCC contention recurs at scale.
class HotProjectWorkload extends WorkloadModuleBase {
  constructor() { super(); this.counter = 0; }
  async submitTransaction() {
    this.counter++;
    await this.sutAdapter.sendRequests({
      contractId: 'safechainPremium',
      contractFunction: 'AccidentPremiumContract:ReportAccident',
      contractArguments: [`W-hp-${this.roundIndex}-${this.workerIndex}-${this.counter}`, 'Sub',
        SEVERITIES[this.counter % 4], 'bench', 'projHot2'],
      invokerIdentity: 'User1', readOnly: false,
    });
  }
}
module.exports.createWorkloadModule = () => new HotProjectWorkload();
