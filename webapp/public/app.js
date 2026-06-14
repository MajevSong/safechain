'use strict';
// Front-end for the REAL SafeChain Fabric network. Every action calls the REST
// backend, which submits/evaluates on-chain. The role selector picks the signing
// organisation, so ABAC, channel membership and the cross-channel flow are real.

const state = { role: 'contractor', workers: [], calls: 0, ok: 0, lastLatency: 0 };

const els = {
  roleSelect: document.querySelector('#roleSelect'),
  tabs: document.querySelectorAll('.tab'),
  views: document.querySelectorAll('.view'),
  workerForm: document.querySelector('#workerForm'),
  accidentForm: document.querySelector('#accidentForm'),
  assignmentForm: document.querySelector('#assignmentForm'),
  workerList: document.querySelector('#workerList'),
  accidentWorker: document.querySelector('#accidentWorker'),
  assignmentWorker: document.querySelector('#assignmentWorker'),
  ledgerList: document.querySelector('#ledgerList'),
  contractOutput: document.querySelector('#contractOutput'),
  contractStatus: document.querySelector('#contractStatus'),
  complianceScore: document.querySelector('#complianceScore'),
  premiumFactor: document.querySelector('#premiumFactor'),
  ledgerCount: document.querySelector('#ledgerCount'),
  premiumBreakdown: document.querySelector('#premiumBreakdown'),
  responsibilityChain: document.querySelector('#responsibilityChain'),
  metricThroughput: document.querySelector('#metricThroughput'),
  metricLatency: document.querySelector('#metricLatency'),
  metricSuccess: document.querySelector('#metricSuccess'),
};

const ledger = [];

async function api(method, url, body) {
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const t = performance.now();
  let data;
  try {
    const res = await fetch(url, opt);
    data = await res.json();
  } catch (e) {
    data = { ok: false, error: 'backend unreachable: ' + e.message };
  }
  state.calls += 1;
  if (data.ok) state.ok += 1;
  state.lastLatency = data.latencyMs ?? Math.round(performance.now() - t);
  ledger.unshift({ when: new Date().toLocaleTimeString('tr-TR'), method, url, ok: data.ok,
    note: data.error || (data.result ? (data.result.result || JSON.stringify(data.result).slice(0, 60)) : 'OK') });
  renderMetrics();
  renderLedger();
  return data;
}

function show(status, obj) {
  els.contractStatus.textContent = status;
  els.contractOutput.textContent = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
}

function renderMetrics() {
  els.metricLatency.textContent = `${state.lastLatency} ms`;
  els.metricThroughput.textContent = state.lastLatency ? Math.max(1, Math.round(1000 / state.lastLatency)) : 0;
  els.metricSuccess.textContent = state.calls ? `${Math.round(100 * state.ok / state.calls)}%` : '100%';
  const valid = state.workers.filter((w) => w.status === 'valid').length;
  els.complianceScore.textContent = state.workers.length ? `${Math.round(100 * valid / state.workers.length)}%` : '—';
}

async function refreshStatus() {
  const s = await api('GET', '/api/status');
  if (s.ok && s.height != null) els.ledgerCount.textContent = s.height;
}

async function refreshPremium(projectId = 'default') {
  const r = await api('GET', `/api/premium/${projectId}?role=contractor`);
  if (r.ok && r.result) {
    const p = r.result;
    els.premiumFactor.textContent = Number(p.factor).toFixed(2);
    els.premiumBreakdown.innerHTML = `
      <div class="item"><strong>Proje</strong><span>${p.projectId}</span></div>
      <div class="item"><strong>Kaza sayısı</strong><span>${p.accidentCount}</span></div>
      <div class="item"><strong>Olay ağırlık skoru</strong><span>${Number(p.severitySum).toFixed(2)}</span></div>
      <div class="item"><strong>Uyum cezası</strong><span>${Number(p.expiredPenalty || 0).toFixed(2)}</span></div>
      <div class="item"><strong>Güncel prim katsayısı</strong><span>${Number(p.factor).toFixed(2)}</span></div>`;
  }
}

function renderWorkers() {
  els.workerList.innerHTML = state.workers.map((w) => `
    <div class="item">
      <div class="item-head"><strong>${w.workerId}</strong>
        <span class="badge ${w.status}">${w.status === 'valid' ? 'Geçerli' : 'Süresi doldu'}</span></div>
      <div>${w.subcontractor} · ${w.certificateType} · ${w.validUntil}</div>
      <p class="hash">Pseudonym: ${w.pseudonym || '-'}<br>Belge hash: ${(w.documentHash || '').slice(0, 32)}…</p>
      <button class="tab" data-verify="${w.workerId}">Doğrula</button>
    </div>`).join('') || '<p>Henüz işçi kaydı yok. Sertifika kaydı yapın.</p>';
  const opts = state.workers.map((w) => `<option value="${w.workerId}">${w.workerId} - ${w.certificateType}</option>`).join('');
  els.accidentWorker.innerHTML = opts;
  els.assignmentWorker.innerHTML = opts;
}

function renderLedger() {
  els.ledgerList.innerHTML = ledger.slice(0, 25).map((b) => `
    <div class="ledger-item">
      <strong>${b.ok ? '✅' : '❌'} ${b.method} ${b.url.replace('/api/', '')}</strong>
      <span>${b.when}</span>
      <span class="hash">${b.note}</span>
    </div>`).join('');
}

function renderResponsibility(parts, responsible, result) {
  els.responsibilityChain.innerHTML = parts.map((part, i) => {
    const isResp = part === responsible;
    return `<div class="chain-step">
      <span class="badge ${isResp ? (String(result).includes('REJECT') ? 'reject' : 'valid') : ''}">${i + 1}</span>
      <strong>${part}</strong>
      <p>${isResp ? 'Akıllı sözleşme tarafından sorumlu taraf olarak işaretlendi.' : 'Sorumluluk zincirinde izlenebilir taraf.'}</p>
    </div>`;
  }).join('');
}

// ---- form handlers ----
els.roleSelect.addEventListener('change', (e) => {
  state.role = e.target.value;
  show('Rol değişti (gerçek imzalayan organizasyon).', { activeRole: state.role });
});

els.workerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const id = `W-${Date.now().toString().slice(-6)}`;
  const body = { role: state.role, workerId: id, subcontractor: f.subcontractor.value,
    certificateType: f.certificateType.value, validUntil: f.validUntil.value, document: f.document.value };
  const r = await api('POST', '/api/register', body);
  if (r.ok) {
    state.workers.push(r.result.worker);
    renderWorkers();
    show('Sertifika zincire yazıldı (on-chain).', r.result);
  } else {
    show('İşlem reddedildi (gerçek ABAC).', r.error);
  }
  await refreshStatus();
});

els.accidentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const body = { role: state.role, workerId: f.workerId.value, subcontractor: f.subcontractor.value,
    severity: f.severity.value, report: f.report.value, projectId: 'default' };
  const r = await api('POST', '/api/report-accident', body);
  show(r.ok ? 'Kaza kaydı alındı, prim güncellendi (premium kanalı).' : 'İşlem reddedildi.', r.ok ? r.result : r.error);
  if (r.ok) await refreshPremium('default');
  await refreshStatus();
});

els.assignmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const r = await api('POST', '/api/authorize',
    { role: state.role, workerId: f.workerId.value, task: f.task.value, contractPath: f.contract.value });
  if (r.ok) {
    show(r.result.result === 'APPROVE_ASSIGNMENT' ? 'Görev ataması onaylandı.' : 'Görev ataması reddedildi.', r.result);
    renderResponsibility(r.result.contractPath, r.result.responsibleParty, r.result.result);
  } else { show('İşlem reddedildi.', r.error); }
  await refreshStatus();
});

document.addEventListener('click', async (e) => {
  const verifyId = e.target.dataset.verify;
  const scenario = e.target.dataset.scenario;
  if (verifyId) {
    const r = await api('POST', '/api/verify', { role: state.role, workerId: verifyId });
    show(r.ok ? `Doğrulama: ${r.result.result}` : 'İşlem reddedildi.', r.ok ? r.result : r.error);
  }
  if (scenario === 'crosschannel') await runCrossChannel();
});

// Cross-channel demo: subcontractor submits -> auditor attests -> contractor relays to premium.
async function runCrossChannel() {
  const acc = `ACC-${Date.now().toString().slice(-6)}`;
  const wid = state.workers[0]?.workerId || 'W-0001';
  show('Çapraz-kanal akışı başladı…', { accidentId: acc });
  const s = await api('POST', '/api/submit-accident',
    { role: 'subcontractor', accidentId: acc, workerId: wid, subcontractor: 'Beta Kalıp', severity: 'high', report: 'scaffold collapse', projectId: 'projX' });
  if (!s.ok) return show('1) Submit reddedildi.', s.error);
  const a = await api('POST', '/api/attest', { role: 'auditor', accidentId: acc });
  if (!a.ok) return show('2) Attest reddedildi (sadece denetçi attest edebilir).', a.error);
  const rep = await api('POST', '/api/report-accident',
    { role: 'contractor', workerId: wid, subcontractor: 'Beta Kalıp', severity: 'high', report: `relayed:${acc}`, projectId: 'projX' });
  show('Çapraz-kanal tamam: taşeron submit → denetçi attest → premium güncellendi.',
    { submit: s.result, attest: a.result, premium: rep.result });
  await refreshPremium('projX');
  await refreshStatus();
}

// Inject a cross-channel scenario button into the demo list.
window.addEventListener('DOMContentLoaded', () => {
  const list = document.querySelector('.scenario-list');
  if (list) {
    const b = document.createElement('button');
    b.dataset.scenario = 'crosschannel';
    b.textContent = 'D: Çapraz-kanal akışı (taşeron→denetçi→prim)';
    list.appendChild(b);
  }
  show('SafeChain — GERÇEK Fabric ağına bağlı.', { network: '4-org / 2-kanal', backend: 'Fabric Gateway' });
  refreshStatus();
  refreshPremium('default');
});
