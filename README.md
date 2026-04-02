# Sistema de Hotelaria Monorepo

Este repositorio esta configurado somente com base estrutural para desenvolvimento incremental.
Nao ha logica de negocio implementada nesta etapa.

## Modulos

- apps/pms: base de PMS em Next.js.
- apps/site: base do site institucional em Next.js.
- apps/backend-service: backend unico em Node.js + Fastify.
- apps/booking-engine-service: base de microsservico Node.js.
- packages/shared: base para codigo compartilhado entre os modulos.

## Stack de monorepo

- pnpm workspaces para gerenciamento de dependencias.
- turbo (Turborepo) para orquestrar dev, build, typecheck e lint.

## Requisitos

- Node.js 20+
- pnpm 9+

## Como iniciar

```bash
pnpm install
pnpm dev
```

## Comandos uteis

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm clean
```

## Turbopack x Turborepo

- Turbopack: bundler do Next.js.
- Turborepo (turbo): orquestrador de tarefas em monorepo.
