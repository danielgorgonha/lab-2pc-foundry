# Respostas — Trabalho Final (Sistemas Distribuídos)

## 1. Repositório do GitHub com o código fonte

https://github.com/danielgorgonha/lab-2pc-foundry

## 2. Endereço do Smart Contract (Sepolia)

```
0xA9b5F751E6711306c8A3B42c5926E9eE5fa9ff39
```

Etherscan: https://sepolia.etherscan.io/address/0xA9b5F751E6711306c8A3B42c5926E9eE5fa9ff39

## 3. Valor de iniciando a transação (formato `tx-...`)

- COMMIT: `tx-1779798234008`
- ABORT:  `tx-1779798249386`

## 4. Hash da transação

- COMMIT: `0x8867e2a13e6446f294193505f1e389c6692dcac26ecfd4cc7429ff3bf5302bb9`
- ABORT:  `0x74bc40f0255dd26b6464c49ee05c2444ef52799cd9dfd0baa281e42754b7648c`

---

## Verificação on-chain (`cast call records`)

```sh
cast call $CONTRACT_ADDRESS \
  "records(string)(string,uint8,uint256,address,uint256)" \
  "tx-1779798234008" \
  --rpc-url $SEPOLIA_RPC_URL
```

Retorno (COMMIT):

```
"tx-1779798234008"
1
1779798240
0x6Dd7513A31E30A43B8441fb8538a8a41CFffa921
50
```

Retorno (ABORT, `tx-1779798249386`):

```
"tx-1779798249386"
2
1779798252
0x6Dd7513A31E30A43B8441fb8538a8a41CFffa921
150
```

Campos: `transactionId`, `decision (1=COMMIT, 2=ABORT)`, `timestamp`, `coordinator`, `amount`.
