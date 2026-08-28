# Ambiente e desenvolvimento

## Mapa do monorepo

| Área | Responsabilidade | Entrada principal |
| --- | --- | --- |
| `apps/pms` | PMS web em Next.js | `src/app` |
| `apps/backend-service` | API Fastify, autenticação e persistência | `src/app.ts` |
| `apps/booking-engine-service` | simulador do motor de reservas | `src/index.ts` |
| `packages/shared` | tipos, utilitários e schemas TypeBox | `src/index.ts` |
| `supabase` | schema, seed e pgTAP | `migrations` e `tests/database` |
| `scripts` | orquestradores portáveis da raiz | arquivos `.mjs` |

`apps/public` contém uma cópia histórica de assets e não possui `package.json`.
Ele não é um workspace executável. O Next.js serve exclusivamente os arquivos
de `apps/pms/public`; alterações de imagens usadas pelo PMS devem ocorrer ali.

Os limites e fluxos estão nos [diagramas de arquitetura](architecture.md).

## Ambiente fixado

- Node.js `22.23.2`, declarado em `.nvmrc` e `package.json`.
- pnpm `9.12.3`, declarado em `packageManager` e `engines`.
- Docker Desktop e Supabase CLI `2.115.0` somente para fluxos reais de banco.

Prepare o workspace com `pnpm bootstrap`. Esse comando instala exatamente o
lockfile e executa o diagnóstico do ambiente. Para repetir apenas o diagnóstico,
use `pnpm run doctor`; no pnpm 9, `pnpm doctor` é um comando interno diferente.

## Aplicações e variáveis

| Serviço | Porta padrão | Arquivo de exemplo |
| --- | --- | --- |
| PMS | `3001` | `apps/pms/.env.example` |
| Booking engine | `3333` | `apps/booking-engine-service/.env.example` |
| Backend | `3334` | `apps/backend-service/.env.example` |
| Supabase API local | `54321` | gerenciada pelo Supabase CLI |

Use arquivos `.env` ou `.env.local` ignorados pelo Git. O backend exige URL e
chave do Supabase local, segredo de sessão com pelo menos 32 caracteres e origens
CORS. Obtenha credenciais exclusivamente locais com `pnpm db:status`; não copie
chaves para código, documentação ou logs.

Inicie todos os workspaces com `pnpm dev` ou execute um isoladamente com, por
exemplo, `pnpm --filter @hotel/pms dev`. O Swagger do backend fica em `/docs` e
`/docs/json` somente em desenvolvimento.

## Fluxos comuns

### Alterar uma rota HTTP

1. Atualize ou crie o schema TypeBox em `@hotel/shared/api-contract`.
2. Aplique o schema à rota e preserve autenticação e escopo de hotel.
3. Atualize testes unitários e de integração.
4. Execute `pnpm api:openapi`, revise `docs/openapi.json` e rode `pnpm check`.

### Alterar schema ou acesso ao banco

Leia primeiro o [workflow do banco](database-workflow.md). Crie uma migration
incremental, regenere os tipos com `pnpm db:types` e valide com `pnpm test:db`.
Esses comandos recusam alvos remotos e nunca devem ser substituídos por um reset vinculado.

### Alterar uma superfície do PMS

Preserve os limites entre componentes de servidor e cliente, use os tipos
públicos compartilhados e cubra comportamento com Testing Library. Mudanças de
layout, conteúdo ou interação também exigem os fluxos de regressão visual e
acessibilidade descritos em [qualidade de UI](ui-quality.md).

## Artefatos gerados

| Artefato | Fonte | Comando de atualização |
| --- | --- | --- |
| `pnpm-lock.yaml` | manifests | `pnpm install` com as versões fixadas |
| `docs/openapi.json` | schemas e rotas TypeBox | `pnpm api:openapi` |
| `packages/shared/src/database.types.ts` | schema Supabase local | `pnpm db:types` |
| snapshots Playwright | UI determinística | `pnpm test:visual:update` |

Não edite esses arquivos manualmente. Um diff gerado deve acompanhar a mudança
de sua fonte e ser revisado antes do commit.

## Diagnóstico

- Runtime ou CLI ausente: execute `pnpm run doctor` e siga a correção indicada.
- Instalação divergente: confirme Node/pnpm e rode `pnpm bootstrap`.
- Portas `54321` ou `54322` ocupadas: use `pnpm db:status` e, se a instância for do projeto, `pnpm db:stop` antes de `pnpm db:start`.
- Drift OpenAPI: regenere com `pnpm api:openapi` e revise o contrato.
- Drift de tipos: execute `pnpm db:types` contra o Supabase exclusivamente local.
- Falha visual ou axe: consulte os artefatos descritos em [qualidade de UI](ui-quality.md).
