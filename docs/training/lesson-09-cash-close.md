# Lição 9 — Sessão de caixa, contagem cega e fechamento diário

## Objetivo e conceitos

Percorrer a sequência `cadastrar caixa → abrir sessão → registrar movimentos →
contar dinheiro → fechar sessão → fechar o dia` e entender por que fechamento
diário não é soma fiscal nem depósito bancário.

## Preparação

```powershell
pnpm training reset --scenario cash-close
```

Contas: caixa, financeiro e gerente. O Aurora possui `Caixa da recepção`
(`REC-01`, BRL, tolerância R$ 5) e um caixa de ponto de consumo.

## Missão e passos orientados

1. Como caixa, abra uma sessão no `REC-01` com fundo de R$ 100.
2. Registre uma entrada e uma saída justificadas e confira movimentos por espécie.
3. Inicie a contagem. Confirme que o valor esperado não veio na resposta nem na
   interface — não está apenas escondido por CSS.
4. Informe o dinheiro contado. Depois disso, compare esperado, contado e diferença.
5. Se a diferença exceder R$ 5, troque para financeiro e aprove ou peça recontagem.
6. Feche a sessão. Como financeiro, prepare o fechamento da data no link da
   pendência. Como gerente, aprove.
7. Avance um dia sem registrar movimentos, reconcilie e feche o dia com a
   mensagem **Dia sem movimentação**.

Erros propositais: preparar com sessão aberta; aprovar com o mesmo usuário que
preparou; aprovar depois de a projeção mudar. Todos devem exigir correção ou nova
preparação.

No banco, movimentos e contagens são históricos; o fechamento guarda projeção,
impressão digital, preparador e aprovador. A obrigação começa no primeiro caixa
ativo e inclui todas as datas faltantes posteriores.

<details><summary>Solução</summary>

Feche todas as sessões e vincule todo dinheiro a uma sessão. Caixa conta,
financeiro trata diferença e prepara, gerente aprova. Um dia zerado ainda é uma
afirmação operacional auditável.

</details>

Para repetir: `pnpm training reset --scenario cash-close`.
