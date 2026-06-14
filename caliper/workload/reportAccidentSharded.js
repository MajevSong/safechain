'use strict';
const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const SEVERITIES = ['low', 'medium', 'high', 'fatal'];
const NSHARDS = 64;

// Sharded aggregate: concurrent reports for the SAME project are spread across
// NSHARDS disjoint keys, eliminating the intra-project MVCC contention while the
// factor is recomposed on read (GetPremiumSharded).
class ShardedWorkload extends WorkloadModuleBase {
  constructor() { super(); this.counter = 0; }
  async submitTransaction() {
    this.counter++;
    const shard = Math.floor(Math.random() * NSHARDS);
    await this.sutAdapter.sendRequests({
      contractId: 'safechainPremium',
      contractFunction: 'AccidentPremiumContract:ReportAccidentSharded',
      contractArguments: [`W-sh-${this.roundIndex}-${this.workerIndex}-${this.counter}`, 'Sub',
        SEVERITIES[this.counter % 4], 'bench', 'projHot2', String(shard)],
      invokerIdentity: 'User1', readOnly: false,
    });
  }
}
module.exports.createWorkloadModule = () => new ShardedWorkload();
