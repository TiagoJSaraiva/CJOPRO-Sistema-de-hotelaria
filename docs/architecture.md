# Arquitetura e fluxos do sistema

Os diagramas abaixo são texto Mermaid versionado. Eles descrevem os limites atuais do sistema e devem mudar no mesmo pull request que alterar uma relação representada.

Volte ao [índice técnico](README.md) ou consulte o
[guia de desenvolvimento](development-guide.md) para executar os componentes.

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

## Danos, manutenção e bloqueio operacional

Uma ocorrência descreve o problema e mantém o contexto do quarto, área,
equipamento e, quando aplicável, da estadia. O trabalho executável fica em uma
ou mais ordens. Alterações de estado, inspeções, liberações e a ciência no
checkout usam funções transacionais do PostgreSQL para que estado e auditoria
sejam persistidos juntos.

```mermaid
flowchart LR
  report[Ocorrência relatada] --> triage[Triagem]
  triage --> orders[Uma ou mais ordens]
  triage -.-> block[Bloqueio rígido do quarto]
  orders --> execution[Execução]
  execution --> inspection{Inspeção exigida?}
  inspection -->|sim| review[Aprovação por outro usuário]
  inspection -->|não| liability{Responsabilidade suspeita?}
  review --> liability
  liability -->|sim| decision[Confirmação ou descarte]
  liability -->|não| release[Liberação explícita]
  decision --> release
  release --> close[Encerramento]
  close -->|justificativa| triage
  report -. vínculo opcional .-> stay[Estadia]
  stay --> checkout[Checkout com ciência]
```

O calendário deriva a disponibilidade dos bloqueios ativos: um bloqueio não
liberado continua rígido depois da previsão e passa a ser mostrado como
atrasado. `rooms.status` permanece compatível para estados legados, enquanto
novas interdições de manutenção são criadas somente em `room_blocks`.

Evidências ficam no bucket privado `maintenance-evidence`; o navegador recebe
apenas URLs assinadas temporárias e nunca credenciais administrativas. O módulo
operacional não realoca hóspedes nem cria cobranças automaticamente.

Fontes de verdade: migration `20260831010000_create_maintenance_core.sql`,
`maintenanceRepository.ts`, `maintenanceRoutes.ts`, os contratos em
`packages/shared/src/api-contract.ts` e as páginas em
`apps/pms/src/app/dashboard/maintenance`.

## Execução financeira de danos e manutenção

O fólio é o razão operacional da estadia. Débitos e créditos postados são
imutáveis, pagamentos podem ser alocados entre vários débitos e correções são
novos lançamentos compensatórios. Os campos legados de total da estadia são
mantidos como projeções de compatibilidade; saldo e situação de pagamento são
derivados de `stay_folio_entries` e `stay_folio_allocations`.

```mermaid
flowchart LR
  estimate[Orçamento de custo] --> actual[Custo real]
  actual --> submit[Submissão]
  submit --> approve{Aprovador diferente?}
  approve -->|sim| payable[Obrigação a pagar]
  approve -->|não| reject[Rejeição]
  payable --> settlement[Pagamento parcial ou total]
  settlement --> cash[Transação realizada]
  cash -->|correção| reversal[Estorno compensatório]

  liability[Responsabilidade confirmada] --> recovery[Recuperação manual]
  recovery --> recoverApprove[Aprovação]
  recoverApprove --> guest{Hóspede?}
  guest -->|sim| folio[Débito no fólio]
  guest -->|terceiro| receivable[Recebível independente]
  folio --> receipt[Recebimento e alocação]
  receivable --> receipt
  recovery -.-> waiver[Dispensa justificada]
```

Proposta, aprovação e liquidação possuem permissões independentes, e o autor
não aprova o próprio item. A conclusão operacional da ocorrência não depende da
quitação financeira. Documentos ficam no bucket privado
`maintenance-financial-documents`; valores e arquivos são expostos somente a
usuários com permissão financeira. O checkout exige ciência dos débitos de dano
em aberto, mas continua permitido.

Fontes de verdade: migration `20260831020000_create_maintenance_finance.sql`,
`maintenanceFinanceRepository.ts`, `maintenanceFinanceRoutes.ts`, contratos em
`packages/shared/src/api-contract.ts` e a central
`apps/pms/src/app/dashboard/maintenance/finance`.

## Gestão avançada de manutenção

Planos preventivos geram ocorrências e ordens comuns, preservando o mesmo fluxo
operacional e financeiro. Cada competência possui chave única por plano e data
local; quando há uma execução anterior aberta, ela permanece adiada até uma
decisão gerencial justificada. O checklist da ordem é um snapshot independente
do template, de modo que edições posteriores no plano não alteram trabalho já
emitido.

```mermaid
flowchart LR
  cron[pg_cron a cada 15 min] --> cycle[Ciclo por hotel e data local]
  cycle --> plans[Competências preventivas]
  plans --> open{Execução anterior aberta?}
  open -->|não| occurrence[Ocorrência + ordem + checklist]
  open -->|sim| deferred[Competência adiada]
  deferred --> decision[Gerar, ignorar ou reagendar]
  cycle --> sla[Marcos de SLA]
  cycle --> expiry[Garantias e contratos]
  sla --> inbox[Notificações deduplicadas]
  expiry --> inbox
  occurrence --> analytics[Indicadores e exportações]
```

O SLA usa horas corridas e é copiado para a ocorrência no momento do registro.
Pausas e esperas não suspendem o relógio, reaberturas mantêm os prazos originais
e ocorrências anteriores à migration não recebem violações retroativas. O ciclo
automático registra chave, duração, contadores e erro, permitindo reprocessamento
idempotente pela interface administrativa.

Fornecedores não substituem o responsável interno. Contratos e ativos podem
especializar o contexto da ordem, mas não concluem trabalho nem geram obrigação
financeira automaticamente. Termos comerciais, custos e métricas financeiras
continuam protegidos pela permissão financeira. Documentos gerenciais ficam no
bucket privado `maintenance-management-documents` e são acessados por URLs
assinadas de curta duração.

Fontes de verdade: migration
`20260902010000_create_maintenance_management.sql`,
`maintenanceManagementRepository.ts`, `maintenanceManagementRoutes.ts`, os
contratos em `packages/shared/src/api-contract.ts`, o guia
`docs/maintenance-management.md` e as páginas de gestão em
`apps/pms/src/app/dashboard/maintenance`.

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
