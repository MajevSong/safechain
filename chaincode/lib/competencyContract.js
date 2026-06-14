'use strict';

const { Contract } = require('fabric-contract-api');
const {
  sha256,
  pseudonymise,
  assertPermission,
  resolveRole,
  txTimestampISO,
  isValidUntil,
} = require('./safechainLib');

// Private data collection holding worker PII (full name, national id). Only the
// hash/pseudonym is written to the public world state (DI4). The collection
// must be declared in collections_config.json at deploy time; when no transient
// PII is supplied the contract degrades gracefully to public-only data.
const PII_COLLECTION = 'workerPiiCollection';

/**
 * CompetencyContract — Yetkinlik Yönetim Modülü.
 * Manages worker identity and certificate lifecycle on the competency channel.
 * Implements DI2 (verifiable identity) and DI4 (privacy-preserving traceability).
 */
class CompetencyContract extends Contract {
  constructor() {
    super('CompetencyContract');
  }

  _workerKey(ctx, workerId) {
    return ctx.stub.createCompositeKey('worker', [workerId]);
  }

  /**
   * Register a worker certificate. PII (name, nationalId) is expected via the
   * transient field `pii` and stored in a private collection; the public record
   * keeps only the pseudonym and the SHA-256 document hash.
   */
  async RegisterCertificate(ctx, workerId, subcontractor, certificateType, validUntil, documentSummary) {
    assertPermission(ctx, 'registerCertificate');

    const key = this._workerKey(ctx, workerId);
    const existing = await ctx.stub.getState(key);
    if (existing && existing.length > 0) {
      throw new Error(`Worker ${workerId} already registered`);
    }

    const documentHash = sha256(`${workerId}:${certificateType}:${validUntil}:${documentSummary}`);
    const pseudonym = `wrk_${documentHash.slice(0, 6)}`;
    const status = isValidUntil(validUntil, ctx) ? 'valid' : 'expired';

    const worker = {
      docType: 'worker',
      workerId,
      pseudonym,
      subcontractor,
      certificateType,
      validUntil,
      documentHash,
      status,
      registeredBy: resolveRole(ctx),
      registeredAt: txTimestampISO(ctx),
    };
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(worker)));

    // Store PII off public-state in a private collection when provided.
    const transient = ctx.stub.getTransient();
    if (transient && transient.has('pii')) {
      const pii = JSON.parse(transient.get('pii').toString('utf8'));
      await ctx.stub.putPrivateData(PII_COLLECTION, workerId, Buffer.from(JSON.stringify({
        workerId,
        name: pii.name,
        // Keyed HMAC pseudonym of the low-entropy national ID (not a plain hash),
        // resistant to dictionary/re-identification attacks (KVKK).
        nationalIdToken: pii.nationalId ? pseudonymise(pii.nationalId) : undefined,
      })));
    }

    ctx.stub.setEvent('CERTIFICATE_REGISTERED', Buffer.from(JSON.stringify({
      workerId, pseudonym, certificateType, validUntil, documentHash,
    })));

    return JSON.stringify({ result: 'REGISTERED', worker });
  }

  /** Verify a worker certificate's validity at transaction time. */
  async VerifyCertificate(ctx, workerId) {
    assertPermission(ctx, 'verifyCertificate');

    const worker = await this._getWorker(ctx, workerId);
    const valid = isValidUntil(worker.validUntil, ctx);
    worker.status = valid ? 'valid' : 'expired';
    await ctx.stub.putState(this._workerKey(ctx, workerId), Buffer.from(JSON.stringify(worker)));

    const result = valid ? 'APPROVE' : 'WARN_EXPIRED';
    ctx.stub.setEvent('CERTIFICATE_VERIFIED', Buffer.from(JSON.stringify({
      workerId, pseudonym: worker.pseudonym, result, documentHash: worker.documentHash,
    })));

    return JSON.stringify({ result, pseudonym: worker.pseudonym, validUntil: worker.validUntil });
  }

  /** Read a single worker's public record. */
  async GetWorker(ctx, workerId) {
    assertPermission(ctx, 'verifyCertificate');
    const worker = await this._getWorker(ctx, workerId);
    return JSON.stringify(worker);
  }

  async _getWorker(ctx, workerId) {
    const data = await ctx.stub.getState(this._workerKey(ctx, workerId));
    if (!data || data.length === 0) {
      throw new Error(`Worker ${workerId} not found`);
    }
    return JSON.parse(data.toString());
  }
}

module.exports = CompetencyContract;
