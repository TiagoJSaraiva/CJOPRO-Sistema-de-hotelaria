# Sistema de Hotelaria para disciplina Projeto Integrador do CJOIFSP

[![CI](https://github.com/TiagoJSaraiva/CJOPRO-Sistema-de-hotelaria/actions/workflows/ci.yml/badge.svg)](https://github.com/TiagoJSaraiva/CJOPRO-Sistema-de-hotelaria/actions/workflows/ci.yml)

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
- `pnpm security:audit`: bloqueia vulnerabilidades de severidade alta ou critica na arvore completa.
- `pnpm deps:outdated`: mostra atualizacoes disponiveis em todos os workspaces.
- `pnpm deps:outdated:json`: retorna as atualizacoes disponiveis em formato estruturado.
- `pnpm check`: executa lint, typecheck e build; deve ser a validacao rapida antes de um commit.
- `pnpm check:full`: acrescenta testes Vitest e E2E à validacao rapida, executa todas as fases e agrega as falhas no final.
- `pnpm check:ci`: executa a auditoria de seguranca antes da mesma validacao funcional de `check:full`.

Use `pnpm run doctor` com o `run` explicito: `pnpm doctor` e um comando interno do pnpm 9 e nao executa o diagnostico deste projeto.

O projeto rejeita instalacoes com uma versao diferente do Node declarada no `package.json`.

`.nvmrc`, os campos `packageManager` e `engines` do `package.json` e o `pnpm-lock.yaml` sao as fontes de verdade das versoes usadas localmente e no CI.

## Integracao continua

O GitHub Actions executa o workflow `CI` em pull requests e pushes para `main`, alem de permitir execucao manual. O pipeline usa Node.js `22.23.2`, pnpm `9.12.3`, Ubuntu 24.04 e instalacao congelada pelo lockfile.

Os dois jobs sao independentes:

- `Quality and Vitest`: executa `pnpm bootstrap`, `pnpm check` e `pnpm test`.
- `Playwright E2E`: instala somente o Chromium e executa `pnpm test:e2e` com backend mockado; em caso de falha, preserva traces e screenshots por sete dias.

Nenhum job depende de secrets, banco ou Supabase. Antes de enviar uma alteracao, use `pnpm check:ci` como equivalente local completo dos dois jobs. `pnpm check:full` permanece util quando a auditoria online nao for necessaria.

## Politica de dependencias e seguranca

As versoes de runtime e ferramentas sao declaradas nos manifests dos workspaces e resolvidas exclusivamente pelo `pnpm-lock.yaml`. Instalacoes reproduziveis devem usar `pnpm bootstrap` ou `pnpm install --frozen-lockfile`; o projeto tambem rejeita peers incompativeis.

A auditoria bloqueia vulnerabilidades altas e criticas. Achados moderados e baixos devem ser avaliados e documentados, mas podem aguardar correcao upstream quando nao houver atualizacao compativel. Nao use `audit.ignore` nem suprima GHSAs.

O Dependabot verifica dependencias npm semanalmente. Atualizacoes patch e minor de producao e desenvolvimento sao agrupadas separadamente; majors permanecem em pull requests individuais e nunca recebem merge automatico. Permanecem deliberadamente adiadas as migracoes para Next 16, ESLint 10, Tailwind 4, TypeScript 7, jsdom 30, dotenv 17 e `@fastify/cors` 11.

Overrides em `pnpm.overrides` sao permitidos apenas para corrigir uma dependencia transitiva vulneravel dentro da mesma major e devem conter o intervalo vulneravel no seletor. Ao revisar um override:

1. confirme o advisory e a primeira versao corrigida com `pnpm security:audit`;
2. tente primeiro atualizar normalmente a dependencia que introduz o pacote;
3. restrinja o seletor ao intervalo vulneravel e regenere o lockfile;
4. execute `pnpm install --frozen-lockfile`, `pnpm security:audit` e `pnpm check:full`;
5. remova o override assim que a dependencia de origem passar a resolver uma versao segura.

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


