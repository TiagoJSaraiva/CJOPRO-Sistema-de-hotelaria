# 0007: Cancelamento e no-show encerram tudo

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** decisão do usuário
- **Áreas:** reservas, financeiro

## Decisão

Um fluxo único no painel pede o motivo e encerra estadia, acomodação e reserva, liberando o quarto.
O cancelamento cobra a multa do plano só depois de `cancellation_cutoff_hours`. O no-show sempre cobra
a multa do plano. O adiantamento acima da multa vira crédito a reembolsar, registrado pela recepção.
As regras detalhadas são RES-01 a RES-08.

## Motivo

O painel só mudava a estadia: a reserva continuava confirmada, a acomodação continuava alocada, o
saldo era mantido, não havia multa, e o prazo limite do plano era ignorado (QA-080 e QA-081).

## Alternativas recusadas

- Manter a mudança só na estadia: deixava o quarto preso e o saldo sem destino.

## Consequências

Com outra estadia ativa na reserva, a garantia é transferida inteira no check-in, e a multa aparece
como saldo a pagar depois. Conta com pagamento ou consumo bloqueia o encerramento até o acerto.

## Prova

- [Encerramento da reserva](../../supabase/tests/database/reservation_closure.test.sql)
- [Jornada de cancelamento e no-show](../../apps/pms/__tests__/journeys/flow-cancel-no-show.spec.ts)
