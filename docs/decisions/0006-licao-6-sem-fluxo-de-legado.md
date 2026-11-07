# 0006: Corrigir a lição 6, sem criar fluxo de legado

- **Status:** aceita
- **Data:** 2026-11-05
- **Origem:** decisão do usuário
- **Áreas:** consumo, curso

## Decisão

O passo que mandava classificar o consumo legado sai da lição 6 (QA-036). O consumo legado continua
sendo migração histórica, sem efeito financeiro.

## Motivo

O fluxo não existe, e `docs/architecture.md` já trata o legado como histórico.

## Alternativas recusadas

- Criar o fluxo: seria feature nova durante o congelamento.

## Consequências

Nenhuma tela classifica consumo legado.

## Prova

- [Lição 6](../training/lesson-06-consumption-account.md)
- [Jornada da lição 6](../../apps/pms/__tests__/journeys/lesson-06-consumption-account.spec.ts)
