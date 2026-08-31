# Guia de contribuição

## Preparação

1. Leia o `AGENTS.md` raiz e, quando existir, o `AGENTS.md` da área alterada.
2. Execute `git status --short` e preserve mudanças que já estavam no diretório.
3. Use Node.js `22.23.2`, pnpm `9.12.3` e instale com `pnpm bootstrap`.
4. Copie somente os `.env.example` necessários; nunca versione secrets ou credenciais locais.

Consulte o [guia de desenvolvimento](docs/development-guide.md) para portas,
variáveis e fluxos entre os módulos.

## Fluxo de trabalho

- Faça mudanças pequenas e relacionadas ao objetivo da tarefa.
- Não atualize dependências ou artefatos gerados incidentalmente.
- Em toda `feat` ou `fix`, inclua **Proteção e testes** no planejamento conforme a
  [política de testes](docs/testing-strategy.md#política-para-novas-features-e-correções).
- Adicione ou adapte os testes planejados no mesmo conjunto da mudança.
- Revise `git diff` e `git status --short` antes de concluir.
- Não faça commit, push, publicação ou alteração remota em nome de outra pessoa sem autorização explícita.

Commits usam Conventional Commits, em português quando possível. Exemplos:
`feat(api): adiciona filtro de estadias`, `fix(pms): corrige foco do modal` e
`docs: atualiza fluxo de contribuição`.

## Validação por tipo de mudança

| Mudança                            | Validação mínima adicional a `pnpm check`                       |
| ---------------------------------- | --------------------------------------------------------------- |
| Documentação ou instruções         | `pnpm docs:check`                                               |
| Backend ou contrato HTTP           | testes afetados, `pnpm api:openapi:check` e `pnpm test`         |
| PMS sem alteração visual           | testes afetados e `pnpm test`                                   |
| PMS visual ou interativo           | `pnpm test:visual`, `pnpm test:a11y` e `pnpm test:e2e`          |
| Shared                             | `pnpm test`, typecheck e build dos consumidores                 |
| Migration, seed ou acesso ao banco | `pnpm db:types` e `pnpm test:db`                                |
| Dependências                       | instalação congelada, `pnpm security:audit` e `pnpm check:full` |
| CI ou tooling transversal          | `pnpm check:ci` e a suíte afetada pelo tooling                  |

O [catálogo de comandos](docs/commands.md) descreve pré-requisitos e efeitos.
O [guia de testes](docs/testing-strategy.md) explica como selecionar as suítes.

## Arquivos gerados e fontes de verdade

- `pnpm-lock.yaml` é resolvido pelos manifests; não edite o lockfile manualmente.
- `docs/openapi.json` é gerado dos schemas TypeBox com `pnpm api:openapi`.
- `packages/shared/src/database.types.ts` é gerado do Supabase local com `pnpm db:types`.
- Snapshots Playwright só mudam após revisão deliberada com `pnpm test:visual:update`.
- `supabase/migrations` define o schema. Nunca reescreva uma migration aplicada; crie uma migration incremental.

## Checklist de pull request

- [ ] O diff contém apenas arquivos relacionados à mudança.
- [ ] Não há secrets, dados pessoais, dumps, logs ou artefatos temporários.
- [ ] O planejamento da `feat` ou `fix` contém a seção **Proteção e testes**.
- [ ] Testes novos cobrem sucesso, falhas e limites de segurança relevantes.
- [ ] Código legado descoberto foi caracterizado antes de ser modificado.
- [ ] A cobertura do workspace foi preservada ou elevada, sem reduzir limiares.
- [ ] Documentação, contratos, tipos e diagramas afetados foram atualizados.
- [ ] Baselines visuais alterados foram inspecionados nas imagens expected, actual e diff.
- [ ] `pnpm check` e as validações proporcionais da tabela passaram.
- [ ] Operações locais destrutivas e qualquer ação remota foram explicitadas na revisão.
