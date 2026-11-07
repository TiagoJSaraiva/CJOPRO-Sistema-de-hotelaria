# 0011: Cobrança de manutenção sai com ciência

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** regra FIN-07 aprovada pelo usuário
- **Áreas:** saída, manutenção

## Decisão

Cobrança de manutenção em aberto não trava a saída, mas exige ciência registrada (FIN-07, SAI-08). O
saldo mostrado ao hóspede continua igual; só o bloqueio deixa de contar o que a ciência cobre.

## Motivo

A tela prometia saída com ciência, mas a conferência contava a cobrança como saldo pessoal e bloqueava
com ou sem ciência (QA-090).

## Alternativas recusadas

- Bloquear a saída até quitar: contraria a regra aprovada e prende o hóspede por uma cobrança em análise.

## Consequências

A cobrança continua registrada depois da saída.

## Prova

- [Regras do domínio](../../supabase/tests/database/finance_rules.test.sql)
- [Jornada de saída](../../apps/pms/__tests__/journeys/flow-checkout-refund.spec.ts)
