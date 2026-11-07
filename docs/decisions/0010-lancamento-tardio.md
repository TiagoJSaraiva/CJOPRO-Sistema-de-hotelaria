# 0010: Lançamento tardio não entra em dia fechado

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** regra FIN-25 aprovada pelo usuário; **a confirmar:** o detalhe de ir à próxima data aberta e de bloquear alterações foi definido pelo agente ao corrigir o QA-089
- **Áreas:** financeiro, caixa

## Decisão

Lançamento com data de um dia fechado fica na próxima data aberta, a partir da atual, e guarda a data e
o fechamento originais. O que já está no dia fechado não muda nem é apagado: a correção é um novo lançamento.

## Motivo

Lançamentos entravam no dia fechado, e os totais deixavam de bater com o snapshot aprovado (QA-089, S2).

## Alternativas recusadas

- Aceitar o lançamento na data original: desfaz o fechamento aprovado.
- Recusar o lançamento: o dinheiro existe, e o registro precisa entrar.

## Consequências

A data e o fechamento originais só ficam visíveis na tela depois da [decisão 0014](0014-fechamento-lista-lancamentos-tardios.md).

## Prova

- [Regras do domínio](../../supabase/tests/database/finance_rules.test.sql)
