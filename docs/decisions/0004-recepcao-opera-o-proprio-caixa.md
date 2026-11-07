# 0004: A recepção opera o próprio caixa

- **Status:** aceita
- **Data:** 2026-11-06
- **Origem:** decisão do usuário (opção A)
- **Áreas:** caixa, recepção

## Decisão

A recepção recebe dinheiro do hóspede na própria sessão de caixa. Ela tem permissão para abrir
sessão, e dinheiro sem sessão aberta é recusado em todos os caminhos.

## Motivo

É o que acontece na maioria dos hotéis, e a tela de chegada já funcionava assim. A recepção recebia
em dinheiro sem sessão e não podia abrir uma, o que era um defeito S1 (QA-054).

## Alternativas recusadas

- Papel Caixa separado recebendo os pagamentos: o hóspede seria atendido em dois lugares, e só faz
  sentido em hotel com tesouraria própria.

## Consequências

Hotéis já existentes precisam receber as permissões novas em Papéis.

## Prova

- [Dinheiro exige sessão](../../supabase/tests/database/cash_requires_session.test.sql)
- [Jornada da lição 6](../../apps/pms/__tests__/journeys/lesson-06-consumption-account.spec.ts)
