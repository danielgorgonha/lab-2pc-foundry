import { JsonRpcProvider, Contract } from "https://esm.sh/ethers@6.13.2";

/* ---------------- Config ---------------- */
const CONTRACT = "0xA9b5F751E6711306c8A3B42c5926E9eE5fa9ff39";
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const ABI = [
  "function records(string) view returns (string, uint8, uint256, address, uint256)"
];
const TX_HASHES = {
  COMMIT: "0x8867e2a13e6446f294193505f1e389c6692dcac26ecfd4cc7429ff3bf5302bb9",
  ABORT:  "0x74bc40f0255dd26b6464c49ee05c2444ef52799cd9dfd0baa281e42754b7648c",
};

const provider = new JsonRpcProvider(RPC);
const contract = new Contract(CONTRACT, ABI, provider);

/* ---------------- Diagram geometry ---------------- */
const POINTS = {
  client: [400, 45],
  coord:  [400, 165],
  bankA:  [160, 335],
  bankB:  [640, 335],
  chain:  [400, 510],
};
const PATHS = {
  "client-coord": "path-cli-coord",
  "coord-bankA":  "path-coord-A",
  "coord-bankB":  "path-coord-B",
  "bankA-coord":  "path-A-coord",
  "bankB-coord":  "path-B-coord",
  "coord-chain":  "path-coord-chain",
};

/* ---------------- DOM refs ---------------- */
const $ = (id) => document.getElementById(id);
const packetG = $("packet-group");
const packetLabel = $("packet-label");
const packetPayload = $("packet-payload");
const logList = $("log-list");
const coordDecision = $("coord-decision");
const coordState = $("coord-state");
const balAEl = $("balA");
const balBEl = $("balB");
const voteAEl = $("voteA");
const voteBEl = $("voteB");
const statusAEl = $("statusA");
const statusBEl = $("statusB");
const chainState = $("chain-state");
const chainBlock = $("chain-block");
const chainLink = $("chain-link");

const phases = [$("phase-1") || document.querySelector('[data-phase="1"]'),
                $("phase-2") || document.querySelector('[data-phase="2"]'),
                $("phase-3") || document.querySelector('[data-phase="3"]')];

const soundChk = $("sound");
const btnCommit = $("btn-commit");
const btnAbort = $("btn-abort");
const btnFail = $("btn-fail");
const btnReset = $("btn-reset");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- State ---------------- */
let running = false;

/* ---------------- Sound (Web Audio) ---------------- */
let audioCtx;
function beep(freq = 440, duration = 80, type = "sine", vol = 0.08) {
  if (!soundChk.checked) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration / 1000);
    osc.stop(audioCtx.currentTime + duration / 1000);
  } catch {}
}
const soundMsg = () => beep(660, 60, "triangle");
const soundYes = () => beep(880, 90, "sine");
const soundNo  = () => beep(220, 140, "sawtooth");
const soundChain = () => { beep(523, 120); setTimeout(() => beep(784, 180), 110); };
const soundFail = () => beep(110, 400, "square", 0.06);

/* ---------------- Helpers ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ms = (n) => reducedMotion ? 0 : n;
const TRAVEL_MS = 1200;  // packet flight time (matches CSS transition)
const PAUSE_AFTER = 320; // small pause after each fly

function setPhase(idx, state = "active") {
  phases.forEach((el, i) => {
    el.classList.remove("active", "done", "abort", "chain");
    if (i < idx - 1) el.classList.add("done");
    else if (i === idx - 1) el.classList.add(state === "done" ? "done" : "active");
  });
}
function markPhaseDone(idx, variant = "") {
  const el = phases[idx - 1];
  el.classList.remove("active");
  el.classList.add("done");
  if (variant) el.classList.add(variant);
}
function clearPhases() {
  phases.forEach((el) => el.classList.remove("active", "done", "abort", "chain"));
}

function logStep(text, cls = "") {
  const li = document.createElement("li");
  li.textContent = text;
  if (cls) li.classList.add(cls);
  logList.appendChild(li);
  requestAnimationFrame(() => li.classList.add("shown"));
  logList.parentElement.scrollTop = logList.parentElement.scrollHeight;
}

function activate(nodeId) { $(nodeId).classList.add("active"); }
function deactivate(nodeId) { $(nodeId).classList.remove("active"); }

function hotPath(key, variant = "") {
  const id = PATHS[key];
  if (!id) return;
  const p = document.getElementById(id);
  p.classList.add("hot");
  if (variant) p.classList.add(`hot-${variant}`);
}
function clearPath(key) {
  const id = PATHS[key];
  if (!id) return;
  const p = document.getElementById(id);
  p.classList.remove("hot", "hot-yes", "hot-no", "hot-chain");
}
function clearAllPaths() {
  Object.values(PATHS).forEach((id) => document.getElementById(id).classList.remove("hot","hot-yes","hot-no","hot-chain"));
}

function resetUI() {
  packetG.classList.add("hidden");
  packetG.classList.remove("yes", "no", "chain");
  packetG.setAttribute("transform", "translate(-100,-100)");
  document.querySelectorAll("#diagram .node").forEach((n) =>
    n.classList.remove("active", "commit", "abort", "chain-recorded", "crashed", "blocked")
  );
  clearAllPaths();
  coordDecision.textContent = "";
  coordDecision.classList.remove("commit", "abort");
  coordState.textContent = "aguardando…";
  coordState.classList.remove("blocked");
  balAEl.textContent = "100";
  balBEl.textContent = "20";
  voteAEl.textContent = "";
  voteBEl.textContent = "";
  statusAEl.textContent = "";
  statusBEl.textContent = "";
  chainState.textContent = "aguardando registro…";
  chainBlock.textContent = "";
  chainLink.textContent = "";
  logList.innerHTML = "";
  clearPhases();
}

/* Fly a packet from `from` to `to`, light up the path, show payload bubble. */
async function fly(from, to, label, payload = "", variant = "") {
  const pathKey = `${from}-${to}`;
  const [fx, fy] = POINTS[from];
  const [tx, ty] = POINTS[to];

  packetG.classList.remove("yes", "no", "chain");
  if (variant) packetG.classList.add(variant);

  packetLabel.textContent = label;
  packetPayload.textContent = payload || "";
  packetG.setAttribute("transform", `translate(${fx},${fy})`);
  packetG.classList.remove("hidden");

  hotPath(pathKey, variant);
  soundMsg();

  await sleep(60);
  packetG.setAttribute("transform", `translate(${tx},${ty})`);
  await sleep(ms(TRAVEL_MS));

  packetG.classList.add("hidden");
  clearPath(pathKey);
  await sleep(ms(PAUSE_AFTER));
}

/* ---------------- Real on-chain receipt fetching ---------------- */
const receiptCache = {};
async function getReceipt(decision) {
  const hash = TX_HASHES[decision];
  if (!hash) return null;
  if (receiptCache[hash]) return receiptCache[hash];
  try {
    const r = await provider.getTransactionReceipt(hash);
    if (r) receiptCache[hash] = { blockNumber: r.blockNumber, gasUsed: r.gasUsed.toString(), hash };
    return receiptCache[hash];
  } catch (e) {
    return null;
  }
}

function showChainLink(decision) {
  const hash = TX_HASHES[decision];
  if (!hash) return;
  chainLink.innerHTML = "";
  const a = document.createElementNS("http://www.w3.org/2000/svg", "a");
  a.setAttribute("href", `https://sepolia.etherscan.io/tx/${hash}`);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener");
  a.textContent = `tx ${hash.slice(0,10)}…${hash.slice(-6)} ↗`;
  chainLink.appendChild(a);
}

/* ---------------- Scenarios ---------------- */
async function runScenario(kind) {
  if (running) return;
  running = true;
  [btnCommit, btnAbort, btnFail].forEach((b) => b.disabled = true);
  resetUI();

  const amount = kind === "ABORT" ? 150 : 50;
  const willCommit = kind === "COMMIT";
  const crashes = kind === "FAIL";

  // Step 1: client → coord
  logStep(`Cliente solicita transferência de ${amount} (A → B)`);
  activate("node-client");
  await fly("client", "coord", "REQUEST", `transfer ${amount}`);
  deactivate("node-client");
  activate("node-coord");
  coordState.textContent = "iniciando 2PC…";
  await sleep(ms(700));

  /* ===== PHASE 1: VOTING ===== */
  setPhase(1, "active");
  coordState.textContent = "Fase 1 · PREPARE";
  logStep(`▸ Fase 1 (voting): coordenador envia PREPARE`);

  await Promise.all([
    fly("coord", "bankA", "PREPARE", `{ amount: ${amount} }`),
    fly("coord", "bankB", "PREPARE", `{ amount: ${amount} }`),
  ]);
  activate("node-bankA");
  activate("node-bankB");
  await sleep(ms(900));

  // Votes
  const voteA = (kind === "ABORT") ? "NO" : "YES";
  const voteB = "YES";
  voteAEl.textContent = `voto: ${voteA}`;
  voteBEl.textContent = `voto: ${voteB}`;
  logStep(`Banco A vota ${voteA}${voteA === "NO" ? " — saldo insuficiente" : " — saldo ok"}`,
    voteA === "YES" ? "commit" : "abort");
  logStep(`Banco B vota ${voteB}`, "commit");
  voteA === "YES" ? soundYes() : soundNo();

  await Promise.all([
    fly("bankA", "coord", voteA, "", voteA === "YES" ? "yes" : "no"),
    fly("bankB", "coord", voteB, "", "yes"),
  ]);
  deactivate("node-bankA");
  deactivate("node-bankB");
  markPhaseDone(1);

  /* ===== FAILURE BRANCH ===== */
  if (crashes) {
    // Banco A crasha após votar YES, antes do COMMIT chegar
    logStep(`Banco A vota YES e crasha imediatamente após`, "warn");
    statusAEl.textContent = "✗ CRASHED";
    $("node-bankA").classList.add("crashed");
    soundFail();
    await sleep(ms(1100));

    setPhase(2, "active");
    coordDecision.textContent = "decisão: COMMIT";
    coordDecision.classList.add("commit");
    coordState.textContent = "Fase 2 · COMMIT";
    logStep(`▸ Fase 2 (decision): coordenador decide COMMIT (todos votaram YES)`);

    // Tries to send COMMIT to A — fails
    logStep(`Coordenador tenta enviar COMMIT a Banco A…`, "warn");
    hotPath("coord-bankA", "no");
    packetG.classList.add("no");
    packetLabel.textContent = "COMMIT";
    packetPayload.textContent = "(timeout)";
    packetG.setAttribute("transform", `translate(${POINTS.coord[0]},${POINTS.coord[1]})`);
    packetG.classList.remove("hidden");
    await sleep(ms(120));
    // Move halfway, then fade
    const [mx, my] = [(POINTS.coord[0]+POINTS.bankA[0])/2, (POINTS.coord[1]+POINTS.bankA[1])/2];
    packetG.setAttribute("transform", `translate(${mx},${my})`);
    await sleep(ms(700));
    packetG.classList.add("hidden");
    clearPath("coord-bankA");

    coordState.textContent = "BLOQUEADO · timeout";
    coordState.classList.add("blocked");
    $("node-coord").classList.add("blocked");
    logStep(`⚠ Timeout: Banco A não responde. Coordenador FICA BLOQUEADO.`, "warn");
    logStep(`Esta é a fraqueza clássica do 2PC: bloqueia se participante cai`, "warn");
    logStep(`Banco B continua com lock segurando — não pode commitar nem abortar sozinho`, "warn");
    soundFail();
    setPhase(2, "active");
    markPhaseDone(2, "abort");

    // Phase 3 não acontece neste cenário
    chainState.textContent = "nenhum registro — sistema bloqueado";
    chainBlock.textContent = "(precisaria intervenção operacional)";

    [btnCommit, btnAbort, btnFail].forEach((b) => b.disabled = false);
    running = false;
    return;
  }

  /* ===== PHASE 2: DECISION ===== */
  setPhase(2, "active");
  const decision = willCommit ? "COMMIT" : "ABORT";
  coordDecision.textContent = `decisão: ${decision}`;
  coordDecision.classList.add(decision.toLowerCase());
  coordState.textContent = `Fase 2 · ${decision}`;
  logStep(`▸ Fase 2 (decision): coordenador decide ${decision}`, decision.toLowerCase());
  await sleep(ms(1100));

  await Promise.all([
    fly("coord", "bankA", decision, `txId: tx-...`, willCommit ? "yes" : "no"),
    fly("coord", "bankB", decision, `txId: tx-...`, willCommit ? "yes" : "no"),
  ]);

  if (willCommit) {
    balAEl.textContent = String(100 - amount);
    balBEl.textContent = String(20 + amount);
    statusAEl.textContent = "✓ aplicado";
    statusBEl.textContent = "✓ aplicado";
    $("node-bankA").classList.add("commit");
    $("node-bankB").classList.add("commit");
    logStep(`Bancos atualizam saldos: A=${100 - amount}, B=${20 + amount}`, "commit");
    markPhaseDone(2);
  } else {
    statusAEl.textContent = "saldo intacto";
    statusBEl.textContent = "saldo intacto";
    $("node-bankA").classList.add("abort");
    $("node-bankB").classList.add("abort");
    logStep(`Bancos mantêm saldos inalterados (atomicidade preservada)`, "abort");
    markPhaseDone(2, "abort");
  }
  await sleep(ms(1000));

  /* ===== PHASE 3: ON-CHAIN AUDIT ===== */
  setPhase(3, "active");
  coordState.textContent = "Fase 3 · audit on-chain";
  logStep(`▸ Fase 3 (audit): gravando decisão no smart contract Sepolia`, "chain");

  await fly("coord", "chain", "recordDecision", `(${decision}, ${amount})`, "chain");
  $("node-chain").classList.add("chain-recorded");
  soundChain();

  // Fetch real receipt to show actual block info
  chainState.textContent = `${decision} registrado · amount=${amount}`;
  chainBlock.textContent = "buscando block info…";
  showChainLink(decision);

  const receipt = await getReceipt(decision);
  if (receipt) {
    chainBlock.textContent = `block #${receipt.blockNumber} · gas ${receipt.gasUsed}`;
    logStep(`Receipt real: block #${receipt.blockNumber}, gas usado ${receipt.gasUsed}`, "chain");
  } else {
    chainBlock.textContent = "(receipt indisponível no RPC)";
  }
  logStep(`✓ Decisão imutável on-chain — auditoria garantida`, "chain");
  markPhaseDone(3, "chain");

  deactivate("node-coord");
  coordState.textContent = "transação concluída";

  [btnCommit, btnAbort, btnFail].forEach((b) => b.disabled = false);
  running = false;
}

btnCommit.addEventListener("click", () => runScenario("COMMIT"));
btnAbort.addEventListener("click", () => runScenario("ABORT"));
btnFail.addEventListener("click", () => runScenario("FAIL"));
btnReset.addEventListener("click", () => { if (!running) resetUI(); });

resetUI();

/* ---------------- On-chain reader (section 2) ---------------- */
const onchainEl = $("onchain");

async function fetchRecord(txId) {
  onchainEl.innerHTML = `<p class="muted">Consultando ${txId} no contrato…</p>`;
  try {
    const [id, decision, timestamp, coordinator, amount] = await contract.records(txId);
    const dec = Number(decision);
    const decLabel = dec === 1 ? "COMMIT" : dec === 2 ? "ABORT" : "UNKNOWN";
    const decClass = dec === 1 ? "commit" : dec === 2 ? "abort" : "";
    const date = new Date(Number(timestamp) * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";

    onchainEl.innerHTML = `
      <table>
        <tr><td>transactionId</td><td class="mono">${id}</td></tr>
        <tr><td>decision</td><td class="${decClass}"><strong>${dec}</strong> · ${decLabel}</td></tr>
        <tr><td>timestamp</td><td>${Number(timestamp)} <span class="muted">(${date})</span></td></tr>
        <tr><td>coordinator</td><td class="mono">${coordinator}</td></tr>
        <tr><td>amount</td><td>${Number(amount)}</td></tr>
      </table>
      <p class="muted small" style="margin-top:12px">
        Buscado em tempo real via RPC público da Sepolia · contrato
        <code>${CONTRACT.slice(0,10)}…${CONTRACT.slice(-6)}</code>
      </p>
    `;
  } catch (err) {
    onchainEl.innerHTML = `<p style="color:var(--abort)">Erro ao consultar: ${err.message || err}</p>`;
  }
}

document.querySelectorAll("[data-tx]").forEach((btn) => {
  btn.addEventListener("click", () => fetchRecord(btn.dataset.tx));
});
