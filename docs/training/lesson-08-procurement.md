# Lição 8 — Compras, recebimento e contas de fornecedor

## Objetivo e conceitos

Transformar necessidade de reposição em solicitação, aprovação, pedido,
recebimento e conta, mantendo separação entre quem pede e quem aprova.

## Preparação

```powershell
pnpm training reset --scenario inventory-procurement
```

Contas: estoque/compras, gerente e financeiro. Use a mesma data operacional da
lição 7, mas lembre que o reset torna esta lição independente.

## Missão e passos orientados

1. Como estoque, abra Compras e crie uma reposição para Água mineral.
2. Compare quantidade pedida, saldo, mínimo, ideal e prioridade.
3. Gere a solicitação/pedido conforme a política e associe fornecedor sintético.
4. Troque para gerente e aprove; tente antes aprovar como solicitante para ver a
   proteção de segregação.
5. Como estoque, registre recebimento parcial e depois o saldo.
6. Como financeiro, confira nota, tolerâncias e vencimentos antes da liquidação.

Erro proposital: receber quantidade maior que a autorizada sem decisão prevista
na política. Resultado esperado: conflito explicado, sem inflar o estoque.

Verificação final: pedido recebido, posição incrementada e conta rastreável. No
banco mudam aprovações, recebimentos, documentos de estoque, fatura e parcelas;
os eventos preservam os atores distintos.

<details><summary>Solução</summary>

Corrija a quantidade para o saldo do pedido ou encaminhe a divergência ao papel
autorizado. O gerente aprova; estoque solicita e recebe; financeiro confere e
liquida.

</details>

Para repetir: `pnpm training reset --scenario inventory-procurement`.
