require("dotenv").config();

const net = require("net");
const { ethers } = require("ethers");

const AMOUNT = Number(process.env.AMOUNT || 50);

const participants = [
  { name: "Banco A", host: "127.0.0.1", port: 5001 },
  { name: "Banco B", host: "127.0.0.1", port: 5002 },
];

const abi = [
  "function recordDecision(string transactionId, uint8 decision, uint256 amount) public",
  "function getDecision(string transactionId) public view returns (uint8)",
  "function records(string) public view returns (string, uint8, uint256, address, uint256)",
];

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

function sendMessage(participant, message) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(participant.port, participant.host, () => {
      client.write(JSON.stringify(message));
    });
    client.on("data", (data) => {
      resolve(JSON.parse(data.toString()));
      client.destroy();
    });
    client.on("error", reject);
  });
}

async function run2PC() {
  const transactionId = `tx-${Date.now()}`;
  const amount = AMOUNT;

  console.log(`\nIniciando transacao ${transactionId}`);
  console.log(`Transferencia: Banco A -> Banco B | Valor: ${amount}`);

  const votes = [];
  for (const p of participants) {
    const response = await sendMessage(p, { type: "PREPARE", transactionId, amount });
    console.log(`[Coordenador] Voto de ${p.name}: ${response.vote}`);
    votes.push(response.vote);
  }

  const decision = votes.every((v) => v === "YES") ? "COMMIT" : "ABORT";
  console.log(`[Coordenador] Decisao final: ${decision}`);

  for (const p of participants) {
    await sendMessage(p, { type: decision, transactionId, amount });
  }

  const blockchainDecision = decision === "COMMIT" ? 1 : 2;
  console.log("[Coordenador] Registrando decisao na Sepolia...");

  const tx = await contract.recordDecision(transactionId, blockchainDecision, amount);
  await tx.wait();

  console.log("[Coordenador] Decisao registrada na blockchain.");
  console.log("transactionId:", transactionId);
  console.log("Hash da transacao:", tx.hash);
}

run2PC().catch(console.error);
