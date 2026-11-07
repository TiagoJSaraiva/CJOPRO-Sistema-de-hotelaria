# 0014: Fechamento lista lançamentos tardios

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** caixa

## Decisão

A tela de fechamento mostra uma lista simples dos lançamentos tardios, com a data e o fechamento originais.

## Motivo

Quem aprova o fechamento precisa ver o que entrou de um dia já fechado, e hoje isso fica só no banco (QA-091).

## Alternativas recusadas

- Deixar para depois da depuração: os valores estão corretos, mas falta visibilidade a quem aprova.

## Consequências

A [decisão 0010](0010-lancamento-tardio.md) passa a ser visível na tela. A lista fica fora da projeção que
gera o snapshot do fechamento, então aprovações antigas continuam batendo.

## Prova

- [Conferência do dia](../../supabase/tests/database/finance_rules.test.sql)
- [Tela de caixa](../../apps/pms/__tests__/unit/dashboard/CashPage.test.tsx)
