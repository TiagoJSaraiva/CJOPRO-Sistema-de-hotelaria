# Estratégia de testes

## Camadas

| Camada         | Ferramenta               | Escopo                                       | Serviço externo |
| -------------- | ------------------------ | -------------------------------------------- | --------------- |
| Unitária       | Vitest e Testing Library | regras isoladas, componentes e utilitários   | nenhum          |
| Integração     | Vitest e Fastify inject  | rotas com dependências controladas           | nenhum          |
| Cobertura      | Vitest V8                | todos os arquivos TypeScript elegíveis       | nenhum          |
| E2E            | Playwright               | quatro fluxos do PMS com backend mockado     | nenhum          |
| Visual         | Playwright snapshots     | desktop e mobile, Windows e Linux            | nenhum          |
| Acessibilidade | axe + Playwright         | WCAG automatizável e estados interativos     | nenhum          |
| Banco          | pgTAP e Vitest/Fastify   | schema, seed, RLS, RPCs e fluxos reais       | Docker local    |
| Jornada real   | Playwright               | lições do curso no sistema inteiro, sem mock | Docker local    |

Testes Vitest ficam em `__tests__/unit`, `__tests__/integration`, `fixtures` e
`helpers` conforme sua função. A suíte real de banco é separada para manter o
fluxo normal independente de Docker.

O E2E de sessão passa pelo formulário de login com as rotas reais de autenticação,
assinatura e verificação de tokens, usando repositório sintético em memória. Ele
cobre perfis com todas as permissões operacionais, troca de conta, persistência no
navegador e logout. Os dados operacionais das demais telas continuam mockados.

As jornadas reais ficam em `apps/pms/__tests__/journeys` e rodam com
`pnpm test:journeys`. Cada uma recria o Supabase local com o cenário da lição e
percorre navegador, PMS, site público, backend, booking engine e banco. A jornada
falha ao encontrar resposta 5xx, erro não tratado ou `console.error`, mesmo com a
tela aparentemente correta. Os mocks continuam servindo para testes visuais e de
acessibilidade, mas não provam que as camadas conversam entre si. Elas ainda não
fazem parte do CI nem de `pnpm check:full`. Encerre `pnpm dev` antes de executá-las,
pois o PMS e o site público compartilham a pasta `.next`. Não rode outras suítes em
paralelo: sob carga, testes com tempo limite falham sem haver defeito.

O backend das jornadas também registra o que o navegador não enxerga: respostas de
erro e corpos fora do contrato, antes que o serializador remova os campos não
declarados. Três varreduras completam as lições:

- `sweep-invariants.spec.ts` confere as regras de `supabase/training/invariants.sql`
  nos dez cenários do curso;
- `sweep-pages.spec.ts` abre todas as páginas com as dez contas, grava o relatório em
  `node_modules/.cache/pms-journeys-sweep.json` e reprova a rodada com qualquer achado.
  Leva cerca de 1h40. O `next dev` reinicia por memória durante a execução, então uma
  navegação que estoura o tempo é tentada de novo e fica em `retriedNavigations`: só a
  segunda falha é achado, e a mesma página repetida entre rodadas merece investigação.
  Selecione com `pnpm test:journeys --grep varredura`;
- `rpc_runtime_regressions.test.sql` passa `plpgsql_check` em todas as funções, que
  de outra forma só falhariam ao executar.

`apiContractSerializers.test.ts` serializa um exemplo completo de cada resposta de
sucesso. Compilar o schema não basta, porque alguns erros só surgem ao responder. Os
defeitos encontrados ficam no [registro de bugs](qa/bug-ledger.md).

### Quando rodar cada suíte

O aceite completo leva horas e não precisa acompanhar cada lote.

| Momento               | O que rodar                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Durante a correção    | testes da área e a jornada afetada, com `pnpm test:journeys <arquivo>`                       |
| Fim do lote           | `pnpm check`, `pnpm test:db` e as jornadas afetadas                                          |
| Marco ou fim de etapa | tudo: `pnpm check:full`, `pnpm test:db`, `pnpm test:journeys` e o visual da outra plataforma |

Mudança de banco, dependência, CI ou tela compartilhada pede mais suítes já no fim do lote,
conforme o [catálogo de comandos](commands.md).

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
