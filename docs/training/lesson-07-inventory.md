# Lição 7 — Posições, lotes, frigobar e reposição

## Objetivo e conceitos

Operar estoque entendendo que uma posição é `produto + local`. Quantidade, lote,
contagem, transferência e origem de oferta sempre dependem dessa combinação.

## Preparação

```powershell
pnpm training reset --scenario inventory-procurement
pnpm training verify --scenario inventory-procurement
```

Use estoque/compras e, para o frigobar, governança. A posição Água mineral +
Estoque central começa ativa no Aurora.

## Missão e passos orientados

1. Abra Estoque e identifique produto, local, posição, saldo mínimo e ideal.
2. Confira o lote sintético e sua validade posterior à data operacional; depois
   registre um movimento na posição central.
3. Inicie uma contagem, informe o físico e conclua a diferença justificada.
4. Configure ou confira a composição do frigobar.
5. Como governança, execute uma reposição pendente e confirme sua origem.
6. Volte ao estoque e confira movimentos e saldo por lote.

Erro proposital: tente criar movimento de um produto sem posição. O seletor deve
mostrar **Nenhuma posição configurada**, desabilitar o envio e oferecer **Ativar
produto em local** apenas a quem possui permissão.

Resultado esperado: trilha imutável de entrada/contagem/reposição e saldos
coerentes. No banco mudam documentos, movimentos, lote, balanço e sessão de
contagem; o vínculo produto-local permanece explícito.

<details><summary>Solução</summary>

Ative primeiro o produto no Estoque central. Quem não possui a permissão deve
procurar o responsável de estoque; uma opção vazia não é um valor selecionável.

</details>

Para repetir: `pnpm training reset --scenario inventory-procurement` e
`pnpm training verify --scenario inventory-procurement`.
