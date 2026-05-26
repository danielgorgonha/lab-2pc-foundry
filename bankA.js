const net = require("net");

let balance = 100;

const server = net.createServer((socket) => {
  socket.on("data", (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.type === "PREPARE") {
      console.log("[Banco A] PREPARE recebido");
      if (balance >= msg.amount) {
        socket.write(JSON.stringify({ vote: "YES" }));
      } else {
        socket.write(JSON.stringify({ vote: "NO" }));
      }
    }

    if (msg.type === "COMMIT") {
      balance -= msg.amount;
      console.log(`[Banco A] COMMIT. Novo saldo: ${balance}`);
      socket.write(JSON.stringify({ status: "OK" }));
    }

    if (msg.type === "ABORT") {
      console.log("[Banco A] ABORT. Nenhuma alteracao feita.");
      socket.write(JSON.stringify({ status: "OK" }));
    }
  });
});

server.listen(5001, () => {
  console.log("[Banco A] Escutando na porta 5001");
});
