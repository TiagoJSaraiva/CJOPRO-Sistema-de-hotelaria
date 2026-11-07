# 0008: Tela mínima de reservas sem quarto

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** decisão do usuário
- **Áreas:** reservas, canais

## Decisão

Reservas de canal e do site aparecem numa fila própria. A recepção escolhe ou cadastra o hóspede e
aloca o quarto (RES-09 a RES-12).

## Motivo

Essas reservas nascem sem cliente e nenhuma tela vinculava cliente ou alocava quarto, então nunca
chegavam ao check-in (QA-079, S2).

## Alternativas recusadas

- Criar o cliente automaticamente: o cadastro exige documento e data de nascimento, que o canal não envia.

## Consequências

O caminho completo da reserva retida do site não tem jornada, e a RES-12 segue parcial.

## Prova

- [Reservas sem quarto](../../supabase/tests/database/unassigned_reservations.test.sql)
- [Jornada do canal](../../apps/pms/__tests__/journeys/flow-channel-arrival.spec.ts)
