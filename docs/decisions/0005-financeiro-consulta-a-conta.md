# 0005: Financeiro consulta a conta sem operá-la

- **Status:** aceita
- **Data:** 2026-11-05
- **Origem:** decisão do usuário
- **Áreas:** financeiro, permissões

## Decisão

O financeiro tem um acesso só de leitura à conta da estadia do hotel ativo, sem os termos comerciais,
com um caminho de navegação até ela. Ele não opera a conta (FIN-09, QA-037).

## Motivo

A tela e a API exigiam uma permissão que também libera operações que alteram dados, e o financeiro
recebia "Sem permissão" numa necessidade real.

## Alternativas recusadas

- Dar a permissão existente: quebraria a segregação de funções.
- Mudar a lição: esconderia a necessidade.

## Consequências

Hotéis já existentes precisam atribuir a permissão nova em Papéis.

## Prova

- [Rotas da conta](../../apps/backend-service/__tests__/unit/stayPayersRoutes.test.ts)
- [Jornada da lição 6](../../apps/pms/__tests__/journeys/lesson-06-consumption-account.spec.ts)
