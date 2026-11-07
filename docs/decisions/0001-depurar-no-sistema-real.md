# 0001: Congelar features e depurar no sistema real

- **Status:** aceita
- **Data:** 2026-11-04
- **Origem:** decisão do usuário
- **Áreas:** processo, testes

## Decisão

Nenhuma feature nova até o fim do [plano de depuração](../plans/2026-11-debug-real-stack.md),
salvo quando a correção de um fluxo exigir. As lições viram testes automatizados contra o sistema
real. Os defeitos ficam em `docs/qa/bug-ledger.md`. As jornadas rodam localmente durante a
depuração e só depois entram num job separado do CI.

## Motivo

A depuração manual pelas lições estava lenta e não ficava protegida depois. Os testes E2E usam
um backend simulado, então nenhum teste percorria navegador, PMS, backend e banco juntos.

## Alternativas recusadas

- Continuar só com o teste manual das lições: lento e sem proteção contra regressão.
- Registrar os defeitos em `notes/` ou em issues: `notes/` é histórico, e o registro versionado
  acompanha o diff da correção.

## Consequências

Um defeito só fecha com um teste automatizado que falhava antes da correção.

## Prova

- [Registro de bugs](../qa/bug-ledger.md)
- [Jornadas](../../apps/pms/__tests__/journeys/support.ts)
