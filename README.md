# Sistema de Hotelaria para disciplina Projeto Integrador do CJOIFSP

## Modulos

- apps/pms: interface do sistema.
- apps/backend-service: backend.
- apps/booking-engine-service: microsserviço que simula motor de reservas.
- packages/shared: codigo compartilhado entre os modulos.

## Ambiente de desenvolvimento

Versoes obrigatorias:

- Node.js `22.23.2`.
- pnpm `9.12.3`.

No Windows com NVM e Corepack:

```powershell
nvm install 22.23.2
nvm use 22.23.2
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm bootstrap
```

Comandos de reproducibilidade e validacao:

- `pnpm bootstrap`: instala exatamente o lockfile e valida o ambiente.
- `pnpm run doctor`: diagnostica versoes, workspace, lockfile e CLIs essenciais.
- `pnpm run doctor -- --json`: retorna o mesmo diagnostico em formato estruturado.
- `pnpm check`: executa lint, typecheck e build; deve ser a validacao rapida antes de um commit.
- `pnpm check:full`: acrescenta testes Vitest e E2E à validacao rapida, executa todas as fases e agrega as falhas no final.

Use `pnpm run doctor` com o `run` explicito: `pnpm doctor` e um comando interno do pnpm 9 e nao executa o diagnostico deste projeto.

O projeto rejeita instalacoes com uma versao diferente do Node declarada no `package.json`.

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

- `AUTH_SESSION_SECRET`: obrigatoria, mínimo 32 caracteres.
- `ALLOWED_ORIGINS`: lista separada por virgula para CORS (por padrao localhost das aplicacoes).

Exemplo:

```env
AUTH_SESSION_SECRET=dev-backend-auth-session-secret-please-change-before-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3333,http://localhost:3334
```

Observacoes:

- O backend falha no boot se `AUTH_SESSION_SECRET` nao estiver configurada corretamente.
- Login com 10 falhas consecutivas por usuario ativa bloqueio temporario de 2 minutos.


