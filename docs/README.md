# Documentação técnica

Use este índice para localizar a fonte de verdade adequada à tarefa.

| Preciso...                                 | Documento                                                  |
| ------------------------------------------ | ---------------------------------------------------------- |
| preparar o ambiente ou executar um serviço | [Ambiente e desenvolvimento](development-guide.md)         |
| escolher ou diagnosticar um comando        | [Catálogo de comandos](commands.md)                        |
| contribuir e preparar uma revisão          | [Guia de contribuição](../CONTRIBUTING.md)                 |
| entender componentes e fluxos              | [Arquitetura](architecture.md)                             |
| escolher testes e interpretar relatórios   | [Estratégia de testes](testing-strategy.md)                |
| alterar migrations, seed ou tipos Supabase | [Workflow do banco](database-workflow.md)                  |
| revisar snapshots ou acessibilidade        | [Qualidade de UI](ui-quality.md)                           |
| consultar o contrato HTTP                  | [OpenAPI versionado](openapi.json)                         |
| operar preventivas, SLA e automação        | [Gestão avançada de manutenção](maintenance-management.md) |

## Fontes de verdade

- Runtime e gerenciador: `.nvmrc` e `package.json`.
- Dependências resolvidas: manifests dos workspaces e `pnpm-lock.yaml`.
- Schema: `supabase/migrations`.
- Dados sintéticos locais: `supabase/seed.sql`.
- Contrato HTTP: schemas TypeBox em `packages/shared` e `docs/openapi.json` gerado.
- Banco tipado: `packages/shared/src/database.types.ts` gerado do ambiente local.
- Pipeline: `.github/workflows/ci.yml`.
- Regressão visual: snapshots versionados em `apps/pms/__tests__/e2e/__screenshots__`.

`notes/` contém anotações históricas e não é documentação canônica. Quando uma
decisão ali se tornar vigente, transfira-a para o guia técnico correspondente.
