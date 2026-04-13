# Sistema de Hotelaria para disciplina Projeto Integrador do CJOIFSP

## Modulos

- apps/pms: interface do sistema.
- apps/site: site institucional.
- apps/backend-service: backend.
- apps/booking-engine-service: microsserviço que simula motor de reservas.
- packages/shared: codigo compartilhado entre os modulos.

## Testes

Stack adotada:

- Vitest para testes unitarios e de integracao.
- Supertest para integracao HTTP no backend.
- Testing Library para testes no PMS.
- Playwright preparado para E2E no PMS.

Comandos principais (na raiz):

- `pnpm test`: executa todos os testes configurados no monorepo.
- `pnpm test:unit`: executa somente testes unitarios.
- `pnpm test:integration`: executa somente testes de integracao.
- `pnpm test:coverage`: gera cobertura por pacote.
- `pnpm test:watch`: modo watch para desenvolvimento.
- `pnpm test:e2e`: executa E2E do PMS.

Cobertura de testes:

- Cobertura e o percentual do codigo executado pelos testes (statements, branches, funcoes e linhas).
- Cobertura alta em fluxos criticos reduz regressao silenciosa durante refatoracao.
- O comando `pnpm test:coverage` gera relatorios por pacote.

Convencao por feature:

- `__tests__/unit/...` para unitarios.
- `__tests__/integration/...` para integracao.
- `__tests__/fixtures/...` para dados compartilhados de teste.
- `__tests__/helpers/...` para factories e utilitarios de teste.

Pacotes com configuracao inicial ativa:

- `apps/backend-service`
- `apps/pms`
- `packages/shared`

## Backend service: ambiente e seguranca

No desenvolvimento local, configure em `apps/backend-service/.env.local` (arquivo ignorado por git):

- `AUTH_SESSION_SECRET`: obrigatoria, minimo 32 caracteres.
- `ALLOWED_ORIGINS`: lista separada por virgula para CORS (por padrao localhost das aplicacoes).

Exemplo:

```env
AUTH_SESSION_SECRET=dev-backend-auth-session-secret-please-change-before-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3333,http://localhost:3334
```

Observacoes:

- O backend falha no boot se `AUTH_SESSION_SECRET` nao estiver configurada corretamente.
- Login com 10 falhas consecutivas por usuario ativa bloqueio temporario de 2 minutos.


