# Sistema de Hotelaria — Projeto Integrador CJOIFSP

[![CI](https://github.com/TiagoJSaraiva/CJOPRO-Sistema-de-hotelaria/actions/workflows/ci.yml/badge.svg)](https://github.com/TiagoJSaraiva/CJOPRO-Sistema-de-hotelaria/actions/workflows/ci.yml)

Monorepo do sistema de hotelaria desenvolvido para a disciplina de Projeto
Integrador. O repositório reúne o PMS web, APIs Fastify, contratos compartilhados
e um ambiente Supabase local reproduzível.

## Módulos

- `apps/pms`: interface administrativa em Next.js.
- `apps/backend-service`: API principal em Fastify.
- `apps/booking-engine-service`: simulador determinístico do motor de reservas.
- `packages/shared`: tipos, utilitários e contratos compartilhados.
- `supabase`: migrations, seed e testes reais do banco local.

`apps/public` não é um workspace executável. Os arquivos estáticos servidos pelo
PMS pertencem a `apps/pms/public`.

## Início rápido

Versões obrigatórias: Node.js `22.23.2` e pnpm `9.12.3`.

```powershell
nvm install 22.23.2
nvm use 22.23.2
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm bootstrap
pnpm dev:pms-backend
```

O PMS usa a porta `3001`, o booking engine usa `3333`, o backend usa `3334` e
a API local do Supabase usa `54321`. Copie o `.env.example` de cada aplicação
para um arquivo local ignorado pelo Git antes de iniciar integrações reais.
`pnpm dev:pms-backend` prepara o pacote compartilhado e mantém somente PMS e
backend no terminal; um único `Ctrl+C` encerra ambos. Use `pnpm dev` quando
precisar de todos os workspaces em modo watch, inclusive o pacote compartilhado.

## Validação

```powershell
pnpm check
pnpm test
pnpm test:e2e
```

Antes de enviar uma mudança, o equivalente local dos três jobs do CI é:

```powershell
pnpm check:ci
pnpm test:db
```

`pnpm test:db` exige Docker Desktop. As demais verificações permanecem
independentes de Docker e do Supabase hospedado. Consulte o
[catálogo de comandos](docs/commands.md) para requisitos e efeitos de cada
script.

## Documentação

- [Índice técnico](docs/README.md)
- [Guia de contribuição](CONTRIBUTING.md)
- [Ambiente e desenvolvimento](docs/development-guide.md)
- [Estratégia de testes](docs/testing-strategy.md)
- [Arquitetura e fluxos](docs/architecture.md)
- [Workflow do banco de dados](docs/database-workflow.md)
- [Qualidade visual e acessibilidade](docs/ui-quality.md)

Os artefatos `docs/openapi.json` e
`packages/shared/src/database.types.ts` são gerados e versionados. Não os edite
manualmente: use `pnpm api:openapi` e `pnpm db:types`, respectivamente.

## Contribuição

Leia o [guia de contribuição](CONTRIBUTING.md) antes de alterar o projeto.
Agentes de IA também devem seguir o `AGENTS.md` raiz e o arquivo `AGENTS.md`
mais próximo da área modificada. A documentação canônica é verificada por
`pnpm docs:check` e faz parte de `pnpm check`.
