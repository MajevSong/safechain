'use strict';
// Centralized baseline: the same SafeChain transactions (register / query /
// accident-premium) implemented as a single-server in-memory REST service with
// NO blockchain, consensus, endorsement, or TLS. It is an upper bound on
// centralized performance and the contrast for the decentralization cost.
const http = require('http');
const crypto = require('crypto');

const workers = new Map();
const premium = new Map();
const SEV = { low: 0.05, medium: 0.15, high: 0.32, fatal: 0.70 };
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

// Signed append-only hash-chain log: a CENTRALIZED tamper-evident baseline (PKI
// signatures + prev-hash), the strong non-blockchain integrity control. It
// provides tamper-evidence and non-repudiation, but a single key-holder/admin
// can still rewrite the whole chain offline — the property blockchain consensus
// removes. Benchmarking it isolates the *marginal* value of decentralisation.
const { privateKey: logKey } = crypto.generateKeyPairSync('ed25519');
let logPrevHash = 'GENESIS';
let logHeight = 0;
function appendSignedLog(entry) {
  const ts = Date.now();
  const body = JSON.stringify({ entry, prevHash: logPrevHash, height: ++logHeight, ts });
  const hash = sha256(body);
  const signature = crypto.sign(null, Buffer.from(hash), logKey).toString('base64');
  logPrevHash = hash;
  return { hash, signature, height: logHeight };
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    try {
      const u = req.url;
      if (req.method === 'POST' && u === '/register') {
        const d = JSON.parse(body || '{}');
        if (workers.has(d.workerId)) { res.writeHead(409); return res.end('exists'); }
        const documentHash = sha256(`${d.workerId}:${d.certificateType}:${d.validUntil}:${d.document}`);
        workers.set(d.workerId, { ...d, documentHash, pseudonym: `wrk_${documentHash.slice(0, 6)}`, status: 'valid' });
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ result: 'REGISTERED', pseudonym: `wrk_${documentHash.slice(0, 6)}` }));
      }
      if (req.method === 'POST' && u === '/register-signed') {
        const d = JSON.parse(body || '{}');
        if (workers.has(d.workerId)) { res.writeHead(409); return res.end('exists'); }
        const documentHash = sha256(`${d.workerId}:${d.certificateType}:${d.validUntil}:${d.document}`);
        workers.set(d.workerId, { ...d, documentHash, pseudonym: `wrk_${documentHash.slice(0, 6)}`, status: 'valid' });
        const proof = appendSignedLog({ op: 'register', workerId: d.workerId, documentHash });
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ result: 'REGISTERED', proof }));
      }
      if (req.method === 'GET' && u.startsWith('/worker/')) {
        const w = workers.get(decodeURIComponent(u.slice(8)));
        if (!w) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(w));
      }
      if (req.method === 'POST' && u === '/accident') {
        const d = JSON.parse(body || '{}');
        const w = SEV[d.severity];
        if (w === undefined) { res.writeHead(400); return res.end('bad severity'); }
        const p = premium.get(d.projectId) || { accidentCount: 0, severitySum: 0 };
        p.accidentCount++; p.severitySum = Number((p.severitySum + w).toFixed(2));
        p.factor = Number(Math.min(2.75, 1 + 0.04 * p.accidentCount + p.severitySum).toFixed(2));
        premium.set(d.projectId, p);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ result: 'PREMIUM_UPDATED', premiumFactor: p.factor }));
      }
      res.writeHead(404); res.end('nope');
    } catch (e) { res.writeHead(500); res.end(String(e)); }
  });
});
server.listen(3000, () => console.log('baseline listening on :3000'));
