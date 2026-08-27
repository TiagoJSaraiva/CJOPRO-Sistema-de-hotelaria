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
- `pnpm check:full`: acrescenta testes Vitest com cobertura e E2E à validacao rapida, executa todas as fases e agrega as falhas no final.
- `pnpm check:ci`: executa a auditoria de seguranca antes da mesma validacao funcional de `check:full`.

Use `pnpm run doctor` com o `run` explicito: `pnpm doctor` e um comando interno do pnpm 9 e nao executa o diagnostico deste projeto.

O projeto rejeita instalacoes com uma versao diferente do Node declarada no `package.json`.

`.nvmrc`, os campos `packageManager` e `engines` do `package.json` e o `pnpm-lock.yaml` sao as fontes de verdade das versoes usadas localmente e no CI.

## Integracao continua

O GitHub Actions executa o workflow `CI` em pull requests e pushes para `main`, alem de permitir execucao manual. O pipeline usa Node.js `22.23.2`, pnpm `9.12.3`, Ubuntu 24.04 e instalacao congelada pelo lockfile.

Os tres jobs sao independentes:

- `Quality and Vitest`: executa `pnpm bootstrap`, `pnpm check` e `pnpm test:coverage`; publica o resumo na execucao e preserva HTML, LCOV, JSON e JUnit por sete dias.
- `Playwright E2E`: instala somente o Chromium e executa `pnpm test:e2e` com backend mockado; em caso de falha, preserva traces e screenshots por sete dias.
- `Database integration`: recria migrations e seed no Supabase local e executa pgTAP e a integracao HTTP real.

Nenhum job usa secrets, banco hospedado ou projeto Supabase vinculado. Antes de enviar uma alteracao, use `pnpm check:ci && pnpm test:db` como equivalente local completo dos tres jobs. `pnpm check:full` permanece util quando a auditoria online nao for necessaria.

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
- `pnpm test:coverage`: executa os 253 testes com cobertura, aplica os limiares por workspace e consolida os relatorios.
- `pnpm coverage:report`: reconstrói o resumo consolidado usando relatorios JSON existentes, sem executar testes.
- `pnpm test:watch`: modo watch para desenvolvimento.
- `pnpm test:e2e`: executa E2E do PMS.
- `pnpm test:db`: recria o Supabase local e executa pgTAP e a integracao HTTP real do backend.

Cobertura de testes:

- A coleta inclui explicitamente todo o codigo TypeScript elegivel, inclusive arquivos que nenhum teste importa. Somente os bootstraps `src/index.ts` dos dois servicos sao excluidos por iniciarem processos.
- E2E e testes reais de banco permanecem validacoes funcionais separadas e nao alimentam essa metrica.
- Os pisos atuais de statements/branches/functions/lines sao: backend `27/23/36/28`, PMS `37/33/29/37`, shared `81/75/87/81` e booking engine `100/100/100/100`.
- Cada workspace gera `coverage/index.html`, `lcov.info`, `coverage-summary.json` e `junit.xml`. O total ponderado fica em `coverage/summary.md`.
- O CI falha se um workspace cair abaixo de qualquer piso e envia os relatorios mesmo em falhas. Nao reduza um limiar para acomodar uma regressao; aumentos devem acompanhar novos testes e permanecer deliberados no diff.

Convencao por feature:

- `__tests__/unit/...` para unitarios.
- `__tests__/integration/...` para integracao.
- `__tests__/fixtures/...` para dados compartilhados de teste.
- `__tests__/helpers/...` para factories e utilitarios de teste.

Pacotes com configuracao inicial ativa:

- `apps/backend-service`
- `apps/booking-engine-service`
- `apps/pms`
- `packages/shared`

## Banco local reproduzivel

Pre-requisitos adicionais:

- Docker Desktop com o engine em execucao.
- Supabase CLI `2.115.0`, instalada como dependencia do workspace.

Comandos publicos:

- `pnpm db:start`: inicia o Supabase local de desenvolvimento.
- `pnpm db:status`: confirma a URL local sem imprimir chaves.
- `pnpm db:reset`: recria exclusivamente o banco local a partir das migrations e do seed; todos os dados locais sao descartados.
- `pnpm db:stop`: interrompe os containers preservando os volumes locais.
- `pnpm test:db`: inicia apenas PostgreSQL, PostgREST e Kong quando necessario, faz reset, executa pgTAP e Vitest/Fastify e encerra somente a instancia que ele proprio iniciou.

O seed cria dois hoteis sinteticos, quartos, clientes, produtos, tarifas, reservas, estadias, pagamentos e bloqueios. As contas locais usam a senha `Hotelaria123!`:

- `admin@hotelaria.local`: administrador global.
- `gerente.aurora@hotelaria.local`: acesso exclusivo ao Hotel Aurora.
- `gerente.horizonte@hotelaria.local`: acesso exclusivo ao Hotel Horizonte.

Copie os arquivos `.env.example` de cada aplicacao para o arquivo local correspondente. Para desenvolvimento manual do backend, obtenha a chave exclusivamente local com `pnpm exec supabase status`; nunca versione ou compartilhe essa chave. O orquestrador de testes carrega a credencial apenas em memoria, recusa URLs fora de `localhost`/`127.0.0.1:54321` e nunca usa `--linked`.

As verificacoes rapidas continuam independentes do Docker. O equivalente local dos tres jobs do CI e:

```powershell
pnpm check:ci
pnpm test:db
```

Se o ambiente falhar, confirme `docker info`, libere as portas `54321` e `54322` e execute `pnpm db:stop` seguido de `pnpm db:start`.

## Backend service: ambiente e seguranca

No desenvolvimento local, configure em `apps/backend-service/.env.local` (arquivo ignorado por git):

- `SUPABASE_URL`: URL da API local, normalmente `http://127.0.0.1:54321`.
- `SUPABASE_SECRET_KEY`: chave administrativa exibida apenas pelo Supabase CLI local.
- `AUTH_SESSION_SECRET`: obrigatoria, mínimo 32 caracteres.
- `ALLOWED_ORIGINS`: lista separada por virgula para CORS (por padrao localhost das aplicacoes).

Exemplo:

```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SECRET_KEY=cole-a-chave-local-sem-versionar
AUTH_SESSION_SECRET=dev-backend-auth-session-secret-please-change-before-production
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3333,http://localhost:3334
```

Observacoes:

- O backend falha no boot se `AUTH_SESSION_SECRET` nao estiver configurada corretamente.
- Login com 10 falhas consecutivas por usuario ativa bloqueio temporario de 2 minutos.


