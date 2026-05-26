# lab-2pc-foundry

> 🌐 **[Visualização interativa do fluxo →](https://danielgorgonha.github.io/lab-2pc-foundry/)**
> Animação dos cenários COMMIT/ABORT + leitura on-chain em tempo real.

Lab final da disciplina de Sistemas Distribuídos: protocolo **Two-Phase Commit (2PC)** entre dois bancos em Node.js, com registro imutável da decisão final em um **smart contract na Sepolia**.

Esta versão estende o contrato original da aula adicionando o campo `amount` ao struct `TransactionRecord`, de forma que `cast call records(...)` retorne os 5 campos: `transactionId`, `decision`, `timestamp`, `coordinator` e `amount`.

## Arquitetura

```
Cliente
   |
   v
Coordenador 2PC ----+----> Banco A (porta 5001, saldo 100)
                    +----> Banco B (porta 5002, saldo  20)
   |
   v
Smart contract CommitLog na Sepolia
(transactionId, decision, timestamp, coordinator, amount)
```

- O **2PC** decide se a transação distribuída efetiva (COMMIT) ou aborta (ABORT).
- A **blockchain** funciona como trilha de auditoria imutável da decisão final.

## Estrutura

```
src/CommitLog.sol               contrato com struct estendida
script/DeployCommitLog.s.sol    script de deploy
test/CommitLog.t.sol            testes Foundry (5/5 passing)
bankA.js / bankB.js             participantes 2PC (TCP)
coordinator.js                  coordenador 2PC + ethers.js
docs/EXECUCAO.md                passo-a-passo da execução
docs/RESPOSTAS-FORM.md          respostas do formulário
docs/evidencias/                logs de cada etapa
```

## Pré-requisitos

- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`)
- Node.js 18+
- Wallet Sepolia com saldo (faucet: https://sepolia-faucet.pk910.de/)
- RPC Sepolia (Infura, Alchemy, ou público)

## Setup

```sh
git clone https://github.com/danielgorgonha/lab-2pc-foundry
cd lab-2pc-foundry
forge install foundry-rs/forge-std --no-commit
npm install
cp .env.example .env   # preencher SEPOLIA_RPC_URL e PRIVATE_KEY
forge build
forge test -vv
```

## Deploy

```sh
source .env
forge script script/DeployCommitLog.s.sol:DeployCommitLog \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Atualize `CONTRACT_ADDRESS` no `.env` com o endereço retornado.

## Executar o lab

3 terminais:

```sh
# Terminal 1
node bankA.js

# Terminal 2
node bankB.js

# Terminal 3 — caso COMMIT (Banco A tem saldo 100)
AMOUNT=50 node coordinator.js

# Terminal 3 — caso ABORT (saldo insuficiente)
AMOUNT=150 node coordinator.js
```

## Verificar on-chain

```sh
cast call $CONTRACT_ADDRESS \
  "records(string)(string,uint8,uint256,address,uint256)" \
  "tx-XXXXXXXXXXXXX" \
  --rpc-url $SEPOLIA_RPC_URL
```

Decisões: `1 = COMMIT`, `2 = ABORT`.

## Execução desta entrega

| Item | Valor |
|---|---|
| Contrato | `0xA9b5F751E6711306c8A3B42c5926E9eE5fa9ff39` |
| Coordenador | `0x6Dd7513A31E30A43B8441fb8538a8a41CFffa921` |
| tx COMMIT | `tx-1779798234008` — hash `0x8867e2a13e6446f294193505f1e389c6692dcac26ecfd4cc7429ff3bf5302bb9` |
| tx ABORT | `tx-1779798249386` — hash `0x74bc40f0255dd26b6464c49ee05c2444ef52799cd9dfd0baa281e42754b7648c` |

Detalhes completos em [`docs/EXECUCAO.md`](docs/EXECUCAO.md) e [`docs/RESPOSTAS-FORM.md`](docs/RESPOSTAS-FORM.md).
