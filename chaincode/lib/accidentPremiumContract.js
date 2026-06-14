'use strict';

const { Contract } = require('fabric-contract-api');
const {
  sha256,
  SEVERITY_WEIGHTS,
  assertPermission,
  resolveRole,
  txTimestampISO,
} = require('./safechainLib');

// Full accident report text (sensitive) is kept off public state.
const REPORT_COLLECTION = 'accidentReportCollection';

/**
 * AccidentPremiumContract — Kaza ve Prim Yönetim Modülü.
 * Records accidents and recomputes the dynamic insurance premium factor on the
 * premium-accident channel. Implements DI1 (measurable premium).
 *
 * Premium model (see paper):
 *   factor = min(2.75, 1 + 0.04*accidentCount + severitySum + expiredPenalty)
 * Aggregates are maintained incrementally so the recompute is O(1) per tx,
 * which keeps the transaction deterministic and benchmark-friendly.
 */
class AccidentPremiumContract extends Contract {
  constructor() {
    super('AccidentPremiumContract');
  }

  _premiumKey(ctx, projectId) {
    return ctx.stub.createCompositeKey('premium', [projectId]);
  }

  async _getPremium(ctx, projectId) {
    const data = await ctx.stub.getState(this._premiumKey(ctx, projectId));
    if (!data || data.length === 0) {
      return {
        docType: 'premium',
        projectId,
        base: 1,
        accidentCount: 0,
        severitySum: 0,
        expiredPenalty: 0,
        factor: 1,
      };
    }
    return JSON.parse(data.toString());
  }

  _recompute(premium) {
    const frequency = premium.accidentCount * 0.04;
    const raw = 1 + frequency + premium.severitySum + premium.expiredPenalty;
    premium.factor = Number(Math.min(2.75, raw).toFixed(2));
    return premium;
  }

  /** Report an accident and update the premium factor for a project. */
  async ReportAccident(ctx, workerId, subcontractor, severity, reportSummary, projectId) {
    assertPermission(ctx, 'reportAccident');

    const weight = SEVERITY_WEIGHTS[severity];
    if (weight === undefined) {
      throw new Error(`Invalid severity "${severity}" (expected: low|medium|high|fatal)`);
    }

    const reportHash = sha256(`${workerId}:${severity}:${reportSummary}:${txTimestampISO(ctx)}`);
    const accidentKey = ctx.stub.createCompositeKey('accident', [projectId, ctx.stub.getTxID()]);
    const accident = {
      docType: 'accident',
      projectId,
      workerId,
      subcontractor,
      severity,
      reportHash,
      reportedBy: resolveRole(ctx),
      reportedAt: txTimestampISO(ctx),
    };
    await ctx.stub.putState(accidentKey, Buffer.from(JSON.stringify(accident)));

    // Persist the full report text in a private collection when supplied.
    const transient = ctx.stub.getTransient();
    if (transient && transient.has('report')) {
      await ctx.stub.putPrivateData(REPORT_COLLECTION, reportHash,
        Buffer.from(transient.get('report')));
    }

    const premium = await this._getPremium(ctx, projectId);
    premium.accidentCount += 1;
    premium.severitySum = Number((premium.severitySum + weight).toFixed(2));
    this._recompute(premium);
    await ctx.stub.putState(this._premiumKey(ctx, projectId), Buffer.from(JSON.stringify(premium)));

    ctx.stub.setEvent('ACCIDENT_REPORTED_PREMIUM_UPDATED', Buffer.from(JSON.stringify({
      workerId, subcontractor, severity, reportHash, premiumFactor: premium.factor,
    })));

    return JSON.stringify({ result: 'PREMIUM_UPDATED', reportHash, premiumFactor: premium.factor });
  }

  /**
   * Update the compliance penalty term from the number of expired certificates.
   * In production this is driven by an oracle bridging the competency channel
   * (DI1 ties the premium to measurable OHS metrics). 0.06 per expired cert.
   */
  async UpdateCompliancePenalty(ctx, expiredCount, projectId) {
    assertPermission(ctx, 'reportAccident');
    const n = parseInt(expiredCount, 10);
    if (Number.isNaN(n) || n < 0) {
      throw new Error(`Invalid expiredCount "${expiredCount}"`);
    }
    const premium = await this._getPremium(ctx, projectId);
    premium.expiredPenalty = Number((n * 0.06).toFixed(2));
    this._recompute(premium);
    await ctx.stub.putState(this._premiumKey(ctx, projectId), Buffer.from(JSON.stringify(premium)));
    return JSON.stringify({ result: 'PENALTY_UPDATED', premiumFactor: premium.factor });
  }

  /** Read the current premium breakdown for a project. */
  async GetPremium(ctx, projectId) {
    assertPermission(ctx, 'verifyCertificate');
    const premium = await this._getPremium(ctx, projectId);
    return JSON.stringify(premium);
  }

  _shardKey(ctx, projectId, shardId) {
    return ctx.stub.createCompositeKey('premiumShard', [projectId, String(shardId)]);
  }

  /**
   * Sharded accident report (DI1 scalability). To avoid intra-project MVCC
   * contention when many subcontractors report concurrently for the SAME
   * project, the project's premium aggregate is split into shards; each report
   * updates one shard, so concurrent writes touch disjoint keys. The factor is
   * recomposed on read (GetPremiumSharded) — a delta/CRDT-style accumulator.
   */
  async ReportAccidentSharded(ctx, workerId, subcontractor, severity, reportSummary, projectId, shardId) {
    assertPermission(ctx, 'reportAccident');
    const weight = SEVERITY_WEIGHTS[severity];
    if (weight === undefined) {
      throw new Error(`Invalid severity "${severity}" (expected: low|medium|high|fatal)`);
    }
    const key = this._shardKey(ctx, projectId, shardId);
    const data = await ctx.stub.getState(key);
    const shard = (data && data.length > 0)
      ? JSON.parse(data.toString())
      : { docType: 'premiumShard', projectId, shardId: String(shardId), accidentCount: 0, severitySum: 0 };
    shard.accidentCount += 1;
    shard.severitySum = Number((shard.severitySum + weight).toFixed(2));
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(shard)));
    const reportHash = sha256(`${workerId}:${severity}:${reportSummary}:${txTimestampISO(ctx)}`);
    ctx.stub.setEvent('ACCIDENT_REPORTED_SHARDED', Buffer.from(JSON.stringify({
      workerId, projectId, shardId: String(shardId), severity, reportHash,
    })));
    return JSON.stringify({ result: 'SHARD_UPDATED', projectId, shardId: String(shardId), reportHash });
  }

  /** Recompose a project's premium factor by summing its shards. */
  async GetPremiumSharded(ctx, projectId, numShards) {
    assertPermission(ctx, 'verifyCertificate');
    const n = parseInt(numShards, 10);
    let accidentCount = 0; let severitySum = 0;
    for (let i = 0; i < n; i++) {
      const data = await ctx.stub.getState(this._shardKey(ctx, projectId, i));
      if (data && data.length > 0) {
        const s = JSON.parse(data.toString());
        accidentCount += s.accidentCount; severitySum += s.severitySum;
      }
    }
    severitySum = Number(severitySum.toFixed(2));
    const factor = Number(Math.min(2.75, 1 + 0.04 * accidentCount + severitySum).toFixed(2));
    return JSON.stringify({ projectId, accidentCount, severitySum, factor, shards: n });
  }
}

module.exports = AccidentPremiumContract;
