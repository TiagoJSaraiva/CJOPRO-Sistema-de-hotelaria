# Lição 5 — Equipamento, contrato e garantia

## Objetivo e conceitos

Entender área versus equipamento e encerrar um alerta de garantia com decisão
auditável. O alerta não significa defeito e não cria ocorrência automaticamente.

## Preparação

```powershell
pnpm training reset --scenario warranty
pnpm training verify --scenario warranty
```

Use supervisor de manutenção; depois confira como gerente. A garantia vence em
sete dias da data operacional.

## Estado inicial e missão

O ar-condicionado da recepção possui patrimônio, fabricante, série, contrato e
garantia vigente sem decisão. Escolha uma resolução coerente.

## Passos orientados

1. Abra o alerta e confirme que o link destaca o equipamento correto.
2. Em Configurações de manutenção, diferencie o cartão da área Recepção do
   cartão do equipamento.
3. Use **Tratar garantia** e revise o histórico.
4. Registre **Ciência do vencimento** com justificativa; ou escolha renovação e
   informe uma data posterior se esse for o exercício do professor.
5. Atualize a página e confirme que a vigência tratada não gera nova pendência.

Erros propositais: renovar com data igual/anterior; acionar garantia sem
ocorrência ativa do mesmo equipamento; indicar substituto de outro hotel. Todos
devem ser rejeitados.

No banco é inserida uma decisão imutável. Renovação também atualiza a vigência;
substituição e retirada aposentam o ativo. Correções criam outra decisão que
referencia a anterior.

<details><summary>Solução</summary>

Para apenas registrar que a equipe avaliou o aviso, use **Ciência do
vencimento**. Para `claim_submitted`, primeiro abra uma ocorrência vinculada ao
equipamento; o sistema não inventa esse fato.

</details>

Para repetir: `pnpm training reset --scenario warranty` e
`pnpm training verify --scenario warranty`.
