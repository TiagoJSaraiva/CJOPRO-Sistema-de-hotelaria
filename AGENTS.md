# Instruções para agentes

Estas regras valem para todo o repositório. Arquivos `AGENTS.md` mais próximos
da área alterada acrescentam regras locais; eles não substituem este arquivo.
Leia também o [índice técnico](docs/README.md) e o
[guia de contribuição](CONTRIBUTING.md).

## Antes de agir

1. Execute `git status --short` e identifique alterações preexistentes.
2. Leia o `AGENTS.md` da área e as fontes de verdade relacionadas à tarefa.
3. Inspecione código, testes e configurações antes de escolher a solução.
4. Preserve mudanças do usuário e mantenha o diff restrito ao pedido.

Não faça commit, push, deploy, publicação ou alteração remota sem autorização
explícita. Não apague arquivos, descarte mudanças ou reescreva histórico para
resolver conflitos de escopo.

## Mapa e fontes de verdade

- `apps/pms`: Next.js e interfaces administrativas.
- `apps/backend-service`: Fastify, autenticação, autorização e persistência.
- `apps/booking-engine-service`: simulador determinístico sem banco.
- `packages/shared`: tipos, utilitários e contratos públicos.
- `supabase/migrations`: fonte de verdade do schema.
- `supabase/seed.sql`: dados exclusivamente sintéticos do ambiente local.
- `scripts`: orquestração portável usada localmente e no CI.
- `.github/workflows/ci.yml`: fonte de verdade do pipeline.

Runtime e dependências são definidos por `.nvmrc`, manifests e
`pnpm-lock.yaml`. `notes/` contém anotações históricas, não especificações
vigentes. Consulte o [guia de desenvolvimento](docs/development-guide.md) para o
mapa completo.

## Artefatos gerados

Não edite manualmente:

- `pnpm-lock.yaml`: regenere apenas ao alterar manifests deliberadamente;
- `docs/openapi.json`: use `pnpm api:openapi`;
- `packages/shared/src/database.types.ts`: use `pnpm db:types` contra o banco local;
- snapshots Playwright: use `pnpm test:visual:update` somente após revisar o diff visual.

Uma alteração gerada deve acompanhar a mudança de sua fonte. Não aceite upgrades,
snapshots ou contratos incidentais no diff.

## Banco e dados

Antes de consultar ou alterar banco, schema, migrations, seeds, funções,
triggers, políticas ou dados, leia integralmente o
[workflow do banco](docs/database-workflow.md).

- Toda mudança de schema deve ser uma migration incremental validada localmente.
- Não edite `supabase/migrations/20260825062029_remote_schema.sql`.
- Nunca versione secrets, dados pessoais, dumps ou credenciais remotas.
- Nunca execute `db reset --linked`.
- Não consulte nem altere o Supabase hospedado e não execute `db push --linked`
  sem autorização explícita do usuário na tarefa atual.

## Implementação e validação

- Use TypeScript estrito e preserve APIs públicas, isolamento por hotel e
  envelopes de erro existentes.
- Prefira dependências já instaladas; adicionar ou atualizar pacote exige escopo
  explícito e auditoria do lockfile.
- Testes devem ser determinísticos e independentes de serviços externos, exceto
  a suíte local de banco deliberadamente separada.
- Atualize documentação e diagramas no mesmo diff da mudança que representam.

Execute validações proporcionais conforme o
[guia de contribuição](CONTRIBUTING.md). `pnpm check` é a gate mínima normal;
mudanças visuais, de banco, dependências ou CI exigem as suítes adicionais do
[catálogo de comandos](docs/commands.md).

## Definição de pronto

- comportamento solicitado implementado e coberto por testes relevantes;
- lint, typecheck, build e checks de drift aplicáveis verdes;
- nenhuma regressão de cobertura, segurança, visual ou acessibilidade;
- diff revisado, sem artefatos temporários ou mudanças não relacionadas;
- limitações, ações destrutivas locais e validações não executadas comunicadas.
