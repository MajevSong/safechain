'use strict';

const { Contract } = require('fabric-contract-api');
const {
  assertPermission,
  resolveRole,
  txTimestampISO,
  isValidUntil,
} = require('./safechainLib');

/**
 * ResponsibilityContract — Sözleşme Yönetim Modülü.
 * Authorises task assignments against worker competency and records which party
 * in the subcontractor chain is accountable. Deployed alongside
 * CompetencyContract on the competency channel so it can read worker state.
 * Implements DI3 (transparent responsibility chain).
 */
class ResponsibilityContract extends Contract {
  constructor() {
    super('ResponsibilityContract');
  }

  _workerKey(ctx, workerId) {
    return ctx.stub.createCompositeKey('worker', [workerId]);
  }

  _norm(value) {
    return String(value).trim().toLocaleLowerCase('tr-TR');
  }

  /**
   * Authorise a task assignment. Approves only when the worker's certificate is
   * valid AND matches the task; otherwise rejects and pins accountability on the
   * worker's direct subcontractor.
   * @param {string} contractPath e.g. "Alfa Insaat > Beta Kalip > Gamma Iskele"
   */
  async AuthorizeTask(ctx, workerId, task, contractPath) {
    assertPermission(ctx, 'authorizeTask');

    const data = await ctx.stub.getState(this._workerKey(ctx, workerId));
    if (!data || data.length === 0) {
      throw new Error(`Worker ${workerId} not found`);
    }
    const worker = JSON.parse(data.toString());

    const certValid = isValidUntil(worker.validUntil, ctx);
    const certMatches = this._norm(worker.certificateType) === this._norm(task);
    const approved = certValid && certMatches;
    const result = approved ? 'APPROVE_ASSIGNMENT' : 'REJECT_ASSIGNMENT';

    const parts = String(contractPath).split('>').map((p) => p.trim()).filter(Boolean);
    const responsibleParty = approved ? parts[parts.length - 1] : worker.subcontractor;

    const record = {
      docType: 'taskAuthorization',
      workerId,
      task,
      result,
      reason: approved ? 'OK' : (!certValid ? 'CERTIFICATE_EXPIRED' : 'CERTIFICATE_MISMATCH'),
      responsibleParty,
      contractPath: parts,
      authorizedBy: resolveRole(ctx),
      authorizedAt: txTimestampISO(ctx),
    };
    const key = ctx.stub.createCompositeKey('taskAuth', [workerId, ctx.stub.getTxID()]);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    ctx.stub.setEvent('TASK_AUTHORIZATION', Buffer.from(JSON.stringify(record)));

    return JSON.stringify(record);
  }
}

module.exports = ResponsibilityContract;
