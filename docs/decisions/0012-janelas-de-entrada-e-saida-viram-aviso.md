# 0012: Janelas de entrada e saída viram aviso

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário
- **Áreas:** recepção, reservas

## Decisão

A recepção faz a saída a qualquer momento depois do check-in, com motivo se estiver fora da janela,
sem mudar o valor das diárias. O check-in continua só no dia previsto, também com motivo fora da janela.

## Motivo

Hóspede que sai antes da data prevista ou depois da janela não tinha caminho no sistema (QA-087, S2).

## Alternativas recusadas

- Exigir permissão de gerente fora da janela: a recepção ficaria parada sem gerente no turno.
- Recalcular as diárias na saída antecipada: exige definir multa e devolução, e é mais amplo.

## Consequências

Não há recálculo de diárias na saída antecipada: a hospedagem entra inteira na conta quando a estadia é
criada. O motivo fica em `stays.checkin_window_reason` e `stays.checkout_window_reason`. Na saída
antecipada, o quarto continua reservado no calendário até a data prevista.

## Prova

- [Regra no banco](../../supabase/tests/database/reservations_arrival.test.sql)
- [Painel e rotas](../../apps/backend-service/__tests__/unit/stayOperationsRoutes.test.ts)
- [Jornada de saída](../../apps/pms/__tests__/journeys/flow-checkout-refund.spec.ts)
