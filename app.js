const today = new Date("2026-06-03T09:00:00+03:00");

const state = {
  role: "contractor",
  workers: [
    {
      id: "W-1001",
      name: "Ayse Demir",
      pseudonym: "wrk_7f3a91",
      subcontractor: "Beta Kalip",
      certificateType: "Yuksekte Calisma",
      validUntil: "2026-12-30",
      documentHash: "",
      status: "valid"
    },
    {
      id: "W-1002",
      name: "Mehmet Arslan",
      pseudonym: "wrk_19c8ae",
      subcontractor: "Gamma Iskele",
      certificateType: "Iskele Kurulumu",
      validUntil: "2026-05-14",
      documentHash: "",
      status: "expired"
    }
  ],
  accidents: [],
  ledger: [],
  premium: {
    base: 1,
    factor: 1,
    accidentFrequency: 0,
    severityScore: 0,
    subcontractorPenalty: 0
  },
  metrics: {
    throughput: 0,
    latency: 0,
    success: 100
  }
};

const permissions = {
  contractor: ["registerCertificate", "verifyCertificate", "reportAccident", "assignTask", "viewLedger"],
  subcontractor: ["registerCertificate", "verifyCertificate", "reportAccident", "assignTask"],
  insurer: ["verifyCertificate", "reportAccident", "viewLedger"],
  auditor: ["verifyCertificate", "viewLedger"],
  worker: ["verifyCertificate"]
};

const severityWeights = {
  low: 0.05,
  medium: 0.15,
  high: 0.32,
  fatal: 0.7
};

const els = {
  roleSelect: document.querySelector("#roleSelect"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
  workerForm: document.querySelector("#workerForm"),
  accidentForm: document.querySelector("#accidentForm"),
  assignmentForm: document.querySelector("#assignmentForm"),
  workerList: document.querySelector("#workerList"),
  accidentWorker: document.querySelector("#accidentWorker"),
  assignmentWorker: document.querySelector("#assignmentWorker"),
  ledgerList: document.querySelector("#ledgerList"),
  contractOutput: document.querySelector("#contractOutput"),
  contractStatus: document.querySelector("#contractStatus"),
  complianceScore: document.querySelector("#complianceScore"),
  premiumFactor: document.querySelector("#premiumFactor"),
  ledgerCount: document.querySelector("#ledgerCount"),
  premiumBreakdown: document.querySelector("#premiumBreakdown"),
  responsibilityChain: document.querySelector("#responsibilityChain"),
  metricThroughput: document.querySelector("#metricThroughput"),
  metricLatency: document.querySelector("#metricLatency"),
  metricSuccess: document.querySelector("#metricSuccess")
};

function normalizeTurkish(text) {
  return text
    .replaceAll("İ", "I")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle) {
    return fallbackHash(value);
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fallbackHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return hex.repeat(8);
}

function can(action) {
  return permissions[state.role]?.includes(action);
}

function assertPermission(action) {
  if (!can(action)) {
    throw new Error(`ABAC reddi: ${roleLabel(state.role)} rolunun ${action} islemi icin yetkisi yok.`);
  }
}

function roleLabel(role) {
  return {
    contractor: "Ana Yuklenici",
    subcontractor: "Taseron",
    insurer: "Sigorta Sirketi",
    auditor: "Kamu Denetcisi",
    worker: "Isci"
  }[role];
}

async function addBlock(type, actor, payload) {
  const started = performance.now();
  const previousHash = state.ledger.at(-1)?.hash ?? "GENESIS";
  const timestamp = new Date().toISOString();
  const hash = await sha256(JSON.stringify({ type, actor, payload, previousHash, timestamp }));
  const block = {
    index: state.ledger.length + 1,
    type,
    actor,
    timestamp,
    previousHash,
    hash,
    payload
  };
  state.ledger.unshift(block);
  state.metrics.latency = Math.max(9, Math.round(performance.now() - started + 18 + Math.random() * 35));
  state.metrics.throughput = Math.round(1000 / state.metrics.latency);
  render();
  return block;
}

async function initializeHashes() {
  for (const worker of state.workers) {
    worker.documentHash = await sha256(`${worker.id}:${worker.name}:${worker.certificateType}:${worker.validUntil}`);
  }
  await addBlock("SYSTEM_INIT", "System", {
    note: "SafeChain simulation ledger initialized",
    modules: ["competency", "accident-premium", "contract-responsibility"]
  });
}

function updateWorkerStatuses() {
  for (const worker of state.workers) {
    worker.status = new Date(`${worker.validUntil}T23:59:59`) >= today ? "valid" : "expired";
  }
}

async function registerCertificate(form) {
  assertPermission("registerCertificate");
  const data = Object.fromEntries(new FormData(form).entries());
  const id = `W-${1001 + state.workers.length}`;
  const certificateType = normalizeTurkish(data.certificateType);
  const documentHash = await sha256(`${id}:${data.name}:${certificateType}:${data.validUntil}:${data.document}`);
  const pseudonym = `wrk_${documentHash.slice(0, 6)}`;
  const worker = {
    id,
    name: data.name,
    pseudonym,
    subcontractor: data.subcontractor,
    certificateType,
    validUntil: data.validUntil,
    documentHash,
    status: new Date(`${data.validUntil}T23:59:59`) >= today ? "valid" : "expired"
  };
  state.workers.push(worker);
  const block = await addBlock("CERTIFICATE_REGISTERED", roleLabel(state.role), {
    workerId: id,
    pseudonym,
    certificateType,
    validUntil: data.validUntil,
    documentHash
  });
  showContract("Sertifika kaydi kabul edildi.", { worker, blockHash: block.hash });
}

async function verifyCertificate(workerId) {
  assertPermission("verifyCertificate");
  const worker = state.workers.find((item) => item.id === workerId);
  const valid = worker.status === "valid";
  const block = await addBlock("CERTIFICATE_VERIFIED", roleLabel(state.role), {
    workerId: worker.id,
    pseudonym: worker.pseudonym,
    result: valid ? "APPROVE" : "WARN_EXPIRED",
    documentHash: worker.documentHash
  });
  showContract(valid ? "Sertifika gecerli." : "Sertifika suresi dolmus.", {
    worker: worker.name,
    result: valid ? "APPROVE" : "WARN_EXPIRED",
    blockHash: block.hash
  });
}

async function reportAccident(form) {
  assertPermission("reportAccident");
  const data = Object.fromEntries(new FormData(form).entries());
  const worker = state.workers.find((item) => item.id === data.workerId);
  const reportHash = await sha256(`${worker.id}:${data.severity}:${data.report}:${Date.now()}`);
  state.accidents.push({
    workerId: worker.id,
    worker: worker.name,
    subcontractor: data.subcontractor,
    severity: data.severity,
    reportHash
  });
  recalculatePremium();
  const block = await addBlock("ACCIDENT_REPORTED_PREMIUM_UPDATED", roleLabel(state.role), {
    workerId: worker.id,
    pseudonym: worker.pseudonym,
    subcontractor: data.subcontractor,
    severity: data.severity,
    reportHash,
    premiumFactor: state.premium.factor
  });
  showContract("Kaza kaydi alindi ve prim katsayisi guncellendi.", {
    severity: data.severity,
    premiumFactor: state.premium.factor,
    blockHash: block.hash
  });
}

function recalculatePremium() {
  const frequency = state.accidents.length * 0.04;
  const severityScore = state.accidents.reduce((sum, accident) => sum + severityWeights[accident.severity], 0);
  const expiredPenalty = state.workers.filter((worker) => worker.status === "expired").length * 0.06;
  const factor = Math.min(2.75, 1 + frequency + severityScore + expiredPenalty);
  state.premium = {
    base: 1,
    factor: Number(factor.toFixed(2)),
    accidentFrequency: Number(frequency.toFixed(2)),
    severityScore: Number(severityScore.toFixed(2)),
    subcontractorPenalty: Number(expiredPenalty.toFixed(2))
  };
}

async function assignTask(form) {
  assertPermission("assignTask");
  const data = Object.fromEntries(new FormData(form).entries());
  const worker = state.workers.find((item) => item.id === data.workerId);
  const normalizedTask = normalizeTurkish(data.task);
  const certificateMatches = worker.certificateType === normalizedTask;
  const valid = worker.status === "valid" && certificateMatches;
  const result = valid ? "APPROVE_ASSIGNMENT" : "REJECT_ASSIGNMENT";
  const contractParts = data.contract.split(">").map((item) => item.trim());
  const responsibleParty = valid ? contractParts.at(-1) : worker.subcontractor;
  const block = await addBlock("TASK_AUTHORIZATION", roleLabel(state.role), {
    workerId: worker.id,
    task: normalizedTask,
    result,
    responsibleParty,
    contractPath: contractParts
  });
  showContract(valid ? "Gorev atamasi onaylandi." : "Gorev atamasi reddedildi.", {
    worker: worker.name,
    task: normalizedTask,
    result,
    responsibleParty,
    blockHash: block.hash
  });
  renderResponsibility(contractParts, responsibleParty, result);
}

function runScenario(name) {
  if (name === "certificate") {
    verifyCertificate("W-1002").catch(showError);
  }
  if (name === "accident") {
    const form = els.accidentForm;
    form.workerId.value = "W-1001";
    form.severity.value = "medium";
    reportAccident(form).catch(showError);
  }
  if (name === "responsibility") {
    const form = els.assignmentForm;
    form.workerId.value = "W-1002";
    form.task.value = "Yüksekte Çalışma";
    assignTask(form).catch(showError);
  }
}

function showContract(message, data) {
  els.contractStatus.textContent = message;
  els.contractOutput.textContent = JSON.stringify(data, null, 2);
}

function showError(error) {
  state.metrics.success = Math.max(60, state.metrics.success - 5);
  els.contractStatus.textContent = "Islem reddedildi";
  els.contractOutput.textContent = error.message;
  render();
}

function render() {
  updateWorkerStatuses();
  recalculatePremium();
  renderMetrics();
  renderWorkers();
  renderSelects();
  renderPremium();
  renderLedger();
  renderResponsibility(["Alfa Insaat", "Beta Kalip", "Gamma Iskele"], "Gamma Iskele", "READY");
}

function renderMetrics() {
  const validWorkers = state.workers.filter((worker) => worker.status === "valid").length;
  const compliance = Math.round((validWorkers / state.workers.length) * 100);
  els.complianceScore.textContent = `${compliance}%`;
  els.premiumFactor.textContent = state.premium.factor.toFixed(2);
  els.ledgerCount.textContent = state.ledger.length;
  els.metricThroughput.textContent = state.metrics.throughput;
  els.metricLatency.textContent = `${state.metrics.latency} ms`;
  els.metricSuccess.textContent = `${state.metrics.success}%`;
}

function renderWorkers() {
  els.workerList.innerHTML = state.workers
    .map((worker) => {
      const statusLabel = worker.status === "valid" ? "Gecerli" : "Suresi doldu";
      return `
        <div class="item">
          <div class="item-head">
            <strong>${worker.name}</strong>
            <span class="badge ${worker.status}">${statusLabel}</span>
          </div>
          <div>${worker.subcontractor} · ${worker.certificateType} · ${worker.validUntil}</div>
          <p class="hash">Pseudonym: ${worker.pseudonym}<br>Belge hash: ${worker.documentHash}</p>
          <button class="tab" data-verify="${worker.id}">Doğrula</button>
        </div>
      `;
    })
    .join("");
}

function renderSelects() {
  const options = state.workers.map((worker) => `<option value="${worker.id}">${worker.name} - ${worker.certificateType}</option>`).join("");
  els.accidentWorker.innerHTML = options;
  els.assignmentWorker.innerHTML = options;
}

function renderPremium() {
  els.premiumBreakdown.innerHTML = `
    <div class="item"><strong>Baz katsayi</strong><span>${state.premium.base.toFixed(2)}</span></div>
    <div class="item"><strong>Kaza sikligi etkisi</strong><span>+${state.premium.accidentFrequency.toFixed(2)}</span></div>
    <div class="item"><strong>Olay agirlik skoru</strong><span>+${state.premium.severityScore.toFixed(2)}</span></div>
    <div class="item"><strong>Sertifika/taşeron ceza etkisi</strong><span>+${state.premium.subcontractorPenalty.toFixed(2)}</span></div>
    <div class="item"><strong>Guncel prim katsayisi</strong><span>${state.premium.factor.toFixed(2)}</span></div>
  `;
}

function renderResponsibility(parts, responsibleParty, result) {
  els.responsibilityChain.innerHTML = parts
    .map((part, index) => {
      const isResponsible = part === responsibleParty;
      return `
        <div class="chain-step">
          <span class="badge ${isResponsible ? (result.includes("REJECT") ? "reject" : "valid") : ""}">${index + 1}</span>
          <strong>${part}</strong>
          <p>${isResponsible ? "Akilli sozlesme tarafindan sorumlu/aktif taraf olarak isaretlendi." : "Sorumluluk zincirinde izlenebilir taraf."}</p>
        </div>
      `;
    })
    .join("");
}

function renderLedger() {
  els.ledgerList.innerHTML = state.ledger
    .map((block) => `
      <div class="ledger-item">
        <strong>#${block.index} ${block.type}</strong>
        <span>${block.actor} · ${new Date(block.timestamp).toLocaleString("tr-TR")}</span>
        <span class="hash">Hash: ${block.hash}</span>
        <span class="hash">Onceki blok: ${block.previousHash}</span>
      </div>
    `)
    .join("");
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.remove("active"));
    els.views.forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.tab}`).classList.add("active");
  });
});

els.roleSelect.addEventListener("change", (event) => {
  state.role = event.target.value;
  showContract("Rol degisti.", { activeRole: roleLabel(state.role), permissions: permissions[state.role] });
});

els.workerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  registerCertificate(event.currentTarget).catch(showError);
});

els.accidentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  reportAccident(event.currentTarget).catch(showError);
});

els.assignmentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  assignTask(event.currentTarget).catch(showError);
});

document.addEventListener("click", (event) => {
  const verifyId = event.target.dataset.verify;
  const scenario = event.target.dataset.scenario;
  if (verifyId) verifyCertificate(verifyId).catch(showError);
  if (scenario) runScenario(scenario);
});

const tomorrow = new Date(today);
tomorrow.setMonth(tomorrow.getMonth() + 9);
els.workerForm.validUntil.value = tomorrow.toISOString().slice(0, 10);

initializeHashes().then(() => {
  showContract("SafeChain prototipi hazir.", {
    activeRole: roleLabel(state.role),
    designPrinciples: ["DI1 primlendirme", "DI2 kimlik", "DI3 sorumluluk", "DI4 gizlilik", "DI5 yonetilebilirlik"]
  });
});
