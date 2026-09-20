# Lição 6 — Pedidos, pagadores e conta da estadia

## Objetivo e conceitos

Registrar e classificar consumos, escolher quem paga e compreender a conta da
estadia sem misturar consumo imediato, cortesia e cobrança posterior.

## Preparação

```powershell
pnpm training reset --scenario consumption-account
```

Use recepção para lançar e financeiro para conferir. A hospedagem
`LOCAL-AUR-002` está ativa e há um consumo legado aguardando classificação.

## Missão e passos orientados

1. Abra Vendas e consumo e localize a hospedagem ativa.
2. Revise ponto, oferta, quantidade, preço e modalidade de cobrança.
3. Classifique o consumo legado na conta adequada.
4. Adicione um consumo de água e escolha a estadia como pagadora.
5. Abra a conta da estadia e confira débitos, créditos, saldo e pagadores.
6. Como financeiro, confirme que o total da conta explica o saldo mostrado.

Erro proposital: lançar produto físico por uma oferta sem posição ativa ou usar
uma estadia de outro hotel. A operação deve falhar sem movimento parcial.

Resultado esperado: pedidos postados e folio reconciliado. No banco mudam
pedido, itens, alocação do pagador, lançamentos do folio e, para produto físico,
movimento imutável de estoque.

<details><summary>Solução</summary>

Use o ponto Recepção, a oferta Água mineral e a hospedagem `LOCAL-AUR-002`. O
histórico legado só deve ser reclassificado com a origem e o pagador conhecidos.

</details>

Para repetir: `pnpm training reset --scenario consumption-account`.
