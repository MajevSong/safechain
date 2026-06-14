'use strict';

const { expect } = require('chai');
const { createContext } = require('./mockContext');
const CompetencyContract = require('../lib/competencyContract');
const AccidentPremiumContract = require('../lib/accidentPremiumContract');
const ResponsibilityContract = require('../lib/responsibilityContract');
const AccidentIntakeContract = require('../lib/accidentIntakeContract');

const competency = new CompetencyContract();
const premium = new AccidentPremiumContract();
const responsibility = new ResponsibilityContract();
const intake = new AccidentIntakeContract();

async function registerValidWorker(ctx, overrides = {}) {
  const w = Object.assign({
    id: 'W-1001', sub: 'Beta Kalip', cert: 'Yuksekte Calisma', validUntil: '2026-12-30', doc: 'cert+training',
  }, overrides);
  return competency.RegisterCertificate(ctx, w.id, w.sub, w.cert, w.validUntil, w.doc);
}

describe('CompetencyContract', () => {
  it('registers a worker and anchors a document hash + pseudonym', async () => {
    const ctx = createContext();
    const res = JSON.parse(await registerValidWorker(ctx));
    expect(res.result).to.equal('REGISTERED');
    expect(res.worker.documentHash).to.have.lengthOf(64);
    expect(res.worker.pseudonym).to.match(/^wrk_/);
    expect(res.worker.status).to.equal('valid');
    expect(ctx._events.map((e) => e.name)).to.include('CERTIFICATE_REGISTERED');
  });

  it('verifies a valid certificate as APPROVE', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx);
    const res = JSON.parse(await competency.VerifyCertificate(ctx, 'W-1001'));
    expect(res.result).to.equal('APPROVE');
  });

  it('flags an expired certificate as WARN_EXPIRED', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx, { id: 'W-1002', validUntil: '2026-05-14' });
    const res = JSON.parse(await competency.VerifyCertificate(ctx, 'W-1002'));
    expect(res.result).to.equal('WARN_EXPIRED');
  });

  it('rejects registration from an unauthorised role (ABAC)', async () => {
    const ctx = createContext({ msp: 'AuditorMSP' });
    let err;
    try { await registerValidWorker(ctx); } catch (e) { err = e; }
    expect(err).to.be.an('error');
    expect(err.message).to.match(/ABAC denied/);
  });

  it('rejects duplicate worker registration', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx);
    let err;
    try { await registerValidWorker(ctx); } catch (e) { err = e; }
    expect(err).to.be.an('error');
    expect(err.message).to.match(/already registered/);
  });

  it('stores PII in a private collection, never on public state', async () => {
    const ctx = createContext();
    ctx._setTransient({ pii: { name: 'Ayse Demir', nationalId: '12345678901' } });
    await registerValidWorker(ctx);
    const pub = JSON.parse((await ctx.stub.getState(ctx.stub.createCompositeKey('worker', ['W-1001']))).toString());
    expect(pub).to.not.have.property('name');
    const priv = JSON.parse((await ctx.stub.getPrivateData('workerPiiCollection', 'W-1001')).toString());
    expect(priv.name).to.equal('Ayse Demir');
    // National ID is stored as a keyed HMAC token, not raw and not a plain hash.
    const crypto = require('crypto');
    expect(priv.nationalIdToken).to.have.lengthOf(64);
    expect(priv.nationalIdToken).to.not.equal('12345678901');
    expect(priv.nationalIdToken).to.not.equal(crypto.createHash('sha256').update('12345678901').digest('hex'));
  });
});

describe('AccidentPremiumContract', () => {
  it('starts at base factor 1.00', async () => {
    const ctx = createContext();
    const p = JSON.parse(await premium.GetPremium(ctx, 'P1'));
    expect(p.factor).to.equal(1);
  });

  it('updates the premium factor after a medium accident', async () => {
    const ctx = createContext();
    const res = JSON.parse(await premium.ReportAccident(ctx, 'W-1001', 'Beta Kalip', 'medium', 'fall risk', 'P1'));
    // 1 + 0.04*1 + 0.15 = 1.19
    expect(res.premiumFactor).to.equal(1.19);
  });

  it('accumulates severity across multiple accidents', async () => {
    const ctx = createContext();
    await premium.ReportAccident(ctx, 'W-1001', 'Beta Kalip', 'high', 'r1', 'P1');
    const res = JSON.parse(await premium.ReportAccident(ctx, 'W-1002', 'Gamma Iskele', 'fatal', 'r2', 'P1'));
    // 1 + 0.04*2 + (0.32+0.70) = 2.10
    expect(res.premiumFactor).to.equal(2.1);
  });

  it('caps the factor at 2.75', async () => {
    const ctx = createContext();
    for (let i = 0; i < 10; i++) {
      await premium.ReportAccident(ctx, `W-${i}`, 'Sub', 'fatal', `r${i}`, 'P1');
    }
    const p = JSON.parse(await premium.GetPremium(ctx, 'P1'));
    expect(p.factor).to.equal(2.75);
  });

  it('rejects an invalid severity class', async () => {
    const ctx = createContext();
    let err;
    try { await premium.ReportAccident(ctx, 'W-1', 'Sub', 'catastrophic', 'r', 'P1'); } catch (e) { err = e; }
    expect(err.message).to.match(/Invalid severity/);
  });

  it('adds a compliance penalty for expired certificates', async () => {
    const ctx = createContext();
    const res = JSON.parse(await premium.UpdateCompliancePenalty(ctx, '2', 'P1'));
    // 1 + 0 + 0 + 0.06*2 = 1.12
    expect(res.premiumFactor).to.equal(1.12);
  });
});

describe('AccidentPremiumContract — sharded aggregate (MVCC-at-scale)', () => {
  it('spreads reports across shards and recomposes the same factor', async () => {
    const ctx = createContext();
    // 4 accidents for one project across 4 distinct shards (disjoint keys).
    await premium.ReportAccidentSharded(ctx, 'W1', 'Sub', 'medium', 'r', 'projHot', '0');
    await premium.ReportAccidentSharded(ctx, 'W2', 'Sub', 'medium', 'r', 'projHot', '1');
    await premium.ReportAccidentSharded(ctx, 'W3', 'Sub', 'high', 'r', 'projHot', '2');
    await premium.ReportAccidentSharded(ctx, 'W4', 'Sub', 'low', 'r', 'projHot', '3');
    const agg = JSON.parse(await premium.GetPremiumSharded(ctx, 'projHot', '8'));
    // 1 + 0.04*4 + (0.15+0.15+0.32+0.05) = 1 + 0.16 + 0.67 = 1.83
    expect(agg.accidentCount).to.equal(4);
    expect(agg.factor).to.equal(1.83);
  });
});

describe('ResponsibilityContract', () => {
  it('approves a task when certificate is valid and matches', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx);
    const res = JSON.parse(await responsibility.AuthorizeTask(ctx, 'W-1001', 'Yuksekte Calisma', 'Alfa > Beta Kalip > Gamma'));
    expect(res.result).to.equal('APPROVE_ASSIGNMENT');
    expect(res.responsibleParty).to.equal('Gamma');
  });

  it('rejects and pins the subcontractor when certificate mismatches the task', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx);
    const res = JSON.parse(await responsibility.AuthorizeTask(ctx, 'W-1001', 'Elektrik Guvenligi', 'Alfa > Beta Kalip > Gamma'));
    expect(res.result).to.equal('REJECT_ASSIGNMENT');
    expect(res.reason).to.equal('CERTIFICATE_MISMATCH');
    expect(res.responsibleParty).to.equal('Beta Kalip');
  });

  it('rejects when the certificate is expired', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx, { validUntil: '2026-05-14' });
    const res = JSON.parse(await responsibility.AuthorizeTask(ctx, 'W-1001', 'Yuksekte Calisma', 'Alfa > Beta Kalip'));
    expect(res.result).to.equal('REJECT_ASSIGNMENT');
    expect(res.reason).to.equal('CERTIFICATE_EXPIRED');
  });
});

describe('AccidentIntakeContract (cross-channel multi-sig flow)', () => {
  async function submit(ctx, id = 'ACC-1') {
    return intake.SubmitAccident(ctx, id, 'W-1001', 'Beta Kalip', 'medium', 'fall on site', 'P1');
  }

  it('subcontractor submits an accident -> PENDING_ATTESTATION + event', async () => {
    const ctx = createContext({ msp: 'SubcontractorMSP' });
    const res = JSON.parse(await submit(ctx));
    expect(res.status).to.equal('PENDING_ATTESTATION');
    expect(res.submittedBy).to.equal('subcontractor');
    expect(ctx._events.map((e) => e.name)).to.include('ACCIDENT_SUBMITTED');
  });

  it('auditor attests a submitted accident -> ATTESTED + relay event', async () => {
    const ctx = createContext({ msp: 'SubcontractorMSP' });
    await submit(ctx);
    ctx._setIdentity('AuditorMSP'); // inspector now acts on the same world state
    const res = JSON.parse(await intake.AttestAccident(ctx, 'ACC-1'));
    expect(res.status).to.equal('ATTESTED');
    expect(res.attestedBy).to.equal('auditor');
    expect(ctx._events.map((e) => e.name)).to.include('ACCIDENT_ATTESTED');
  });

  it('rejects attestation by a non-inspector role (ABAC)', async () => {
    const ctx = createContext({ msp: 'SubcontractorMSP' });
    await submit(ctx);
    let err;
    try { await intake.AttestAccident(ctx, 'ACC-1'); } catch (e) { err = e; }
    expect(err.message).to.match(/ABAC denied/);
  });

  it('rejects accident submission by a worker (ABAC)', async () => {
    const ctx = createContext({ msp: 'WorkerOrgMSP', role: 'worker' });
    let err;
    try { await submit(ctx); } catch (e) { err = e; }
    expect(err.message).to.match(/ABAC denied/);
  });

  it('rejects duplicate submission and invalid severity', async () => {
    const ctx = createContext({ msp: 'SubcontractorMSP' });
    await submit(ctx);
    let dup; try { await submit(ctx); } catch (e) { dup = e; }
    expect(dup.message).to.match(/already submitted/);
    let bad;
    try { await intake.SubmitAccident(ctx, 'ACC-9', 'W-1', 'Sub', 'extreme', 'r', 'P1'); } catch (e) { bad = e; }
    expect(bad.message).to.match(/Invalid severity/);
  });

  it('relay marker is idempotent (at-least-once safe)', async () => {
    const ctx = createContext({ msp: 'SubcontractorMSP' });
    await submit(ctx, 'ACC-IDM');
    ctx._setIdentity('AuditorMSP');
    await intake.AttestAccident(ctx, 'ACC-IDM');
    ctx._setIdentity('ContractorMSP'); // relay party
    const first = JSON.parse(await intake.MarkRelayed(ctx, 'ACC-IDM'));
    const second = JSON.parse(await intake.MarkRelayed(ctx, 'ACC-IDM')); // duplicate delivery
    expect(first.result).to.equal('RELAYED');
    expect(second.result).to.equal('ALREADY_RELAYED'); // no-op, no double count
  });
});

describe('Adversarial / negative cases', () => {
  it('rejects reads of non-existent records', async () => {
    const ctx = createContext();
    for (const fn of [
      () => competency.VerifyCertificate(ctx, 'NOPE'),
      () => competency.GetWorker(ctx, 'NOPE'),
      () => responsibility.AuthorizeTask(ctx, 'NOPE', 'X', 'A > B'),
      () => intake.GetAccident(ctx, 'NOPE'),
    ]) {
      let err; try { await fn(); } catch (e) { err = e; }
      expect(err, 'expected a not-found error').to.be.an('error');
      expect(err.message).to.match(/not found/);
    }
  });

  it('blocks role-mismatch attacks (ABAC)', async () => {
    // Insurer cannot register; Worker cannot authorise; Insurer cannot submit accidents.
    const insurer = createContext({ msp: 'InsurerMSP' });
    const worker = createContext({ msp: 'X', role: 'worker' });
    const checks = [
      [() => competency.RegisterCertificate(insurer, 'W-X', 'S', 'Yuksekte Calisma', '2026-12-30', 'd'), 'insurer register'],
      [() => responsibility.AuthorizeTask(worker, 'W-1', 'Yuksekte Calisma', 'A > B'), 'worker authorise'],
      [() => intake.SubmitAccident(insurer, 'ACC-X', 'W-1', 'S', 'medium', 'r', 'P1'), 'insurer submit'],
    ];
    for (const [fn, label] of checks) {
      let err; try { await fn(); } catch (e) { err = e; }
      expect(err, `expected ABAC denial for ${label}`).to.be.an('error');
      expect(err.message).to.match(/ABAC denied/);
    }
  });

  it('detects transaction-timestamp skew for certificate validity', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx); // valid until 2026-12-30, registered 2026-06-03
    let res = JSON.parse(await competency.VerifyCertificate(ctx, 'W-1001'));
    expect(res.result).to.equal('APPROVE');
    ctx._setTxMillis(Date.parse('2027-06-01T00:00:00Z')); // clock advances past validity
    res = JSON.parse(await competency.VerifyCertificate(ctx, 'W-1001'));
    expect(res.result).to.equal('WARN_EXPIRED');
  });

  it('rejects replayed attestation (idempotency guard)', async () => {
    const ctx = createContext({ msp: 'SubcontractorMSP' });
    await intake.SubmitAccident(ctx, 'ACC-R', 'W-1', 'Beta', 'medium', 'r', 'P1');
    ctx._setIdentity('AuditorMSP');
    await intake.AttestAccident(ctx, 'ACC-R');
    let err; try { await intake.AttestAccident(ctx, 'ACC-R'); } catch (e) { err = e; }
    expect(err.message).to.match(/already attested/);
  });
});

describe('End-to-end DSRM scenarios (A, B, C)', () => {
  it('Scenario A — certificate expiry is detected on verification', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx, { id: 'W-1002', cert: 'Iskele Kurulumu', validUntil: '2026-05-14' });
    const res = JSON.parse(await competency.VerifyCertificate(ctx, 'W-1002'));
    expect(res.result).to.equal('WARN_EXPIRED');
  });

  it('Scenario B — accident report triggers a premium update + event', async () => {
    const ctx = createContext();
    const res = JSON.parse(await premium.ReportAccident(ctx, 'W-1001', 'Beta Kalip', 'medium', 'formwork fall', 'P1'));
    expect(res.premiumFactor).to.be.greaterThan(1);
    expect(ctx._events.map((e) => e.name)).to.include('ACCIDENT_REPORTED_PREMIUM_UPDATED');
  });

  it('Scenario C — multi-subcontractor responsibility is pinned on reject', async () => {
    const ctx = createContext();
    await registerValidWorker(ctx, { id: 'W-1002', cert: 'Iskele Kurulumu', validUntil: '2026-05-14', sub: 'Gamma Iskele' });
    const res = JSON.parse(await responsibility.AuthorizeTask(ctx, 'W-1002', 'Iskele Kurulumu', 'Alfa Insaat > Beta Kalip > Gamma Iskele'));
    expect(res.result).to.equal('REJECT_ASSIGNMENT');
    expect(res.responsibleParty).to.equal('Gamma Iskele');
  });
});
