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

Convencao por feature:

- `__tests__/unit/...` para unitarios.
- `__tests__/integration/...` para integracao.
- `__tests__/fixtures/...` para dados compartilhados de teste.
- `__tests__/helpers/...` para factories e utilitarios de teste.

Pacotes com configuracao inicial ativa:

- `apps/backend-service`
- `apps/pms`
- `packages/shared`

