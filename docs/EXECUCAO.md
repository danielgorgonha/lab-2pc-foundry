# Execução do Lab

Passo-a-passo executado, com as evidências em `docs/evidencias/`.

## 1. Build + testes locais

```sh
forge build
forge test -vv
```

5/5 testes passando (`docs/evidencias/00-forge-test.txt`).

## 2. Deploy na Sepolia

```sh
source .env
forge script script/DeployCommitLog.s.sol:DeployCommitLog \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

Endereço resultante: `0xA9b5F751E6711306c8A3B42c5926E9eE5fa9ff39`
(log em `docs/evidencias/01-deploy-contrato.txt`).

## 3. Subir os bancos

Terminais 1 e 2:

```sh
node bankA.js   # porta 5001, saldo inicial 100
node bankB.js   # porta 5002, saldo inicial 20
```

Logs: `docs/evidencias/02-bankA.txt`, `03-bankB.txt`.

## 4. Rodar coordenador — caso COMMIT

```sh
AMOUNT=50 node coordinator.js
```

- Banco A vota YES (saldo 100 ≥ 50), Banco B vota YES → decisão **COMMIT**.
- `tx-1779798234008`
- hash: `0x8867e2a13e6446f294193505f1e389c6692dcac26ecfd4cc7429ff3bf5302bb9`
- Log: `docs/evidencias/04-coordinator-commit.txt`.

## 5. Rodar coordenador — caso ABORT

```sh
AMOUNT=150 node coordinator.js
```

- Banco A vota NO (saldo 50 < 150), Banco B vota YES → decisão **ABORT**.
- `tx-1779798249386`
- hash: `0x74bc40f0255dd26b6464c49ee05c2444ef52799cd9dfd0baa281e42754b7648c`
- Log: `docs/evidencias/05-coordinator-abort.txt`.

## 6. Verificar registros on-chain

```sh
cast call $CONTRACT_ADDRESS \
  "records(string)(string,uint8,uint256,address,uint256)" \
  "tx-1779798234008" \
  --rpc-url $SEPOLIA_RPC_URL
```

Retorna `transactionId`, `decision`, `timestamp`, `coordinator`, `amount`.
Saída completa em `docs/evidencias/06-cast-records.txt`.
