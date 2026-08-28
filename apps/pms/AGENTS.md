# Instruções locais — PMS

Estas regras complementam o `AGENTS.md` raiz. Consulte a
[qualidade de UI](../../docs/ui-quality.md) e a
[estratégia de testes](../../docs/testing-strategy.md).

- Preserve os limites entre componentes de servidor e cliente do App Router.
  APIs dinâmicas do Next 15, como `cookies()`, `params` e `searchParams`, são
  assíncronas.
- Centralize autenticação, hotel ativo e chamadas administrativas nos helpers
  existentes; mantenha fetches administrativos como `no-store`.
- Consuma tipos públicos de `@hotel/shared`; não duplique contratos da API no PMS.
- Todo controle interativo precisa de nome acessível, foco visível, teclado e
  alvos adequados. Modais devem conter foco, aceitar Escape e devolver o foco ao
  acionador.
- Cubra lógica e componentes com Vitest/Testing Library. Mudanças nas superfícies
  E2E exigem Playwright funcional, visual e axe.
- Não atualize snapshots para tornar um teste verde. Inspecione expected, actual
  e diff e use `pnpm test:visual:update` apenas para mudanças deliberadas.
