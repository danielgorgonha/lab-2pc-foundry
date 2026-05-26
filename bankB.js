const net = require("net");

let balance = 20;

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === "PREPARE") {
      console.log("[Banco B] PREPARE recebido");
      socket.write(JSON.stringify({ vote: "YES" }));
    }

    if (msg.type === "COMMIT") {
      balance += msg.amount;
      console.log(`[Banco B] COMMIT. Novo saldo: ${balance}`);
      socket.write(JSON.stringify({ status: "OK" }));
    }

    if (msg.type === "ABORT") {
      console.log("[Banco B] ABORT. Nenhuma alteracao feita.");
      socket.write(JSON.stringify({ status: "OK" }));
    }
  });
});

server.listen(5002, () => {
  console.log("[Banco B] Escutando na porta 5002");
});
