# Arquitetura e fluxos do sistema

Os diagramas abaixo são texto Mermaid versionado. Eles descrevem os limites atuais do sistema e devem mudar no mesmo pull request que alterar uma relação representada.

## Contexto e componentes

```mermaid
flowchart LR
  browser[Navegador]
  pms[Next.js / PMS]
  api[Fastify / Backend service]
  booking[Fastify / Booking engine]
  shared[Pacote @hotel/shared]
  supabase[(Supabase: PostgreSQL + PostgREST)]

  browser -->|HTML, formulários e navegação| pms
  pms -->|HTTP sem cache| api
  browser -.->|API pública do serviço| booking
  pms -->|tipos e contratos| shared
  api -->|tipos, schemas TypeBox e OpenAPI| shared
  booking -->|tipos comuns| shared
  api -->|cliente tipado e RPCs| supabase
```

Fontes de verdade: `apps/pms/src`, `apps/backend-service/src`, `apps/booking-engine-service/src`, `packages/shared/src` e `supabase/migrations`. Atualize este diagrama ao adicionar um serviço, uma integração entre componentes ou um novo armazenamento.

## Requisição autenticada e hotel ativo

```mermaid
sequenceDiagram
  actor User as Usuário
  participant Browser as Navegador
  participant PMS as Next.js / PMS
  participant API as Fastify API
  participant Auth as Autorização
  participant DB as Supabase

  User->>Browser: Envia email e senha
  Browser->>PMS: Server Action de login
  PMS->>API: POST /auth/login
  API->>DB: Confere usuário, senha, roles e permissões
  DB-->>API: Identidade e escopos
  API-->>PMS: Token de sessão e usuário
  PMS-->>Browser: Cookies HttpOnly de sessão e hotel ativo
  Browser->>PMS: Acessa rota administrativa
  PMS->>API: Bearer token + x-active-hotel-id
  API->>Auth: Valida sessão, permissão e escopo do hotel
  Auth->>DB: Consulta ou persiste dentro do hotel autorizado
  DB-->>API: Resultado
  API-->>PMS: Envelope HTTP tipado
  PMS-->>Browser: Interface renderizada
```

Fontes de verdade: `apps/pms/src/lib/auth.ts`, `apps/pms/src/lib/activeHotel.ts`, `apps/pms/src/lib/adminApi.ts`, middlewares e rotas em `apps/backend-service/src`. Atualize este diagrama quando cookies, headers, autenticação, autorização ou isolamento por hotel mudarem.

## Pipeline de qualidade

```mermaid
flowchart TD
  change[Push, pull request ou execução manual] --> quality[Quality and Vitest]
  change --> e2e[Playwright E2E, visual and accessibility]
  change --> database[Database integration]

  quality --> openapi[Drift OpenAPI]
  quality --> static[Lint + typecheck + build]
  quality --> coverage[Vitest + cobertura + relatórios]

  e2e --> functional[Fluxos funcionais]
  e2e --> visual[Snapshots win32/linux]
  e2e --> axe[axe WCAG 2.2 AA]

  database --> reset[Supabase local + seed]
  reset --> dbtypes[Drift de tipos Supabase]
  reset --> pgtap[pgTAP]
  reset --> integration[Vitest/Fastify real]
```

Fontes de verdade: `.github/workflows/ci.yml`, `package.json`, `turbo.json`, as configurações Vitest/Playwright e os orquestradores em `scripts`. Atualize este diagrama quando jobs, comandos bloqueantes, relatórios ou artefatos do CI mudarem.
