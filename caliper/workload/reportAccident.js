'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

const SEVERITIES = ['low', 'medium', 'high', 'fatal'];

// Write workload on the premium channel: report accidents (each updates the
// running premium aggregate). Exercises the Contractor+Insurer 2-org channel.
class ReportAccidentWorkload extends WorkloadModuleBase {
  constructor() {
    super();
    this.counter = 0;
  }

  async submitTransaction() {
    this.counter++;
    const severity = SEVERITIES[this.counter % SEVERITIES.length];
    const workerId = `W-${this.roundIndex}-${this.workerIndex}-${this.counter}`;
    // Unique projectId per tx spreads the premium aggregate over distinct keys so
    // this round measures the premium-channel write throughput rather than the
    // single-hot-key MVCC contention (the latter is analysed separately).
    const projectId = `proj-${this.roundIndex}-${this.workerIndex}-${this.counter}`;
    await this.sutAdapter.sendRequests({
      contractId: 'safechainPremium',
      contractFunction: 'AccidentPremiumContract:ReportAccident',
      contractArguments: [workerId, 'Beta Kalip', severity, 'benchmark accident report', projectId],
      invokerIdentity: 'User1',
      readOnly: false,
    });
  }
}

module.exports.createWorkloadModule = () => new ReportAccidentWorkload();
