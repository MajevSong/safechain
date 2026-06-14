'use strict';
// SafeChain web backend: a thin REST API over the REAL 4-organisation Hyperledger
// Fabric network, using the Fabric Gateway SDK. A browser cannot speak gRPC+mTLS
// to peers directly, so this server brokers calls. It holds an identity per
// organisation, so the UI's role selector exercises REAL ABAC on the live chain.
const express = require('express');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const NET = path.join(process.env.HOME, 'safechain', 'safechain-net');
const ORGROOT = path.join(NET, 'organizations', 'peerOrganizations');
const CC = 'safechain';

const ORGS = {
  contractor:    { msp: 'ContractorMSP',    port: 7051,  domain: 'contractor.safechain.com' },
  subcontractor: { msp: 'SubcontractorMSP', port: 8051,  domain: 'subcontractor.safechain.com' },
  insurer:       { msp: 'InsurerMSP',       port: 9051,  domain: 'insurer.safechain.com' },
  auditor:       { msp: 'AuditorMSP',       port: 10051, domain: 'auditor.safechain.com' },
};

function firstFile(dir) { return path.join(dir, fs.readdirSync(dir)[0]); }

function gatewayFor(role) {
  const o = ORGS[role];
  if (!o) throw new Error(`unknown role ${role}`);
  const base = path.join(ORGROOT, o.domain);
  const userMsp = path.join(base, 'users', `User1@${o.domain}`, 'msp');
  const tlsCert = fs.readFileSync(path.join(base, 'tlsca', `tlsca.${o.domain}-cert.pem`));
  const peerHost = `peer0.${o.domain}`;
  const client = new grpc.Client(`localhost:${o.port}`, grpc.credentials.createSsl(tlsCert),
    { 'grpc.ssl_target_name_override': peerHost });
  const credentials = fs.readFileSync(firstFile(path.join(userMsp, 'signcerts')));
  const privateKey = crypto.createPrivateKey(fs.readFileSync(firstFile(path.join(userMsp, 'keystore'))));
  const gw = connect({
    client,
    identity: { mspId: o.msp, credentials },
    signer: signers.newPrivateKeySigner(privateKey),
    evaluateOptions: () => ({ deadline: Date.now() + 15000 }),
    endorseOptions: () => ({ deadline: Date.now() + 30000 }),
    submitOptions: () => ({ deadline: Date.now() + 30000 }),
    commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
  });
  return { gw, client };
}

const dec = (bytes) => Buffer.from(bytes).toString('utf8');

// One transaction helper: connect, (submit|evaluate), measure latency, clean up.
async function tx({ role, channel, contract, fn, args = [], evaluate = false }) {
  const started = Date.now();
  const { gw, client } = gatewayFor(role);
  try {
    const c = gw.getNetwork(channel).getContract(CC, contract);
    const bytes = evaluate
      ? await c.evaluateTransaction(fn, ...args)
      : await c.submitTransaction(fn, ...args);
    const out = dec(bytes);
    return { ok: true, latencyMs: Date.now() - started, result: out ? JSON.parse(out) : null };
  } finally {
    gw.close(); client.close();
  }
}

async function blockHeight(role = 'contractor', channel = 'competency') {
  const { gw, client } = gatewayFor(role);
  try {
    const bytes = await gw.getNetwork(channel).getContract('qscc').evaluateTransaction('GetChainInfo', channel);
    // GetChainInfo returns a protobuf; height is the first varint field — parse leniently.
    const buf = Buffer.from(bytes);
    let h = 0; if (buf.length > 1 && buf[0] === 0x08) { let i = 1, s = 0; while (i < buf.length) { h |= (buf[i] & 0x7f) << s; if (!(buf[i] & 0x80)) break; s += 7; i++; } }
    return h;
  } catch { return null; } finally { gw.close(); client.close(); }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = (h) => async (req, res) => {
  try { res.json(await h(req)); }
  catch (e) { res.status(400).json({ ok: false, error: String(e.message || e) }); }
};

// --- competency channel ---
app.post('/api/register', wrap((r) => tx({ role: r.body.role, channel: 'competency', contract: 'CompetencyContract',
  fn: 'RegisterCertificate', args: [r.body.workerId, r.body.subcontractor, r.body.certificateType, r.body.validUntil, r.body.document || 'cert'] })));
app.get('/api/worker/:id', wrap((r) => tx({ role: r.query.role || 'contractor', channel: 'competency', contract: 'CompetencyContract',
  fn: 'GetWorker', args: [r.params.id], evaluate: true })));
app.post('/api/verify', wrap((r) => tx({ role: r.body.role, channel: 'competency', contract: 'CompetencyContract',
  fn: 'VerifyCertificate', args: [r.body.workerId] })));
app.post('/api/authorize', wrap((r) => tx({ role: r.body.role, channel: 'competency', contract: 'ResponsibilityContract',
  fn: 'AuthorizeTask', args: [r.body.workerId, r.body.task, r.body.contractPath] })));
app.post('/api/submit-accident', wrap((r) => tx({ role: r.body.role, channel: 'competency', contract: 'AccidentIntakeContract',
  fn: 'SubmitAccident', args: [r.body.accidentId, r.body.workerId, r.body.subcontractor, r.body.severity, r.body.report || 'report', r.body.projectId || 'default'] })));
app.post('/api/attest', wrap((r) => tx({ role: r.body.role, channel: 'competency', contract: 'AccidentIntakeContract',
  fn: 'AttestAccident', args: [r.body.accidentId] })));
app.get('/api/accident/:id', wrap((r) => tx({ role: r.query.role || 'auditor', channel: 'competency', contract: 'AccidentIntakeContract',
  fn: 'GetAccident', args: [r.params.id], evaluate: true })));

// --- premium channel (Contractor + Insurer only) ---
app.post('/api/report-accident', wrap((r) => tx({ role: r.body.role, channel: 'premium', contract: 'AccidentPremiumContract',
  fn: 'ReportAccident', args: [r.body.workerId, r.body.subcontractor, r.body.severity, r.body.report || 'report', r.body.projectId || 'default'] })));
app.get('/api/premium/:project', wrap((r) => tx({ role: r.query.role || 'contractor', channel: 'premium', contract: 'AccidentPremiumContract',
  fn: 'GetPremium', args: [r.params.project], evaluate: true })));

app.get('/api/status', wrap(async () => ({ ok: true, height: await blockHeight() })));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SafeChain web backend on http://localhost:${PORT} (REAL Fabric network)`));
