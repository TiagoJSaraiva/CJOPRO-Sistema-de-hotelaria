# 0016: Jornadas sobre o build de produção do PMS

- **Status:** a implementar
- **Data:** 2026-11-07
- **Origem:** decisão do usuário, condicionada a medir ganho
- **Áreas:** testes

## Decisão

As jornadas sobem o PMS com `next build` e `next start`. O site público, o backend e o booking engine
continuam como estão.

## Motivo

`next dev` compila cada rota na primeira visita e reinicia por memória no meio da varredura, o que causava
tempos limite. Medição inicial: a varredura do administrador caiu de 14 min para 18,8 s, com as mesmas páginas.

## Alternativas recusadas

- Manter `next dev`: rodadas bem mais longas.

## Consequências

Avisos de hidratação só aparecem em `next dev`, então ficam cobertos só pelos testes E2E, que seguem em dev.

## Prova

Pendente: suíte completa de jornadas em produção.
