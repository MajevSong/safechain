'use strict';

const crypto = require('crypto');

// SHA-256 hex digest of a string. Used for anchoring high-entropy documents,
// where only the hash is written on-chain (DI4 — privacy-preserving
// traceability); the full document stays off-chain / in a private collection.
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// Keyed HMAC-SHA256 pseudonymisation key. National identifiers (TC Kimlik, 11
// digits) are LOW-entropy and trivially dictionary-attackable under a plain
// hash, so they are pseudonymised with a keyed HMAC instead. In production the
// key is held in an HSM / regulated key-management service under KEY VERSIONING:
// superseded keys are retained read-only so historical ledger tokens remain
// verifiable, and only the current key mints new tokens (rotation != erasure).
// Per-subject keys additionally enable cryptographic erasure (KVKK right-to-be-
// forgotten) by destroying a single subject's key. Sourced from the environment
// with a documented default here.
const PSEUDONYM_KEY = process.env.SAFECHAIN_PSEUDONYM_KEY || 'safechain-dev-pseudonym-key-v1';

// HMAC-SHA256 keyed pseudonym of a (possibly low-entropy) identifier. Without
// the key, the output is not reversible by dictionary attack.
function pseudonymise(value) {
  return crypto.createHmac('sha256', PSEUDONYM_KEY).update(String(value)).digest('hex');
}

// Severity weights used by the dynamic premium model (DI1). Calibrated from the
// SGK accident-severity tiers; see the paper's premium-model section.
const SEVERITY_WEIGHTS = {
  low: 0.05,
  medium: 0.15,
  high: 0.32,
  fatal: 0.7,
};

// Role catalogue (DI3 — transparent responsibility chain). Each organisation's
// MSP maps to exactly one SafeChain role. When client certificates carry a
// `safechain.role` attribute it takes precedence (attribute-based access
// control), otherwise the MSPID-derived role is used.
const MSP_ROLE = {
  ContractorMSP: 'contractor',
  SubcontractorMSP: 'subcontractor',
  InsurerMSP: 'insurer',
  AuditorMSP: 'auditor',
  // Dev fallback so the chaincode can be smoke-tested on the default
  // fabric-samples test-network (Org1/Org2) before the 4-org topology is built.
  Org1MSP: 'contractor',
  Org2MSP: 'subcontractor',
};

// Access model (DI3). Accident reporting is split across channels to remove the
// earlier inconsistency: subcontractors submit accidents on the competency
// channel (`submitAccident`); an inspector (auditor) attests them
// (`attestAccident`); only the dual-channel relay parties (contractor, insurer)
// perform the premium-side `reportAccident` on the premium channel.
const PERMISSIONS = {
  contractor: ['registerCertificate', 'verifyCertificate', 'submitAccident', 'reportAccident', 'authorizeTask', 'viewLedger'],
  subcontractor: ['registerCertificate', 'verifyCertificate', 'submitAccident', 'authorizeTask', 'viewLedger'],
  insurer: ['verifyCertificate', 'reportAccident', 'viewLedger'],
  auditor: ['verifyCertificate', 'attestAccident', 'viewLedger'],
  worker: ['verifyCertificate'],
};

function resolveRole(ctx) {
  // ABAC: prefer an explicit certificate attribute, fall back to MSP mapping.
  const attrRole = ctx.clientIdentity.getAttributeValue('safechain.role');
  if (attrRole) {
    return attrRole;
  }
  const mspId = ctx.clientIdentity.getMSPID();
  return MSP_ROLE[mspId] || 'worker';
}

function assertPermission(ctx, action) {
  const role = resolveRole(ctx);
  const allowed = PERMISSIONS[role] || [];
  if (!allowed.includes(action)) {
    throw new Error(`ABAC denied: role "${role}" is not authorised for "${action}"`);
  }
  return role;
}

// Deterministic timestamp from the transaction proposal. Using Date.now() inside
// chaincode is non-deterministic and breaks endorsement; the tx timestamp is the
// correct source of on-chain time.
function txTimestampISO(ctx) {
  const ts = ctx.stub.getTxTimestamp();
  const millis = ts.seconds.low * 1000 + Math.round(ts.nanos / 1e6);
  return new Date(millis).toISOString();
}

function isValidUntil(validUntil, ctx) {
  const now = new Date(txTimestampISO(ctx));
  return new Date(`${validUntil}T23:59:59Z`) >= now;
}

module.exports = {
  sha256,
  pseudonymise,
  SEVERITY_WEIGHTS,
  PERMISSIONS,
  MSP_ROLE,
  resolveRole,
  assertPermission,
  txTimestampISO,
  isValidUntil,
};
