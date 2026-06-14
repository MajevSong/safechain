'use strict';
// Fixed-rate load generator for the centralized baseline. Mirrors the Caliper
// metrics (success, fail, avg/p95 latency, throughput).
// Usage: node loadtest.js <register|query|accident> <tps> <durationSec>
const http = require('http');
const [, , kind = 'register', tpsArg = '100', durArg = '90'] = process.argv;
const TPS = +tpsArg, DUR = +durArg * 1000;
const agent = new http.Agent({ keepAlive: true, maxSockets: 512 });
let sent = 0, ok = 0, fail = 0, counter = 0; const lat = [];

function fire() {
  counter++;
  const t = process.hrtime.bigint();
  let opts, bodyStr;
  if (kind === 'register') { opts = { method: 'POST', path: '/register' }; bodyStr = JSON.stringify({ workerId: `B-${counter}`, certificateType: 'X', validUntil: '2026-12-30', document: 'd' }); }
  else if (kind === 'signed') { opts = { method: 'POST', path: '/register-signed' }; bodyStr = JSON.stringify({ workerId: `S-${counter}`, certificateType: 'X', validUntil: '2026-12-30', document: 'd' }); }
  else if (kind === 'query') { opts = { method: 'GET', path: '/worker/SEED' }; }
  else { opts = { method: 'POST', path: '/accident' }; bodyStr = JSON.stringify({ severity: 'medium', projectId: `p-${counter}` }); }
  Object.assign(opts, { host: '127.0.0.1', port: 3000, agent });
  const req = http.request(opts, (r) => { r.on('data', () => {}); r.on('end', () => { lat.push(Number(process.hrtime.bigint() - t) / 1e6); (r.statusCode < 400 ? ok++ : fail++); }); });
  req.on('error', () => fail++);
  if (bodyStr) req.end(bodyStr); else req.end();
  sent++;
}

const seed = http.request({ host: '127.0.0.1', port: 3000, method: 'POST', path: '/register' }, () => {});
seed.end(JSON.stringify({ workerId: 'SEED', certificateType: 'X', validUntil: '2026-12-30', document: 'd' }));

const timer = setInterval(fire, 1000 / TPS);
setTimeout(() => { clearInterval(timer); setTimeout(report, 3000); }, DUR);
function report() {
  lat.sort((a, b) => a - b);
  const avg = lat.reduce((s, x) => s + x, 0) / (lat.length || 1);
  const p95 = lat[Math.floor(lat.length * 0.95)] || 0;
  console.log(JSON.stringify({ kind, tps: TPS, sent, ok, fail,
    avg_ms: +avg.toFixed(3), p95_ms: +p95.toFixed(3), throughput: +(ok / (DUR / 1000)).toFixed(1) }));
  process.exit(0);
}
