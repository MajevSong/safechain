'use strict';

const { Contract } = require('fabric-contract-api');
const {
  sha256,
  SEVERITY_WEIGHTS,
  assertPermission,
  resolveRole,
  txTimestampISO,
} = require('./safechainLib');

const REPORT_COLLECTION = 'accidentReportCollection';

/**
 * AccidentIntakeContract — accident intake and inspector attestation on the
 * COMPETENCY channel (all four organisations are members, so subcontractors can
 * submit here). This resolves the cross-channel inconsistency and adds a
 * multi-party control against under-reporting:
 *
 *   subcontractor  --SubmitAccident-->  PENDING_ATTESTATION   (competency ch.)
 *   auditor/inspector --AttestAccident--> ATTESTED  + ACCIDENT_ATTESTED event
 *   dual-channel relay  --(listens)-->  ReportAccident        (premium ch.)
 *
 * Only an attested accident triggers a premium update, so silent under-reporting
 * is detectable (a missing attestation leaves the premium unaffected and the
 * pending record on-chain).
 */
class AccidentIntakeContract extends Contract {
  constructor() {
    super('AccidentIntakeContract');
  }

  _key(ctx, accidentId) {
    return ctx.stub.createCompositeKey('accidentIntake', [accidentId]);
  }

  /** Submit an accident for inspector attestation (subcontractor/contractor). */
  async SubmitAccident(ctx, accidentId, workerId, subcontractor, severity, reportSummary, projectId) {
    assertPermission(ctx, 'submitAccident');
    if (SEVERITY_WEIGHTS[severity] === undefined) {
      throw new Error(`Invalid severity "${severity}" (expected: low|medium|high|fatal)`);
    }
    const key = this._key(ctx, accidentId);
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) {
      throw new Error(`Accident ${accidentId} already submitted`);
    }
    const reportHash = sha256(`${accidentId}:${workerId}:${severity}:${reportSummary}`);
    const record = {
      docType: 'accidentIntake',
      accidentId, workerId, subcontractor, severity, projectId, reportHash,
      status: 'PENDING_ATTESTATION',
      submittedBy: resolveRole(ctx),
      submittedAt: txTimestampISO(ctx),
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    const transient = ctx.stub.getTransient();
    if (transient && transient.has('report')) {
      await ctx.stub.putPrivateData(REPORT_COLLECTION, reportHash, Buffer.from(transient.get('report')));
    }
    ctx.stub.setEvent('ACCIDENT_SUBMITTED', Buffer.from(JSON.stringify({
      accidentId, workerId, severity, reportHash, status: record.status,
    })));
    return JSON.stringify(record);
  }

  /** Attest a submitted accident (inspector / auditor only). */
  async AttestAccident(ctx, accidentId) {
    assertPermission(ctx, 'attestAccident');
    const key = this._key(ctx, accidentId);
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) {
      throw new Error(`Accident ${accidentId} not found`);
    }
    const record = JSON.parse(data.toString());
    if (record.status === 'ATTESTED') {
      throw new Error(`Accident ${accidentId} already attested`);
    }
    record.status = 'ATTESTED';
    record.attestedBy = resolveRole(ctx);
    record.attestedAt = txTimestampISO(ctx);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));

    // Consumed by the dual-channel relay to invoke ReportAccident on premium.
    ctx.stub.setEvent('ACCIDENT_ATTESTED', Buffer.from(JSON.stringify({
      accidentId: record.accidentId,
      workerId: record.workerId,
      subcontractor: record.subcontractor,
      severity: record.severity,
      projectId: record.projectId,
      reportHash: record.reportHash,
    })));
    return JSON.stringify(record);
  }

  /**
   * Idempotency marker for the cross-channel relay. After the relay has applied
   * the premium update on the premium channel, it marks the intake record
   * RELAYED. A redelivered/duplicate attestation event re-invokes this and is a
   * safe no-op (returns ALREADY_RELAYED), so at-least-once delivery cannot
   * double-count a premium update.
   */
  async MarkRelayed(ctx, accidentId) {
    assertPermission(ctx, 'reportAccident'); // relay parties: contractor/insurer
    const key = this._key(ctx, accidentId);
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) {
      throw new Error(`Accident ${accidentId} not found`);
    }
    const record = JSON.parse(data.toString());
    if (record.status === 'RELAYED') {
      return JSON.stringify({ result: 'ALREADY_RELAYED', accidentId }); // idempotent no-op
    }
    if (record.status !== 'ATTESTED') {
      throw new Error(`Accident ${accidentId} is ${record.status}, not ATTESTED`);
    }
    record.status = 'RELAYED';
    record.relayedAt = txTimestampISO(ctx);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(record)));
    return JSON.stringify({ result: 'RELAYED', accidentId });
  }

  /** Read the status of a submitted accident (any channel member). */
  async GetAccident(ctx, accidentId) {
    assertPermission(ctx, 'verifyCertificate');
    const data = await ctx.stub.getState(this._key(ctx, accidentId));
    if (!data || data.length === 0) {
      throw new Error(`Accident ${accidentId} not found`);
    }
    return data.toString();
  }
}

module.exports = AccidentIntakeContract;
