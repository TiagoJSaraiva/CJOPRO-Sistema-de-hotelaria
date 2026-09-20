# Catálogo de comandos

Execute os comandos na raiz. “Versionados” indica se a execução normal pode
atualizar arquivos acompanhados pelo Git.

## Ambiente, desenvolvimento e qualidade

| Comando                | Finalidade                                                            | Requisito adicional                                    | Versionados |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ | ----------- |
| `pnpm bootstrap`       | instala o lockfile congelado e diagnostica o ambiente                 | runtime fixado                                         | não         |
| `pnpm run doctor`      | valida versões, workspaces, lockfile e CLIs                           | nenhum                                                 | não         |
| `pnpm dev`             | inicia os workspaces em modo watch                                    | `.env` conforme o serviço                              | não         |
| `pnpm dev:pms-backend` | compila shared e inicia somente PMS e backend; `Ctrl+C` encerra ambos | configuração do backend; portas `3001` e `3334` livres | não         |
| `pnpm build`           | compila todos os workspaces                                           | nenhum                                                 | não         |
| `pnpm typecheck`       | verifica TypeScript                                                   | nenhum                                                 | não         |
| `pnpm lint`            | valida scripts e código                                               | nenhum                                                 | não         |
| `pnpm lint:scripts`    | valida a sintaxe dos orquestradores da raiz                           | nenhum                                                 | não         |
| `pnpm clean`           | remove outputs de build conhecidos                                    | nenhum                                                 | não         |
| `pnpm docs:check`      | valida documentação e instruções para agentes                         | nenhum                                                 | não         |
| `pnpm check`           | executa docs, OpenAPI, lint, typecheck e build                        | nenhum                                                 | não         |
| `pnpm check:full`      | acrescenta cobertura e E2E, agregando falhas                          | Chromium instalado                                     | não         |
| `pnpm check:ci`        | acrescenta auditoria ao check completo                                | acesso ao registry                                     | não         |

`pnpm run doctor -- --json` e `pnpm docs:check -- --json` fornecem saída
estruturada. Use `pnpm run doctor`, pois `pnpm doctor` é um comando interno do pnpm 9.
O comando `pnpm dev:pms-backend` compila `@hotel/shared` apenas na inicialização;
reinicie-o após mudanças nesse pacote ou use `pnpm dev` para recompilação contínua.
Ele não gerencia o Supabase e não possui comando separado de parada.

## Dependências e segurança

| Comando                   | Finalidade                                  | Requisito adicional | Versionados |
| ------------------------- | ------------------------------------------- | ------------------- | ----------- |
| `pnpm deps:outdated`      | lista atualizações por workspace            | acesso ao registry  | não         |
| `pnpm deps:outdated:json` | retorna atualizações em JSON                | acesso ao registry  | não         |
| `pnpm security:audit`     | bloqueia vulnerabilidades altas ou críticas | acesso ao registry  | não         |

Instalações reproduzíveis usam `pnpm install --frozen-lockfile`. `pnpm install`
sem essa opção pode alterar `pnpm-lock.yaml` e só deve ser usado ao modificar
deliberadamente manifests ou overrides.

## Testes

| Comando                   | Finalidade                                       | Requisito adicional | Versionados |
| ------------------------- | ------------------------------------------------ | ------------------- | ----------- |
| `pnpm test`               | executa todas as suítes Vitest normais           | nenhum              | não         |
| `pnpm test:unit`          | executa testes unitários                         | nenhum              | não         |
| `pnpm test:integration`   | executa integrações sem banco real               | nenhum              | não         |
| `pnpm test:coverage`      | aplica cobertura e gera relatórios               | nenhum              | não         |
| `pnpm coverage:report`    | reconstrói o consolidado de JSONs existentes     | relatórios prévios  | não         |
| `pnpm test:watch`         | executa Vitest em modo watch                     | terminal interativo | não         |
| `pnpm test:e2e`           | executa Playwright funcional, visual e axe       | Chromium            | não         |
| `pnpm test:visual`        | compara snapshots da plataforma atual            | Chromium            | não         |
| `pnpm test:a11y`          | executa auditorias axe                           | Chromium            | não         |
| `pnpm test:visual:update` | atualiza snapshots alterados da plataforma atual | revisão visual      | sim         |
| `pnpm test:db`            | recria e testa o Supabase exclusivamente local   | Docker              | não         |

## API e banco

| Comando                                 | Finalidade                                       | Requisito adicional      | Versionados |
| --------------------------------------- | ------------------------------------------------ | ------------------------ | ----------- |
| `pnpm api:openapi`                      | atualiza os contratos administrativos e públicos | nenhum                   | sim         |
| `pnpm api:openapi:check`                | valida ambos os contratos OpenAPI e seu drift    | nenhum                   | não         |
| `pnpm db:start`                         | inicia o Supabase local                          | Docker                   | não         |
| `pnpm db:status`                        | inspeciona a instância local sem imprimir chaves | Docker                   | não         |
| `pnpm db:reset`                         | recria e semeia exclusivamente o banco local     | Docker; destrutivo local | não         |
| `pnpm db:stop`                          | encerra containers preservando volumes           | Docker                   | não         |
| `pnpm db:types`                         | reseta localmente e atualiza os tipos gerados    | Docker                   | sim         |
| `pnpm db:types:check`                   | compara tipos gerados sem escrever               | Docker                   | não         |
| `pnpm training scenarios`               | lista os cenários didáticos disponíveis          | nenhum                   | não         |
| `pnpm training reset --scenario <nome>` | recria o banco local e prepara uma lição         | Docker; destrutivo local | não         |
| `pnpm training clock ...`               | consulta ou controla o relógio operacional local | Docker e Supabase local  | não         |

Nenhum comando do projeto usa `--linked`. Publicação ou consulta ao Supabase
hospedado exige autorização explícita e segue o [workflow do banco](database-workflow.md).
O reset de treinamento exige confirmação textual; use `--yes` apenas em automações
locais revisadas. O script recusa qualquer API diferente de `localhost:54321` ou
`127.0.0.1:54321`.
