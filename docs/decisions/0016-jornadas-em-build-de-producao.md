# 0016: Varredura sobre o build de produção do PMS

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** decisão do usuário, condicionada a medir ganho; a separação entre varredura e jornadas veio da medição
- **Áreas:** testes

## Decisão

A varredura de páginas sobe o PMS com `next build` e `next start`. As demais jornadas continuam em
`next dev`. `pnpm test:journeys` executa as duas fases em sequência.

## Motivo

Em `next dev`, a varredura compilava cada rota na primeira visita e reiniciava por memória, o que levava
1h06 e causava tempos limite. Em produção, ela leva cerca de 3,5 min e encontra o mesmo, confirmado por um
controle negativo: um `undefined` inserido numa página reprovou a rodada.

## Alternativas recusadas

- Tudo em produção: 13 jornadas falharam, e o ganho era pequeno, porque o tempo delas é dominado pelo reset.
  Parte das falhas era do teste: o Playwright não envia cookie `secure` em `page.request` por `http`. A outra
  parte revelou o QA-095.
- Tudo em `next dev`: rodadas mais de uma hora mais longas.

## Consequências

As jornadas seguem vendo avisos de hidratação. A varredura já ignorava avisos de console, então não perde
nada com a troca. Só a varredura exercita o build de produção, e ela não executa ações, por isso defeitos
como o QA-095 não aparecem em nenhuma suíte.

## Prova

- [Fases do executor](../../apps/backend-service/__tests__/unit/journeysScript.test.ts)
- [Varredura](../../apps/pms/__tests__/journeys/sweep-pages.spec.ts)
