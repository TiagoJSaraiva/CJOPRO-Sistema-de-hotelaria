# 0018: Restauração rápida do banco nas jornadas

- **Status:** aceita
- **Data:** 2026-11-07
- **Origem:** plano aprovado pelo usuário, adotada porque o reset passava de 20 s
- **Áreas:** testes, banco

## Decisão

As jornadas preparam o cenário com `pnpm training reset --fast`. O primeiro reset da rodada é real e
guarda os dados de `public`, `auth` e `storage` no container; os seguintes restauram esses dados. A base
deixa de valer quando migrations ou seed mudam, quando o dia muda (o seed usa `current_date`, QA-100) ou
depois de qualquer reset real. A última das três
rodadas do aceite roda com `JOURNEY_REAL_RESET=true`, que usa só o reset real.

## Motivo

Cada reset real levava cerca de 60 s, e uma rodada fazia 33. A suíte completa caiu de 2h para 29 min,
com as mesmas 43 verificações.

## Alternativas recusadas

- Manter o reset real sempre: rodadas quatro vezes mais longas.
- Restaurar sem conferir a impressão digital de migrations e seed: um schema diferente receberia dados
  de outro.

## Consequências

`pnpm training reset` sem `--fast` continua igual. A restauração não reaplica migrations, então um
defeito que só apareça ao aplicá-las é coberto pelo reset real do `pnpm test:db` e da última rodada.

## Prova

- [Equivalência com o reset real](../../apps/backend-service/__tests__/database/trainingBaseline.test.ts)
- [Impressão digital e argumentos](../../apps/backend-service/__tests__/unit/trainingScript.test.ts)
