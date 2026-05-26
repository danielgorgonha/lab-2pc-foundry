import { JsonRpcProvider, Contract } from "https://esm.sh/ethers@6.13.2";

const CONTRACT = "0xA9b5F751E6711306c8A3B42c5926E9eE5fa9ff39";
const RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const ABI = [
  "function records(string) view returns (string, uint8, uint256, address, uint256)"
];

const provider = new JsonRpcProvider(RPC);
const contract = new Contract(CONTRACT, ABI, provider);

/* ---------------- Animation ---------------- */

const POINTS = {
  client: [400, 45],
  coord:  [400, 160],
  bankA:  [170, 300],
  bankB:  [630, 300],
  chain:  [400, 470],
};

const packet = document.getElementById("packet");
const packetLabel = document.getElementById("packet-label");
const logList = document.getElementById("log-list");
const coordDecision = document.getElementById("coord-decision");
const balAEl = document.getElementById("balA");
const balBEl = document.getElementById("balB");
const voteAEl = document.getElementById("voteA");
const voteBEl = document.getElementById("voteB");
const chainState = document.getElementById("chain-state");

let running = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resetUI() {
  packet.classList.add("hidden");
  packetLabel.classList.add("hidden");
  packet.setAttribute("cx", -50);
  packet.setAttribute("cy", -50);
  packet.classList.remove("yes", "no", "chain");
  document.querySelectorAll("#diagram .node").forEach((n) =>
    n.classList.remove("active", "commit", "abort", "chain-recorded")
  );
  coordDecision.textContent = "";
  coordDecision.classList.remove("commit", "abort");
  balAEl.textContent = "100";
  balBEl.textContent = "20";
  voteAEl.textContent = "";
  voteBEl.textContent = "";
  chainState.textContent = "aguardando registro…";
  logList.innerHTML = "";
}

function logStep(text, cls = "") {
  const li = document.createElement("li");
  li.textContent = text;
  if (cls) li.classList.add(cls);
  logList.appendChild(li);
  requestAnimationFrame(() => li.classList.add("shown"));
  logList.parentElement.scrollTop = logList.parentElement.scrollHeight;
}

function activate(nodeId, cls = "active") {
  document.getElementById(nodeId).classList.add(cls);
}
function deactivate(nodeId) {
  document.getElementById(nodeId).classList.remove("active");
}

async function fly(from, to, label, variant = "") {
  const [fx, fy] = POINTS[from];
  const [tx, ty] = POINTS[to];
  packet.classList.remove("yes", "no", "chain");
  if (variant) packet.classList.add(variant);
  packet.setAttribute("cx", fx);
  packet.setAttribute("cy", fy);
  packetLabel.setAttribute("x", fx);
  packetLabel.setAttribute("y", fy - 14);
  packetLabel.textContent = label;
  packet.classList.remove("hidden");
  packetLabel.classList.remove("hidden");
  await sleep(60);
  packet.setAttribute("cx", tx);
  packet.setAttribute("cy", ty);
  packetLabel.setAttribute("x", tx);
  packetLabel.setAttribute("y", ty - 14);
  await sleep(620);
  packet.classList.add("hidden");
  packetLabel.classList.add("hidden");
  await sleep(120);
}

async function runScenario(amount) {
  if (running) return;
  running = true;
  resetUI();

  const willCommit = amount <= 100;

  logStep(`Cliente solicita transferência de ${amount} (A → B)`);
  activate("node-client");
  await fly("client", "coord", `tx ${amount}`);
  deactivate("node-client");
  activate("node-coord");
  await sleep(300);

  logStep(`Coordenador envia PREPARE aos dois bancos`);
  await Promise.all([
    fly("coord", "bankA", "PREPARE"),
    fly("coord", "bankB", "PREPARE"),
  ]);
  activate("node-bankA");
  activate("node-bankB");
  await sleep(400);

  const voteA = willCommit ? "YES" : "NO";
  const voteB = "YES";
  voteAEl.textContent = `voto: ${voteA}`;
  voteBEl.textContent = `voto: ${voteB}`;
  logStep(`Banco A vota ${voteA} ${willCommit ? "(saldo ≥ valor)" : "(saldo insuficiente)"}`,
    voteA === "YES" ? "commit" : "abort");
  logStep(`Banco B vota ${voteB}`, "commit");

  await Promise.all([
    fly("bankA", "coord", voteA, voteA === "YES" ? "yes" : "no"),
    fly("bankB", "coord", voteB, "yes"),
  ]);
  deactivate("node-bankA");
  deactivate("node-bankB");

  const decision = willCommit ? "COMMIT" : "ABORT";
  coordDecision.textContent = `decisão: ${decision}`;
  coordDecision.classList.add(decision.toLowerCase());
  logStep(`Coordenador decide: ${decision}`, decision.toLowerCase());
  await sleep(600);

  logStep(`Coordenador envia ${decision} aos dois bancos`);
  await Promise.all([
    fly("coord", "bankA", decision, decision === "COMMIT" ? "yes" : "no"),
    fly("coord", "bankB", decision, decision === "COMMIT" ? "yes" : "no"),
  ]);

  if (willCommit) {
    balAEl.textContent = String(100 - amount);
    balBEl.textContent = String(20 + amount);
    document.getElementById("node-bankA").classList.add("commit");
    document.getElementById("node-bankB").classList.add("commit");
    logStep(`Bancos atualizam saldos: A=${100 - amount}, B=${20 + amount}`, "commit");
  } else {
    document.getElementById("node-bankA").classList.add("abort");
    document.getElementById("node-bankB").classList.add("abort");
    logStep(`Bancos mantêm saldos inalterados`, "abort");
  }
  await sleep(500);

  logStep(`Coordenador grava decisão no smart contract (Sepolia)`, "chain");
  await fly("coord", "chain", "recordDecision", "chain");
  document.getElementById("node-chain").classList.add("chain-recorded");
  chainState.textContent = `${decision} registrado · amount=${amount}`;
  logStep(`✓ Decisão imutável on-chain — auditoria garantida`, "chain");

  deactivate("node-coord");
  running = false;
}

document.getElementById("btn-commit").addEventListener("click", () => runScenario(50));
document.getElementById("btn-abort").addEventListener("click", () => runScenario(150));
document.getElementById("btn-reset").addEventListener("click", () => { if (!running) resetUI(); });

resetUI();

/* ---------------- On-chain reader ---------------- */

const onchainEl = document.getElementById("onchain");

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
