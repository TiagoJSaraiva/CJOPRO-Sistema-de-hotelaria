# Estratégia de testes

## Camadas

| Camada         | Ferramenta               | Escopo                                     | Serviço externo |
| -------------- | ------------------------ | ------------------------------------------ | --------------- |
| Unitária       | Vitest e Testing Library | regras isoladas, componentes e utilitários | nenhum          |
| Integração     | Vitest e Fastify inject  | rotas com dependências controladas         | nenhum          |
| Cobertura      | Vitest V8                | todos os arquivos TypeScript elegíveis     | nenhum          |
| E2E            | Playwright               | quatro fluxos do PMS com backend mockado   | nenhum          |
| Visual         | Playwright snapshots     | desktop e mobile, Windows e Linux          | nenhum          |
| Acessibilidade | axe + Playwright         | WCAG automatizável e estados interativos   | nenhum          |
| Banco          | pgTAP e Vitest/Fastify   | schema, seed, RLS, RPCs e fluxos reais     | Docker local    |

Testes Vitest ficam em `__tests__/unit`, `__tests__/integration`, `fixtures` e
`helpers` conforme sua função. A suíte real de banco é separada para manter o
fluxo normal independente de Docker.

## Política para novas features e correções

Testes fazem parte da implementação. Nenhuma `feat` ou `fix` está concluída se a
proteção automatizada proporcional não for planejada, implementada e executada
no mesmo trabalho.

### Seção obrigatória no planejamento

Todo planejamento deve incluir uma seção **Proteção e testes** contendo:

1. comportamentos de sucesso, validações e falhas que precisam permanecer;
2. permissões, autenticação, hotel ativo e isolamento aplicáveis;
3. código legado descoberto que exige caracterização antes da alteração;
4. testes novos ou adaptados em cada camada relevante;
5. contratos, tipos Supabase, migrations, relatórios ou snapshots afetados;
6. comandos de aceite e efeito esperado sobre a cobertura do workspace.

| Tipo de mudança                  | Proteção mínima esperada                                                          |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Regra de negócio                 | teste unitário de sucesso, limites e falhas relevantes                            |
| Rota Fastify                     | HTTP válido, schema inválido, autenticação, autorização e erro de domínio         |
| Repositório                      | unidade com dependências controladas e `pnpm test:db` quando houver SQL relevante |
| Server Action                    | sucesso, validação, erro do backend, redirect e revalidação                       |
| Componente interativo            | Testing Library com estado, teclado e foco                                        |
| Superfície visual representativa | Playwright funcional, snapshot e axe                                              |
| Jornada entre módulos            | E2E do fluxo completo e seus estados persistidos                                  |
| Migration, RLS ou RPC            | pgTAP, tipos Supabase e integração real local                                     |
| Contrato HTTP                    | schema TypeBox, respostas por status, OpenAPI e teste de drift                    |

### Regras de cobertura

- Todo novo arquivo de produção deve ser alcançado por pelo menos um teste
  automatizado adequado; bootstraps e configuração exigem justificativa quando
  excluídos.
- Novas regras devem cobrir decisões e falhas relevantes, não apenas o caminho
  feliz.
- Ao tocar código legado descoberto, primeiro registre o comportamento atual com
  testes de caracterização.
- A cobertura do workspace deve ser preservada ou elevada. Nunca reduza um
  limiar para fazer uma implementação passar.
- Cobertura percentual não substitui provas de segurança, como autorização,
  isolamento entre hotéis, atomicidade e ausência de chamadas após payload
  inválido.

## Seleção de comandos

- Durante a implementação: `pnpm test:watch` ou um script filtrado pelo workspace.
- Mudança lógica: `pnpm test` e `pnpm check`.
- Mudança de UI: `pnpm test:visual`, `pnpm test:a11y` e `pnpm test:e2e`.
- Mudança de banco: `pnpm test:db`, após regenerar os tipos quando necessário.
- Revisão completa sem auditoria: `pnpm check:full`.
- Equivalente local do CI: `pnpm check:ci` seguido de `pnpm test:db`.

O [catálogo de comandos](commands.md) contém a referência completa.

## Cobertura e relatórios

`pnpm test:coverage` mede inclusive arquivos elegíveis não importados pelos
testes. Os limiares pertencem às configurações Vitest de cada workspace e não
devem ser reduzidos para acomodar regressões. Cada workspace produz HTML, LCOV,
JSON e JUnit em sua pasta `coverage`; o consolidado fica em `coverage/summary.md`.

E2E e banco são validações funcionais separadas e não entram na cobertura
Vitest. O Playwright grava o relatório HTML e resultados em
`node_modules/.cache`; veja caminhos, política de snapshots e diagnóstico axe em
[qualidade de UI](ui-quality.md).

## Correspondência com o CI

- `Quality and Vitest`: bootstrap, auditoria, `pnpm check` e cobertura.
- `Playwright E2E, visual and accessibility`: Chromium, fluxos funcionais, snapshots e axe, com um worker.
- `Database integration`: reconstrução local, drift de tipos, pgTAP e integração HTTP real.

Os jobs não usam secrets, banco hospedado ou projeto Supabase vinculado.
Relatórios Vitest são publicados sempre; artefatos Playwright são publicados em
falhas. O job de banco sempre encerra os containers locais ao terminar.

## Revisão manual

Automação não substitui revisão exploratória. Em mudanças de interface, percorra
teclado, foco, zoom e conteúdo conforme o checklist de UI. Em migrations,
inspecione SQL, RLS e isolamento por hotel. Em contratos, revise o diff OpenAPI
e respostas por status, não apenas o resultado do gerador.
